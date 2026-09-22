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

/**
 * Row shape returned by the raw keyset query below.
 * Column names are the database's, so they are quoted in SQL and aliased to
 * the camelCase names the rest of the module expects.
 */
type RawExportRow = {
  studentNumber: string;
  courseCode: string;
  courseTitle: string;
  creditUnit: number;
  grade: string;
  reExam: string | null;
  remarks: string | null;
  instructor: string;
  firstName: string;
  lastName: string;
  middleInit: string | null;
};

/**
 * Fetches one page of a term's grades using a true keyset seek.
 *
 * This is raw SQL on purpose. Prisma's `cursor` does not generate a row
 * comparison — its engine emits an OR-tree such as
 *   (a = .. AND b = .. AND c >= ..) OR (a = .. AND b > ..) OR (a > ..)
 * plus correlated subqueries that re-read the cursor row. PostgreSQL cannot
 * turn that into a composite-index seek, so each page would still walk the
 * index from the start and discard everything before the cursor.
 *
 * A row comparison — ("studentNumber", "courseCode") > ($1, $2) — *can* be
 * served directly by the (academicYear, semester, studentNumber, courseCode)
 * index, so the seek is O(log n) instead of O(page offset).
 *
 * Every value is a bound parameter ($1..$6); nothing is interpolated.
 * The enums are cast explicitly because PostgreSQL will not compare a text
 * parameter to an enum column.
 */
async function fetchGradePage(
  academicYear: AcademicYear,
  semester: Semester,
  cursor: { studentNumber: string; courseCode: string } | null,
  take: number,
): Promise<RawExportRow[]> {
  // Two variants rather than one query with a conditionally-null cursor, so the
  // first page keeps a clean `Index Cond` on the term alone.
  if (!cursor) {
    return prisma.$queryRaw<RawExportRow[]>`
      SELECT g."studentNumber", g."courseCode", g."courseTitle",
             g."creditUnit", g."grade", g."reExam", g."remarks", g."instructor",
             s."firstName", s."lastName", s."middleInit"
      FROM "Grade" g
      JOIN "Student" s ON s."studentNumber" = g."studentNumber"
      WHERE g."academicYear" = ${academicYear}::"AcademicYear"
        AND g."semester" = ${semester}::"Semester"
      ORDER BY g."studentNumber" ASC, g."courseCode" ASC
      LIMIT ${take}
    `;
  }

  return prisma.$queryRaw<RawExportRow[]>`
    SELECT g."studentNumber", g."courseCode", g."courseTitle",
           g."creditUnit", g."grade", g."reExam", g."remarks", g."instructor",
           s."firstName", s."lastName", s."middleInit"
    FROM "Grade" g
    JOIN "Student" s ON s."studentNumber" = g."studentNumber"
    WHERE g."academicYear" = ${academicYear}::"AcademicYear"
      AND g."semester" = ${semester}::"Semester"
      AND (g."studentNumber", g."courseCode") > (${cursor.studentNumber}, ${cursor.courseCode})
    ORDER BY g."studentNumber" ASC, g."courseCode" ASC
    LIMIT ${take}
  `;
}

/** Adapts a raw row to the shape the row mapper expects. */
function toGradeWithStudent(row: RawExportRow): GradeWithStudent {
  return {
    studentNumber: row.studentNumber,
    courseCode: row.courseCode,
    courseTitle: row.courseTitle,
    creditUnit: row.creditUnit,
    grade: row.grade,
    reExam: row.reExam,
    remarks: row.remarks,
    instructor: row.instructor,
    student: {
      studentNumber: row.studentNumber,
      firstName: row.firstName,
      lastName: row.lastName,
      middleInit: row.middleInit,
    },
  };
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
    // Page through the term with a KEYSET (seek) pagination loop.
    //
    // The ordering key is (studentNumber, courseCode), which is a total order
    // within one (academicYear, semester) term because of the
    // @@unique([studentNumber, courseCode, academicYear, semester]) constraint.
    // Seeking strictly past the last row of the previous page therefore cannot
    // duplicate or skip rows, unlike OFFSET which both re-scans everything
    // before the offset and shifts when rows change mid-export.
    //
    // The seek itself is issued as raw SQL (see fetchGradePage) because
    // Prisma's query builder cannot emit a row comparison.
    const rows: ReturnType<typeof toGradeExportRows> = [];
    let cursor: { studentNumber: string; courseCode: string } | null = null;

    for (;;) {
      const page = await fetchGradePage(
        where.academicYear,
        where.semester,
        cursor,
        EXPORT_PAGE_SIZE,
      );

      if (page.length === 0) break;

      rows.push(...toGradeExportRows(page.map(toGradeWithStudent)));

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
