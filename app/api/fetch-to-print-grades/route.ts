import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AcademicYear, Semester } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
export const runtime = "nodejs";


export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Parse query parameters from the request URL
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const academicYear = searchParams.get("academicYear");
  const semester = searchParams.get("semester");

  // Ensure all required parameters are provided
  if (!studentId || !academicYear || !semester) {
    return NextResponse.json(
      { error: "Missing query parameters" },
      { status: 400 }
    );
  }

  try {
    // Query the database for the student and include their grades
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        grades: {
          where: {
            academicYear: academicYear as AcademicYear,
            semester: semester as Semester,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json(student);
  } catch (error) {
    console.error("Error fetching student and grades:", error);
    return NextResponse.json(
      { error: "Failed to fetch student and grades" },
      { status: 500 }
    );
  }
}
