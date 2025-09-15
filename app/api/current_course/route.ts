import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentNumber = searchParams.get("studentNumber");

  if (!studentNumber) {
    return NextResponse.json(
      { error: "Student number is required" },
      { status: 400 }
    );
  }

  try {
    const student = await prisma.student.findUnique({
      where: { studentNumber: String(studentNumber) },
      select: { course: true, major: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json(student, { status: 200 });
  } catch (error) {
    console.error("Error fetching student data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
