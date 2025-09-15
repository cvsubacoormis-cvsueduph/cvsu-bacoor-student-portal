import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { AcademicYear, Semester } from "@prisma/client";

export async function GET(request: Request) {
  // Parse query parameters from the URL
  const { searchParams } = new URL(request.url);
  const academicYear = searchParams.get("academicYear");
  const semester = searchParams.get("semester");

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure that term values are provided
  if (!academicYear || !semester) {
    return NextResponse.json(
      { error: "Missing academicYear or semester" },
      { status: 400 }
    );
  }

  // Query the student and filter the grades by academicYear and semester.
  // The filtering here depends on your Prisma schema.
  const student = await prisma.student.findUnique({
    where: { id: userId },
    include: {
      grades: {
        where: {
          academicYear: academicYear as AcademicYear, // Casting to match enum type if needed
          semester: semester as Semester,
        },
      },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  return NextResponse.json(student);
}
