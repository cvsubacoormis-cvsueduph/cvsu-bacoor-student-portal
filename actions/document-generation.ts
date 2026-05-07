"use server";

import { checkRateLimitRedis } from "@/lib/rate-limit-redis";
import { getStudentGradesWithReExam } from "@/actions/student-grades/student-grades";
import { getStudentCurriculum } from "@/actions/getStudentCurriculum";
import { auth, clerkClient } from "@clerk/nextjs/server";

// Rate limit configuration for document generation
const RATE_LIMITS = {
  generate_cog: { limit: 5, windowSeconds: 60 }, // 5 requests per minute for COG
  generate_cog_admin: { limit: 10, windowSeconds: 60 }, // 10 requests per minute for admin
  generate_checklist: { limit: 5, windowSeconds: 60 }, // 5 requests per minute for checklist
};

/**
 * Rate-limited action for students to generate their Certificate of Grades (COG)
 * @param academicYear - Academic year to filter grades
 * @param semester - Semester to filter grades
 * @returns Student data with filtered grades
 */
export async function generateCOGWithRateLimit(
  academicYear: string,
  semester: string,
) {
  try {
    // Check rate limit using Redis
    await checkRateLimitRedis({
      action: "generate_cog",
      limit: RATE_LIMITS.generate_cog.limit,
      windowSeconds: RATE_LIMITS.generate_cog.windowSeconds,
    });

    // Fetch student grades (this also has its own rate limiting)
    const { student } = await getStudentGradesWithReExam();

    // Filter grades by academic year and semester
    const filteredGrades = student.grades.filter(
      (g) => g.academicYear === academicYear && g.semester === semester,
    );

    if (filteredGrades.length === 0) {
      throw new Error("No grades found for this academic term");
    }

    return {
      student: {
        studentNumber: student.studentNumber,
        firstName: student.firstName,
        middleInit: student.middleInit,
        lastName: student.lastName,
        course: student.course,
        major: student.major,
        grades: filteredGrades,
      },
    };
  } catch (error) {
    console.error("[generateCOGWithRateLimit] Error:", error);
    if (error instanceof Error) {
      throw new Error(`COG generation failed: ${error.message}`);
    }
    throw new Error("COG generation failed: Unknown error");
  }
}

/**
 * Rate-limited action for admin/faculty to generate COG for a student
 * @param studentId - The student ID to generate COG for
 * @param academicYear - Academic year to filter grades
 * @param semester - Semester to filter grades
 * @returns Student data with filtered grades
 */
export async function generateCOGAdminWithRateLimit(
  studentId: string,
  academicYear: string,
  semester: string,
) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Check user role
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const role = user.publicMetadata?.role;

  if (role !== "admin" && role !== "faculty" && role !== "registrar") {
    throw new Error(
      "Forbidden: Only admins, faculty, and registrar can generate COG",
    );
  }

  // Check rate limit using Redis
  await checkRateLimitRedis({
    action: "generate_cog_admin",
    limit: RATE_LIMITS.generate_cog_admin.limit,
    windowSeconds: RATE_LIMITS.generate_cog_admin.windowSeconds,
  });

  // Fetch student grades for the specific student
  const { student } = await getStudentGradesWithReExam(studentId);

  // Filter grades by academic year and semester
  const filteredGrades = student.grades.filter(
    (g) => g.academicYear === academicYear && g.semester === semester,
  );

  if (filteredGrades.length === 0) {
    throw new Error("No grades found for this academic term");
  }

  return {
    student: {
      studentNumber: student.studentNumber,
      firstName: student.firstName,
      middleInit: student.middleInit,
      lastName: student.lastName,
      course: student.course,
      major: student.major,
      grades: filteredGrades,
    },
  };
}

/**
 * Rate-limited action for students to generate their Checklist of Courses
 * @returns Student curriculum data with grades
 */
export async function generateChecklistWithRateLimit() {
  // Check rate limit using Redis
  await checkRateLimitRedis({
    action: "generate_checklist",
    limit: RATE_LIMITS.generate_checklist.limit,
    windowSeconds: RATE_LIMITS.generate_checklist.windowSeconds,
  });

  // Fetch student curriculum data
  const curriculumData = await getStudentCurriculum();

  if (!curriculumData || !curriculumData.curriculum.length) {
    throw new Error("No curriculum data found");
  }

  return curriculumData;
}

/**
 * Get current rate limit status for a specific action
 * Useful for UI to show remaining requests
 */
export async function getRateLimitInfo(action: keyof typeof RATE_LIMITS) {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  // This would require adding a method to get current count
  // For now, return the configuration
  return {
    limit: RATE_LIMITS[action].limit,
    windowSeconds: RATE_LIMITS[action].windowSeconds,
  };
}
