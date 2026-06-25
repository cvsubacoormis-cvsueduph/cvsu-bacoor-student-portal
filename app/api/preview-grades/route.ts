import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AcademicYear, Semester } from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit-postgres";
import { z } from "zod";

export const runtime = "nodejs";

// Roles that can modify grades without approval
const DIRECT_MODIFY_ROLES = ["admin", "superuser", "registrar"];

// Roles that can modify grades (includes those needing approval)
const ALL_MODIFY_ROLES = [...DIRECT_MODIFY_ROLES, "registrar_staff"];

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------
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
  creditUnit: z.number().int().min(0, "Credit unit must be non-negative"),
  courseTitle: z.string().min(1, "Course title is required"),
  grade: z.string().min(1, "Grade is required"),
  reExam: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  instructor: z.string().min(1, "Instructor is required"),
});

const postBodySchema = patchBodySchema.extend({
  studentNumber: z.string().min(1, "Student number is required"),
  academicYear: z.nativeEnum(AcademicYear, {
    errorMap: () => ({ message: "Invalid academic year" }),
  }),
  semester: z.nativeEnum(Semester, {
    errorMap: () => ({ message: "Invalid semester" }),
  }),
  creditUnit: z.number().int().min(0, "Credit unit must be non-negative"),
});

// ---------------------------------------------------------------------------
// Helper: create a pending grade change for registrar_staff
// ---------------------------------------------------------------------------
async function createPendingChange(params: {
  action: string;
  studentNumber: string;
  gradeData: Record<string, unknown>;
  gradeId?: string;
  courseCode?: string;
  academicYear?: string;
  semester?: string;
  requestedById: string;
  requestedByName: string;
  requestedRole: string;
}) {
  return prisma.pendingGradeChange.create({
    data: {
      action: params.action,
      studentNumber: params.studentNumber,
      gradeData: params.gradeData as any,
      gradeId: params.gradeId ?? null,
      courseCode: params.courseCode ?? null,
      academicYear: (params.academicYear as AcademicYear) ?? null,
      semester: (params.semester as Semester) ?? null,
      requestedById: params.requestedById,
      requestedByName: params.requestedByName,
      requestedRole: params.requestedRole,
      status: "PENDING",
    },
  });
}

// ---------------------------------------------------------------------------
// GET — Fetch grades for a student + term
// ---------------------------------------------------------------------------
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
      console.error("Rate limiter error (non-blocking):", error.message);
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
    const role = (sessionClaims?.metadata as { role?: string })?.role;

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

