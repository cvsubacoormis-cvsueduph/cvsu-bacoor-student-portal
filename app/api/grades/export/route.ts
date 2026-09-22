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

/** Hard cap mirroring the upload parser's 5,000-row batch limit. */
const MAX_EXPORT_ROWS = 5_000;

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
    const { _count } = await prisma.grade.aggregate({
      where: { academicYear: academicYear as AcademicYear, semester: semester as Semester },
      _count: { _all: true },
    });
    const totalForTerm = _count._all;

    const grades = await prisma.grade.findMany({
      where: {
        academicYear: academicYear as AcademicYear,
        semester: semester as Semester,
      },
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
      take: MAX_EXPORT_ROWS,
    });

    if (grades.length === 0) {
      return NextResponse.json(
        { error: "No grades found for the selected academic year and semester." },
        { status: 404 },
      );
    }

    const rows = toGradeExportRows(grades);

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [...GRADE_EXPORT_HEADERS],
    });
    worksheet["!cols"] = GRADE_EXPORT_COLUMN_WIDTHS;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, GRADE_EXPORT_SHEET_NAME);

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;

    const truncated = totalForTerm > MAX_EXPORT_ROWS;

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
        // Surfaced so the UI can warn rather than silently emitting a partial file.
        "X-Export-Truncated": String(truncated),
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
