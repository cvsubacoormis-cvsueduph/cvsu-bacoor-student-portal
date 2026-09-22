"use server";

import prisma from "@/lib/prisma";
import { redis, withRedisFallback } from "@/lib/redis";
import { checkRateLimitRedis } from "@/lib/rate-limit-redis";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { AcademicYear, Semester, type Grade } from "@prisma/client";
import { getSetting } from "@/actions/settings";
import {
  studentGradesCacheKey,
  studentTermGradesCacheKey,
  studentGetGradesCacheKey,
} from "@/lib/cache-keys";

const clerk = await clerkClient();

/** Shape returned by {@link getGrades} so the client can distinguish data from control states. */
export type GetGradesResult =
  | { data: Grade[]; hidden: false; error: null }
  | { data: null; hidden: true; error: null }
  | { data: null; hidden: false; error: string };

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

export async function getGrades(
  year?: AcademicYear,
  semester?: Semester,
): Promise<GetGradesResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { data: null, hidden: false, error: "Unauthorized" };
    }

    const user = await clerk.users.getUser(userId);
    const role = user.publicMetadata?.role;

    if (
      role !== "student" &&
      role !== "admin" &&
      role !== "faculty" &&
      role !== "registrar" &&
      role !== "registrar_staff"
    ) {
      return {
        data: null,
        hidden: false,
        error: "Forbidden: Only students and admins can access this page",
      };
    }

    // Block students from viewing grades if faculty has hidden them
    if (role === "student") {
      const isVisible = await getSetting("GRADES_VISIBLE_TO_STUDENTS");
      if (isVisible === "false") {
        return { data: null, hidden: true, error: null };
      }
    }

    await checkRateLimitRedis({
      action: "getGrades",
      limit: 10,
      windowSeconds: 60,
    });

    // Cache key scoped to userId + year + semester to avoid collisions with other cached entities
    const cacheKey = studentGetGradesCacheKey(userId, year, semester);

    // Try Redis cache first (gracefully falls through on Redis failure)
    const cached = await withRedisFallback(async () => {
      const raw = await redis.get(cacheKey);
      return raw ? (JSON.parse(raw) as Grade[]) : null;
    });

    let grades: Grade[];
    if (cached) {
      grades = cached;
    } else {
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

      if (!student) {
        return { data: null, hidden: false, error: "Student not found" };
      }

      grades = student.grades;

      // Cache for 2 minutes (fire-and-forget)
      withRedisFallback(async () => {
        await redis.set(cacheKey, JSON.stringify(grades), "EX", 120);
      });
    }

    return { data: grades, hidden: false, error: null };
  } catch (err: unknown) {
    return {
      data: null,
      hidden: false,
      error:
        err instanceof Error ? err.message : "An unexpected error occurred",
    };
  }
}

/** Shape returned by {@link getStudentGradesWithReExam}. */
export type GetStudentWithGradesResult = {
  student: {
    studentNumber: string;
    firstName: string;
    lastName: string;
    middleInit: string | null;
    course: string;
    major: string | null;
    address: string;
    phone: string | null;
    grades: {
      courseCode: string;
      courseTitle: string;
      creditUnit: number;
      grade: string;
      reExam: string | null;
      remarks: string | null;
      instructor: string;
      attemptNumber: number;
      isRetaken: boolean;
      retakenAYSem: string | null;
      academicYear: string;
      semester: string;
      reassignedFromAYSem: string | null;
    }[];
  } | null;
  hidden: boolean;
  error: string | null;
};

/**
 * Roles permitted to read a student's grade history.
 * Kept as a module constant so every grade-reading action agrees on one list.
 */
const GRADE_READER_ROLES = [
  "student",
  "admin",
  "faculty",
  "registrar",
  "registrar_staff",
] as const;

type GradeReaderRole = (typeof GRADE_READER_ROLES)[number];

function isGradeReaderRole(role: unknown): role is GradeReaderRole {
  return GRADE_READER_ROLES.includes(role as GradeReaderRole);
}

