export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentNumber = searchParams.get("studentNumber");

    let terms;

    if (studentNumber) {
      terms = await prisma.grade.findMany({
        where: {
          studentNumber: studentNumber,
        },
        select: {
          academicYear: true,
          semester: true,
        },
        distinct: ["academicYear", "semester"],
        orderBy: {
          academicYear: "desc",
        },
      });
    } else {
      terms = await prisma.academicTerm.findMany({
        select: {
          academicYear: true,
          semester: true,
        },
      });
    }

    return NextResponse.json(terms);
  } catch (error) {
    console.error("Error fetching academic terms:", error);
    return NextResponse.json(
      { message: "Error fetching academic terms" },
      { status: 500 }
    );
  }
}
