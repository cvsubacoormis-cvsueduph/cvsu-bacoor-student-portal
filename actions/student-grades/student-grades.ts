"use server";

import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit-postgres";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { AcademicYear, Semester } from "@prisma/client";
import { getSetting } from "@/actions/settings";

const clerk = await clerkClient();

/**
 * Guard: if user is a student and grades are hidden by faculty/admin, throw GRADES_HIDDEN.
 * Non-student roles (admin, superuser, faculty, registrar) always bypass this check.
 */
async function enforceGradeVisibility(userId: string): Promise<void> {
  const user = await clerk.users.getUser(userId);
  const role = user.publicMetadata?.role;

  // Only block students — faculty/admins/registrars always see grades
  if (role !== "student") return;

  const isVisible = await getSetting("GRADES_VISIBLE_TO_STUDENTS");
  if (isVisible === "false") {
    throw new Error("GRADES_HIDDEN");
  }
}

export async function getGrades(year?: AcademicYear, semester?: Semester) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const user = await clerk.users.getUser(userId);
  const role = user.publicMetadata?.role;

  if (
    role !== "student" &&
    role !== "admin" &&
    role !== "faculty" &&
    role !== "registrar"
  ) {
    throw new Error("Forbidden: Only students and admins can access this page");
  }

  // Block students from viewing grades if faculty has hidden them
  await enforceGradeVisibility(userId);

  await checkRateLimit({
    action: "getGrades",
    limit: 10,
    windowSeconds: 60,
  });

  const student = await prisma.student.findUnique({
    where: { id: userId },
    include: {
      grades: {
        where: {
          academicYear: year,
          semester: semester,
        },
        orderBy: [{ courseCode: "asc" }],
      },
    },
  });

  if (!student) throw new Error("Student not found");

  return student.grades;
}

export async function getStudentGradesWithReExam(studentId?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const clerk = await clerkClient();

  const user = await clerk.users.getUser(userId);
  const role = user.publicMetadata?.role;

  if (
    role !== "student" &&
    role !== "admin" &&
    role !== "faculty" &&
    role !== "registrar"
  ) {
    throw new Error("Forbidden");
  }

  // Block students from viewing grades if faculty has hidden them
  // Admin/faculty/registrar always bypass this check
  if (role === "student") {
    await enforceGradeVisibility(userId);
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId || userId },
    select: {
      studentNumber: true,
      firstName: true,
      lastName: true,
      middleInit: true,
      course: true,
      major: true,
      address: true,
      phone: true,
      grades: {
        orderBy: [
          { academicYear: "asc" },
          { semester: "asc" },
          { courseCode: "asc" },
        ],
        select: {
          courseCode: true,
          courseTitle: true,
          creditUnit: true,
          grade: true,
          reExam: true,
          remarks: true,
          instructor: true,
          attemptNumber: true,
          isRetaken: true,
          retakenAYSem: true,
          academicYear: true,
          semester: true,
        },
      },
    },
  });

  if (!student) throw new Error("Student not found");

  return { student };
}

export async function getAvailableAcademicOptions() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await clerk.users.getUser(userId);
  const role = user.publicMetadata.role;

  if (!role) throw new Error("Role not found");

  if (role === "student") {
    // For students — filter by their own grades
    const student = await prisma.student.findUnique({
      where: { id: userId },
      select: {
        grades: {
          distinct: ["academicYear", "semester"],
          select: { academicYear: true, semester: true },
        },
      },
    });

    if (!student) throw new Error("Student not found");
    return student.grades;
  } else if (role === "faculty" || role === "admin" || role === "registrar") {
    const allOptions = await prisma.grade.findMany({
      distinct: ["academicYear", "semester"],
      select: { academicYear: true, semester: true },
    });

    return allOptions;
  }

  throw new Error("Unauthorized role");
}
