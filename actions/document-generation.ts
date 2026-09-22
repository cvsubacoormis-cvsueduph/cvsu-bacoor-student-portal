"use server";

import { checkRateLimitRedis } from "@/lib/rate-limit-redis";
import { getStudentGradesForTerm } from "@/actions/student-grades/student-grades";
import { getStudentCurriculum } from "@/actions/getStudentCurriculum";
import { canGenerateCOG, COG_FORBIDDEN_MESSAGE } from "@/lib/cog-roles";
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

    // Fetch this term's grades for the calling student.
    // getStudentGradesForTerm resolves a student caller to their own record, so
    // no id needs to be passed — and the term filter is applied in the query.
    const { userId } = await auth();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const result = await getStudentGradesForTerm(
      userId,
      academicYear,
      semester,
    );
    if (result.hidden) {
      throw new Error("Grades are currently hidden by the faculty");
    }
    if (!result.student) {
      throw new Error(result.error || "Student data not found");
    }
    const student = result.student;

    if (student.grades.length === 0) {
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
        grades: student.grades,
      },
    };
  } catch (error) {
    console.error("[generateCOGWithRateLimit] Error:", error);
    
    // Capture the actual error for debugging
    if (error instanceof Error) {
      console.error("[generateCOGWithRateLimit] Error name:", error.name);
      console.error("[generateCOGWithRateLimit] Error message:", error.message);
      console.error("[generateCOGWithRateLimit] Stack:", error.stack);
      
      // Pass through the original message for better user feedback
      throw new Error(error.message);
    }
    throw new Error("Unable to generate COG. Please try again.");
  }
}

/**
 * Rate-limited action for admin/registrar to generate COG for a student.
 *
 * Access is intentionally narrow: only `admin` and `registrar` may generate a
 * COG. This is the authoritative gate — the UI hides the control for other
 * roles, but the action re-checks so it cannot be invoked directly.
 *
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

  // Check user role against the shared COG gate.
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const role = user.publicMetadata?.role;

  if (!canGenerateCOG(role)) {
    throw new Error(COG_FORBIDDEN_MESSAGE);
  }

  if (!academicYear || !semester) {
    throw new Error("An academic year and semester are required");
  }

  // Check rate limit using Redis
  await checkRateLimitRedis({
    action: "generate_cog_admin",
    limit: RATE_LIMITS.generate_cog_admin.limit,
    windowSeconds: RATE_LIMITS.generate_cog_admin.windowSeconds,
  });

  // Fetch grades for exactly this student and term. Pushing the term filter
  // into the query is what guarantees a COG never carries another term's grades.
  const admResult = await getStudentGradesForTerm(
    studentId,
    academicYear,
    semester,
  );
  if (admResult.hidden) {
    throw new Error("Grades are currently hidden by the faculty");
  }
  if (!admResult.student) {
    throw new Error(admResult.error || "Student data not found");
  }
  const student = admResult.student;

  if (student.grades.length === 0) {
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
      grades: student.grades,
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