export async function getStudentGradesWithReExam(
  studentId?: string,
): Promise<GetStudentWithGradesResult> {
  return resolveStudentGrades({ studentId });
}

/**
 * Reads one student's grades for exactly one academic term.
 *
 * Always hits the database for the requested (student, term) pair and caches
 * the result under a key that names *both*. This is the path used by COG
 * generation, where serving another term's grades is a correctness bug rather
 * than a mere cache miss.
 */
export async function getStudentGradesForTerm(
  studentId: string,
  academicYear: string,
  semester: string,
): Promise<GetStudentWithGradesResult> {
  return resolveStudentGrades({ studentId, term: { academicYear, semester } });
}

/**
 * Shared, role-gated grade resolver.
 *
 * Every cache key is derived from the *resolved* student id, so a request for
 * student B can never be answered from student A's cached payload.
 */
async function resolveStudentGrades({
  studentId,
  term,
}: {
  studentId?: string;
  term?: { academicYear: string; semester: string };
}): Promise<GetStudentWithGradesResult> {
  const { userId } = await auth();
  if (!userId) return { student: null, hidden: false, error: "Unauthorized" };

  const user = await clerk.users.getUser(userId);
  const role = user.publicMetadata?.role;

  if (!isGradeReaderRole(role)) {
    return { student: null, hidden: false, error: "Forbidden" };
  }

  // Block students from viewing grades if faculty has hidden them.
  // Admin/faculty/registrar always bypass this check.
  if (role === "student") {
    const isVisible = await getSetting("GRADES_VISIBLE_TO_STUDENTS");
    if (isVisible === "false") {
      return { student: null, hidden: true, error: null };
    }
  }

  // A student may only ever read their own record. Staff must name the student
  // they are acting on; falling back to the calling user would silently read
  // the wrong (staff) record and cache it under the staff id.
  const isStudent = role === "student";
  if (!isStudent && !studentId) {
    return { student: null, hidden: false, error: "Student id is required" };
  }
  const resolvedStudentId = isStudent ? userId : (studentId as string);

  const termFilter = term
    ? { academicYear: term.academicYear as AcademicYear, semester: term.semester as Semester }
    : undefined;

  const cacheKey = term
    ? studentTermGradesCacheKey(resolvedStudentId, term.academicYear, term.semester)
    : studentGradesCacheKey(resolvedStudentId);

  const cached = await withRedisFallback(async () => {
    const raw = await redis.get(cacheKey);
    return raw ? (JSON.parse(raw) as GetStudentWithGradesResult) : null;
  });

  if (cached) return cached;

  const student = await prisma.student.findUnique({
    where: { id: resolvedStudentId },
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
        where: termFilter,
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
          reassignedFromAYSem: true,
        },
      },
    },
  });

  if (!student)
    return { student: null, hidden: false, error: "Student not found" };

  const result: GetStudentWithGradesResult = {
    student,
    hidden: false,
    error: null,
  };

  // Fire-and-forget; a Redis failure must not block the response.
  await withRedisFallback(async () => {
    await redis.set(cacheKey, JSON.stringify(result), "EX", 300);
  });

  return result;
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

/**
 * Resolves a student number to the internal student id.
 *
 * Server actions and the COG flow key off the student id, while the View Grades
 * screen only knows the student number from its route. Resolving here keeps ids
 * out of the URL and out of client props.
 *
 * Only staff roles may look up an arbitrary student; a student caller always
 * resolves to their own record.
 */
export async function getStudentIdByNumber(
  studentNumber: string,
): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await clerk.users.getUser(userId);
  const role = user.publicMetadata?.role;

  if (!isGradeReaderRole(role)) return null;

  // A student can only ever resolve themselves.
  if (role === "student") {
    const self = await prisma.student.findUnique({
      where: { id: userId },
      select: { id: true, studentNumber: true },
    });
    return self && self.studentNumber === studentNumber ? self.id : null;
  }

  const student = await prisma.student.findUnique({
    where: { studentNumber },
    select: { id: true },
  });
  return student?.id ?? null;
}
