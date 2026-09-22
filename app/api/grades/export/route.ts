import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { canGenerateCOG, COG_FORBIDDEN_MESSAGE } from "@/lib/cog-roles";
import {
  GRADE_EXPORT_COLUMN_WIDTHS,
  GRADE_EXPORT_HEADERS,
  GRADE_EXPORT_SHEET_NAME,
  gradeExportFileName,
  toGradeExportRows,
  type GradeWithStudent,
} from "@/lib/grades-export";
import { AcademicYear, Semester } from "@prisma/client";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

/**
 * GET /api/grades/export?academicYear=AY_2024_2025&semester=FIRST
 *
 * Downloads every grade record for one academic term as an .xlsx in the
 * canonical bulk-upload format, so the registrar can export a term, correct
 * it offline, and re-upload it unchanged.
 *
 * Access is restricted to `admin` and `registrar` only.
 */

/**
 * Rows are fetched in pages of this size and appended to the workbook, so a
 * whole term can be exported regardless of how many grades it holds. Paging
 * keeps the peak memory of the Prisma query bounded rather than loading the
 * entire term in one shot.
 */
const EXPORT_PAGE_SIZE = 5_000;

const VALID_ACADEMIC_YEARS = new Set<string>(Object.values(AcademicYear));
const VALID_SEMESTERS = new Set<string>(Object.values(Semester));

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  // --- Authentication ---
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Authorization: admin + registrar only ---
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (!canGenerateCOG(role)) {
    return NextResponse.json({ error: COG_FORBIDDEN_MESSAGE }, { status: 403 });
  }

  // --- Rate limiting: 5 exports per 60s per user ---
  const rl = await checkApiRateLimit("export_term_grades", 5, 60);
  if (rl.error) return rl.error;

  // --- Input validation against the enum allowlists ---
  const searchParams = request.nextUrl.searchParams;
  const academicYear = searchParams.get("academicYear");
  const semester = searchParams.get("semester");

  if (!academicYear || !VALID_ACADEMIC_YEARS.has(academicYear)) {
    return badRequest(
      `Invalid academicYear. Expected one of the known academic years (e.g. AY_2024_2025).`,
    );
  }

  if (!semester || !VALID_SEMESTERS.has(semester)) {
    return badRequest(
      `Invalid semester. Expected one of: ${[...VALID_SEMESTERS].join(", ")}.`,
    );
  }

  try {
    const where = {
      academicYear: academicYear as AcademicYear,
      semester: semester as Semester,
    };

    const { _count } = await prisma.grade.aggregate({
      where,
      _count: { _all: true },
    });
    const totalForTerm = _count._all;

    if (totalForTerm === 0) {
      return NextResponse.json(
        { error: "No grades found for the selected academic year and semester." },
        { status: 404 },
      );
    }
    // Page through the term with KEYSET (seek) pagination rather than OFFSET.
    //
    // The ordering key is (studentNumber, courseCode), which is a total order
    // within one (academicYear, semester) term because of the
    // @@unique([studentNumber, courseCode, academicYear, semester]) constraint.
    // Seeking past the last row of the previous page therefore cannot duplicate
    // or skip rows, whereas OFFSET would both re-scan everything before the
    // offset and shift if rows were inserted mid-export.
    const rows: ReturnType<typeof toGradeExportRows> = [];
    let cursor: { studentNumber: string; courseCode: string } | null = null;

    for (;;) {
      // This annotation is required, not decorative: `cursor` is assigned from
      // the previous page's last row, so omitting it makes TS report TS7022
      // ('page' is referenced directly or indirectly in its own initializer) at
      // both this line and the `last` assignment below.
      const page: GradeWithStudent[] = await prisma.grade.findMany({
        where: cursor
          ? {
              ...where,
              // Strictly after the cursor: either a later studentNumber, or the
              // same studentNumber with a later courseCode.
              OR: [
                { studentNumber: { gt: cursor.studentNumber } },
                {
                  studentNumber: cursor.studentNumber,
                  courseCode: { gt: cursor.courseCode },
                },
              ],
            }
          : where,
        include: {
          student: {
            select: {
              studentNumber: true,
              firstName: true,
              lastName: true,
              middleInit: true,
            },
          },
        },
        orderBy: [{ studentNumber: "asc" }, { courseCode: "asc" }],
        take: EXPORT_PAGE_SIZE,
      });

      if (page.length === 0) break;

      rows.push(...toGradeExportRows(page));

      // A short page means the term is exhausted; stop without a further query.
      if (page.length < EXPORT_PAGE_SIZE) break;

      const last = page[page.length - 1];
      cursor = { studentNumber: last.studentNumber, courseCode: last.courseCode };
    }

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [...GRADE_EXPORT_HEADERS],
    });
    worksheet["!cols"] = GRADE_EXPORT_COLUMN_WIDTHS;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, GRADE_EXPORT_SHEET_NAME);

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      // Both of these matter for size:
      //  - `compression` DEFLATEs the sheet XML. SheetJS defaults it OFF, which
      //    is why the file used to weigh ~500 KB per 1,000 rows.
      //  - `bookSST` writes a shared string table, so repeated values (course
      //    titles, instructors, remarks) are stored once instead of per row.
      compression: true,
      bookSST: true,
    }) as Buffer;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${gradeExportFileName(
          academicYear,
          semester,
        )}"`,
        "Content-Length": String(buffer.length),
        // Per-user export data must never be shared by a CDN or browser cache.
        "Cache-Control": "private, no-store",
        "X-Export-Row-Count": String(rows.length),
        "Vary": "Accept-Encoding",
      },
    });
  } catch (error) {
    console.error("Error exporting term grades:", error);
    return NextResponse.json(
      { error: "Failed to export grades. Please try again." },
      { status: 500 },
    );
  }
}
