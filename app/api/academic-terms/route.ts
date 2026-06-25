export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentNumber = searchParams.get("studentNumber");

    // Always fetch all configured academic terms as the base set.
    // This ensures admins/registrars can add grades for ANY term,
    // even when a student has no existing grades yet.
    const [allTerms, studentTerms] = await Promise.all([
      prisma.academicTerm.findMany({
        select: { academicYear: true, semester: true },
        orderBy: { academicYear: "desc" },
      }),
      studentNumber
        ? prisma.grade.findMany({
            where: { studentNumber },
            select: { academicYear: true, semester: true },
            distinct: ["academicYear", "semester"],
          })
        : Promise.resolve([]),
    ]);

    // Merge student-specific terms with all configured terms (deduplicate)
    const termSet = new Map<string, { academicYear: string; semester: string }>();
    for (const t of allTerms) {
      const key = `${t.academicYear}_${t.semester}`;
      termSet.set(key, t);
    }
    for (const t of studentTerms) {
      const key = `${t.academicYear}_${t.semester}`;
      if (!termSet.has(key)) {
        termSet.set(key, t);
      }
    }

    // Sort descending by academicYear
    const terms = Array.from(termSet.values()).sort((a, b) =>
      b.academicYear.localeCompare(a.academicYear),
    );

    return NextResponse.json(terms);
  } catch (error) {
    console.error("Error fetching academic terms:", error);
    return NextResponse.json(
      { message: "Error fetching academic terms" },
      { status: 500 }
    );
  }
}