// ---------------------------------------------------------------------------
// PATCH — Update an existing grade
//   - registrar_staff → pending approval
//   - admin/superuser/registrar → applied immediately
// ---------------------------------------------------------------------------
export async function PATCH(request: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (sessionClaims?.metadata as { role?: string })?.role;
    if (!role || !ALL_MODIFY_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions" },
        { status: 403 }
      );
    }

    // Rate limiting
    try {
      await checkRateLimit({
        action: "preview-grades-patch",
        limit: 60,
        windowSeconds: 60,
      });
    } catch (error: any) {
      if (error.code === "RATE_LIMIT_EXCEEDED") {
        return NextResponse.json({ error: error.message }, { status: 429 });
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

    const { courseCode, creditUnit, courseTitle, grade, reExam, remarks, instructor } =
      validationResult.data;

    const user = await currentUser();
    const editorIdentifier = user?.fullName ?? "";
    const isRegistrarStaff = role === "registrar_staff";

    // Fetch the existing grade to get its studentNumber / term AND full current values
    const existingGrade = await prisma.grade.findUnique({
      where: { id },
      select: {
        id: true,
        studentNumber: true,
        academicYear: true,
        semester: true,
        courseCode: true,
        creditUnit: true,
        courseTitle: true,
        grade: true,
        reExam: true,
        remarks: true,
        instructor: true,
      },
    });
    if (!existingGrade) {
      return NextResponse.json({ error: "Grade not found" }, { status: 404 });
    }

    // ------------------------------------------------------------------
    // registrar_staff → create pending change instead of applying directly
    // ------------------------------------------------------------------
    if (isRegistrarStaff) {
      const pending = await createPendingChange({
        action: "UPDATE",
        studentNumber: existingGrade.studentNumber,
        gradeData: {
          courseCode,
          creditUnit,
          courseTitle,
          grade,
          reExam: reExam === "" ? null : reExam,
          remarks,
          instructor,
          // Store current values for diff display on approvals page
          _previous: {
            courseCode: existingGrade.courseCode,
            creditUnit: existingGrade.creditUnit,
            courseTitle: existingGrade.courseTitle,
            grade: existingGrade.grade,
            reExam: existingGrade.reExam,
            remarks: existingGrade.remarks,
            instructor: existingGrade.instructor,
          },
        },
        gradeId: id,
        courseCode: existingGrade.courseCode,
        academicYear: existingGrade.academicYear,
        semester: existingGrade.semester,
        requestedById: userId,
        requestedByName: editorIdentifier,
        requestedRole: role,
      });

      return NextResponse.json(
        { pending: true, id: pending.id, message: "Grade update submitted for approval" },
        { status: 202 }
      );
    }

    // ------------------------------------------------------------------
    // admin / superuser / registrar → apply immediately
    // ------------------------------------------------------------------
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

    const updatedGrade = await prisma.grade.update({ where: { id }, data });

    // Audit trail
    await prisma.gradeLog.create({
      data: {
        studentNumber: existingGrade.studentNumber,
        courseCode,
        courseTitle,
        creditUnit,
        grade,
        remarks,
        instructor,
        academicYear: existingGrade.academicYear,
        semester: existingGrade.semester,
        action: "UPDATED",
      },
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

// ---------------------------------------------------------------------------
// POST — Create a new grade
//   - registrar_staff → pending approval
//   - admin/superuser/registrar → applied immediately
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (sessionClaims?.metadata as { role?: string })?.role;
    if (!role || !ALL_MODIFY_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions" },
        { status: 403 }
      );
    }

    try {
      await checkRateLimit({
        action: "preview-grades-post",
        limit: 30,
        windowSeconds: 60,
      });
    } catch (error: any) {
      if (error.code === "RATE_LIMIT_EXCEEDED") {
        return NextResponse.json({ error: error.message }, { status: 429 });
      }
      throw error;
    }

    const body = await request.json();
    const validationResult = postBodySchema.safeParse(body);
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
      studentNumber,
      academicYear,
      semester,
      courseCode,
      creditUnit,
      courseTitle,
      grade,
      reExam,
      remarks,
      instructor,
    } = validationResult.data;

    const user = await currentUser();
    const editorIdentifier = user?.fullName ?? "";
    const isRegistrarStaff = role === "registrar_staff";

    // ------------------------------------------------------------------
    // registrar_staff → create pending change
    // ------------------------------------------------------------------
    if (isRegistrarStaff) {
      const pending = await createPendingChange({
        action: "CREATE",
        studentNumber,
        gradeData: {
          courseCode,
          creditUnit,
          courseTitle,
          grade,
          reExam: reExam === "" ? null : reExam,
          remarks,
          instructor,
          studentNumber,
          academicYear,
          semester,
          uploadedBy: editorIdentifier,
        },
        courseCode,
        academicYear,
        semester,
        requestedById: userId,
        requestedByName: editorIdentifier,
        requestedRole: role,
      });

      return NextResponse.json(
        { pending: true, id: pending.id, message: "Grade creation submitted for approval" },
        { status: 202 }
      );
    }

    // ------------------------------------------------------------------
    // admin / superuser / registrar → apply immediately
    // ------------------------------------------------------------------
    await prisma.academicTerm.upsert({
      where: { academicYear_semester: { academicYear, semester } },
      create: { academicYear, semester },
      update: {},
    });

    const newGrade = await prisma.grade.upsert({
      where: {
        studentNumber_courseCode_academicYear_semester: {
          studentNumber,
          courseCode,
          academicYear,
          semester,
        },
      },
      create: {
        studentNumber,
        academicYear,
        semester,
        courseCode,
        creditUnit,
        courseTitle,
        grade,
        reExam: reExam === "" ? null : reExam,
        remarks,
        instructor,
        uploadedBy: editorIdentifier,
      },
      update: {
        creditUnit,
        courseTitle,
        grade,
        reExam: reExam === "" ? null : reExam,
        remarks,
        instructor,
        uploadedBy: editorIdentifier,
      },
    });

    await prisma.gradeLog.create({
      data: {
        studentNumber,
        courseCode,
        courseTitle,
        creditUnit,
        grade,
        remarks,
        instructor,
        academicYear,
        semester,
        action: "MANUAL_ENTRY",
      },
    });

    return NextResponse.json(newGrade, { status: 201 });
  } catch (error) {
    console.error("Error creating grade:", error);
    return NextResponse.json(
      { error: "Failed to create grade" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Delete a grade
//   - registrar_staff → pending approval
//   - admin/superuser/registrar → applied immediately
// ---------------------------------------------------------------------------
export async function DELETE(request: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (sessionClaims?.metadata as { role?: string })?.role;
    if (!role || !ALL_MODIFY_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions" },
        { status: 403 }
      );
    }

    try {
      await checkRateLimit({
        action: "preview-grades-delete",
        limit: 30,
        windowSeconds: 60,
      });
    } catch (error: any) {
      if (error.code === "RATE_LIMIT_EXCEEDED") {
        return NextResponse.json({ error: error.message }, { status: 429 });
      }
      throw error;
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const user = await currentUser();
    const editorIdentifier = user?.fullName ?? "";
    const isRegistrarStaff = role === "registrar_staff";

    // Fetch the existing grade for its data (needed for both paths)
    const existingGrade = await prisma.grade.findUnique({
      where: { id },
      select: {
        id: true,
        studentNumber: true,
        academicYear: true,
        semester: true,
        courseCode: true,
        creditUnit: true,
        courseTitle: true,
        grade: true,
        remarks: true,
        instructor: true,
      },
    });
    if (!existingGrade) {
      return NextResponse.json({ error: "Grade not found" }, { status: 404 });
    }

    // ------------------------------------------------------------------
    // registrar_staff → create pending change
    // ------------------------------------------------------------------
    if (isRegistrarStaff) {
      const pending = await createPendingChange({
        action: "DELETE",
        studentNumber: existingGrade.studentNumber,
        gradeData: {
          courseCode: existingGrade.courseCode,
          creditUnit: existingGrade.creditUnit,
          courseTitle: existingGrade.courseTitle,
          grade: existingGrade.grade,
          remarks: existingGrade.remarks,
          instructor: existingGrade.instructor,
        },
        gradeId: id,
        courseCode: existingGrade.courseCode,
        academicYear: existingGrade.academicYear,
        semester: existingGrade.semester,
        requestedById: userId,
        requestedByName: editorIdentifier,
        requestedRole: role,
      });

      return NextResponse.json(
        { pending: true, id: pending.id, message: "Grade deletion submitted for approval" },
        { status: 202 }
      );
    }

    // ------------------------------------------------------------------
    // admin / superuser / registrar → delete immediately
    // ------------------------------------------------------------------
    // Create audit log BEFORE deletion so we have the data
    await prisma.gradeLog.create({
      data: {
        studentNumber: existingGrade.studentNumber,
        courseCode: existingGrade.courseCode,
        courseTitle: existingGrade.courseTitle,
        creditUnit: existingGrade.creditUnit,
        grade: existingGrade.grade,
        remarks: existingGrade.remarks,
        instructor: existingGrade.instructor,
        academicYear: existingGrade.academicYear,
        semester: existingGrade.semester,
        action: "DELETED",
      },
    });

    await prisma.grade.delete({ where: { id } });

    return NextResponse.json({ message: "Grade deleted successfully" });
  } catch (error) {
    console.error("Error deleting grade:", error);
    return NextResponse.json(
      { error: "Failed to delete grade" },
      { status: 500 }
    );
  }
}
