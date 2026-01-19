import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AcademicYear, Semester } from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit-postgres";
import { z } from "zod";

export const runtime = "nodejs";

// Validation schemas
const getQuerySchema = z.object({
  studentNumber: z.string().min(1, "Student number is required"),
  academicYear: z.nativeEnum(AcademicYear, {
    errorMap: () => ({ message: "Invalid academic year" }),
  }),
  semester: z.nativeEnum(Semester, {
    errorMap: () => ({ message: "Invalid semester" }),
  }),
});

const patchBodySchema = z.object({
  courseCode: z.string().min(1, "Course code is required"),
  creditUnit: z.number().int().positive("Credit unit must be positive"),
  courseTitle: z.string().min(1, "Course title is required"),
  grade: z.string().min(1, "Grade is required"),
  reExam: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  instructor: z.string().min(1, "Instructor is required"),
});

export async function GET(request: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      await checkRateLimit({
        action: "preview-grades-get",
        limit: 20,
        windowSeconds: 60,
      });
    } catch (error: any) {
      if (error.code === "RATE_LIMIT_EXCEEDED") {
        return NextResponse.json(
          { error: error.message },
          { status: 429 }
        );
      }
      throw error;
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const studentNumber = searchParams.get("studentNumber");
    const academicYear = searchParams.get("academicYear");
    const semester = searchParams.get("semester");

    const validationResult = getQuerySchema.safeParse({
      studentNumber,
      academicYear,
      semester,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { studentNumber: validStudentNumber, academicYear: validAcademicYear, semester: validSemester } = validationResult.data;

    // Authorization - Role-based access control
    const role = (sessionClaims?.publicMetadata as { role?: string })?.role;

    // Students can only view their own grades
    if (role === "student") {
      const student = await prisma.student.findUnique({
        where: { id: userId },
        select: { studentNumber: true },
      });

      if (!student || student.studentNumber !== validStudentNumber) {
        return NextResponse.json(
          { error: "Forbidden: You can only view your own grades" },
          { status: 403 }
        );
      }
    }
    // Admin and other authorized roles can view any student's grades
    // (no additional check needed for admin/faculty/registrar)

    // Query the database for matching grade records
    const grades = await prisma.grade.findMany({
      where: {
        studentNumber: validStudentNumber,
        academicYear: validAcademicYear,
        semester: validSemester,
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

    // Map each grade record to include firstName and lastName at the top level
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
  try {
    // Authentication check
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Authorization - Only admin and authorized staff can edit grades
    const role = (sessionClaims?.publicMetadata as { role?: string })?.role;

    if (role === "student") {
      return NextResponse.json(
        { error: "Forbidden: Students cannot edit grades" },
        { status: 403 }
      );
    }

    // Rate limiting - stricter for PATCH (5 requests per minute)
    try {
      await checkRateLimit({
        action: "preview-grades-patch",
        limit: 60,
        windowSeconds: 60,
      });
    } catch (error: any) {
      if (error.code === "RATE_LIMIT_EXCEEDED") {
        return NextResponse.json(
          { error: error.message },
          { status: 429 }
        );
      }
      throw error;
    }

    // Validate ID parameter
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = patchBodySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      courseCode,
      creditUnit,
      courseTitle,
      grade,
      reExam,
      remarks,
      instructor,
    } = validationResult.data;

    // Get user email or username for audit trail
    const user = await currentUser();
    const editorIdentifier = user?.fullName ?? "";

    // Update the grade record
    const data = {
      courseCode,
      creditUnit,
      courseTitle,
      grade,
      reExam: reExam === "" ? null : reExam,
      remarks,
      instructor,
      uploadedBy: editorIdentifier,
    };

    const updatedGrade = await prisma.grade.update({
      where: { id },
      data,
    });

    return NextResponse.json(updatedGrade);
  } catch (error) {
    console.error("Error updating grade:", error);
    return NextResponse.json(
      { error: "Failed to update grade" },
      { status: 500 }
    );
  }
}
