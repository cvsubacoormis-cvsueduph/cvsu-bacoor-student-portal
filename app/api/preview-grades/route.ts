import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AcademicYear, Semester } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const studentNumber = searchParams.get("studentNumber");
  const academicYear = searchParams.get("academicYear");
  const semester = searchParams.get("semester");

  // Ensure all required parameters are provided
  if (!studentNumber || !academicYear || !semester) {
    return NextResponse.json(
      { error: "Missing query parameters" },
      { status: 400 }
    );
  }

  // Convert studentNumber to a number

  try {
    // Query the database for matching grade records.
    // We include the related student's firstName and lastName for filtering.
    const grades = await prisma.grade.findMany({
      where: {
        studentNumber,
        academicYear: academicYear as AcademicYear,
        semester: semester as Semester,
      },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Map each grade record to include firstName and lastName at the top level.
    const mappedGrades = grades.map((grade) => ({
      ...grade,
      firstName: grade.student.firstName,
      lastName: grade.student.lastName,
    }));

    return NextResponse.json(mappedGrades);
  } catch (error) {
    console.error("Error fetching grades:", error);
    return NextResponse.json(
      { error: "Failed to fetch grades" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "id is required" }, { status: 400 });
  }

  try {
    // Destructure only the updatable fields from the request body.
    const {
      courseCode,
      creditUnit,
      courseTitle,
      grade,
      reExam,
      remarks,
      instructor,
    } = await request.json();

    // Optionally, convert or validate fields here
    const data = {
      courseCode,
      creditUnit,
      courseTitle,
      grade,
      reExam: reExam === "" ? null : reExam, // keep reExam as a string
      remarks,
      instructor,
    };

    const updatedGrade = await prisma.grade.update({
      where: { id },
      data,
    });

    return NextResponse.json(updatedGrade);
  } catch (error) {
    console.error("Error updating grade:", error);
    return NextResponse.json(
      { message: "Failed to update grade" },
      { status: 500 }
    );
  }
}
