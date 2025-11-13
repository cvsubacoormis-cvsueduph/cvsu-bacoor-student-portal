"use server";

import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit-postgres";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { AcademicYear, Semester } from "@prisma/client";

const clerk = await clerkClient();

export async function getGrades(year?: string, semester?: string) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  await checkRateLimit({
    action: "getGrades",
    limit: 7,
    windowSeconds: 60,
  });

  const student = await prisma.student.findUnique({
    where: { id: userId },
    include: {
      grades: {
        where: {
          academicYear: year as AcademicYear,
          semester: semester as Semester,
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

  await checkRateLimit({
    action: "getStudentGradesWithReExam",
    limit: 7,
    windowSeconds: 60,
  });

  const student = await prisma.student.findUnique({
    where: { id: studentId || userId },
    select: {
      studentNumber: true,
      firstName: true,
      lastName: true,
      middleInit: true,
      course: true,
      major: true,
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
