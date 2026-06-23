/**
 * Enrollment Bridge — Sync Engine
 *
 * Core logic that creates/links enrollment system User + Student records
 * for portal students. Called on student creation, registration, bulk upload,
 * and the bulk sync endpoint.
 *
 * Design decisions:
 * - Email is the linking key between systems
 * - Enrollment User records are created with PENDING_ACTIVATION status
 *   (students activate via the enrollment system's existing activation flow)
 * - Student.id in enrollment = User.id (matching the enrollment system's convention)
 * - All mutations use parameterized SQL — no SQL injection risk
 * - Idempotent: safe to call multiple times for the same student
 */

import { v4 as uuidv4 } from "uuid";
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { enrollmentQuery, enrollmentQueryOne } from "./db";
import {
  mapPortalCourseToEnrollmentCode,
  mapPortalStatusToEnrollmentType,
} from "./mappings";
import type { Courses, Status, Major } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PortalStudentData {
  firstName: string;
  lastName: string;
  middleInit?: string | null;
  email?: string | null;
  studentNumber: string;
  course: Courses;
  major?: Major | null;
  status: Status;
  sex: "MALE" | "FEMALE";
  address: string;
  phone?: string | null;
}

export interface SyncResult {
  /** True if the sync succeeded */
  success: boolean;
  /** The enrollment system User.id (set whether created or linked) */
  enrollmentUserId?: string;
  /** Human-readable status message */
  message: string;
  /** Whether a NEW record was created (vs linking an existing one) */
  created: boolean;
}

// ─── Course lookup cache ────────────────────────────────────────────────────

interface CourseCacheEntry {
  id: string;
  code: string;
  majors: { id: string; name: string }[];
}

let courseCache: CourseCacheEntry[] | null = null;
let courseCacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getEnrollmentCourses(): Promise<CourseCacheEntry[]> {
  if (courseCache && Date.now() < courseCacheExpiry) {
    return courseCache;
  }

  const rows = await enrollmentQuery<{
    course_id: string;
    course_code: string;
    major_id: string | null;
    major_name: string | null;
  }>(
    `SELECT c.id AS course_id, c.code AS course_code, m.id AS major_id, m.name AS major_name
     FROM "Course" c
     LEFT JOIN "Major" m ON m."courseId" = c.id
     ORDER BY c.code, m.name`
  );

  // Group majors by course
  const courseMap = new Map<string, CourseCacheEntry>();
  for (const row of rows) {
    if (!courseMap.has(row.course_id)) {
      courseMap.set(row.course_id, {
        id: row.course_id,
        code: row.course_code,
        majors: [],
      });
    }
    if (row.major_id && row.major_name) {
      courseMap.get(row.course_id)!.majors.push({
        id: row.major_id,
        name: row.major_name,
      });
    }
  }

  courseCache = Array.from(courseMap.values());
  courseCacheExpiry = Date.now() + CACHE_TTL_MS;
  return courseCache;
}

/** Look up enrollment Course.id by portal course code */
async function findEnrollmentCourseId(portalCourse: Courses): Promise<string | null> {
  const courses = await getEnrollmentCourses();
  const code = mapPortalCourseToEnrollmentCode(portalCourse);
  const found = courses.find((c) => c.code === code);
  return found?.id ?? null;
}

/** Look up enrollment Major.id by course ID and major name */
async function findEnrollmentMajorId(
  courseId: string,
  portalMajor: Major | null | undefined
): Promise<string | null> {
  if (!portalMajor || portalMajor === "NONE") return null;

  const majorNameMap: Record<string, string> = {
    HUMAN_RESOURCE_MANAGEMENT: "Human Resource Management",
    MARKETING_MANAGEMENT: "Marketing Management",
    ENGLISH: "English",
    MATHEMATICS: "Mathematics",
  };
  const targetName = majorNameMap[portalMajor];
  if (!targetName) return null;

  const courses = await getEnrollmentCourses();
  const course = courses.find((c) => c.id === courseId);
  if (!course) return null;

  const major = course.majors.find(
    (m) => m.name.toUpperCase() === targetName.toUpperCase()
  );
  return major?.id ?? null;
}

// ─── Core sync function ─────────────────────────────────────────────────────

/**
 * Sync a portal student to the enrollment system.
 *
 * Steps:
 * 1. If portal student already has enrollmentUserId, verify it still exists
 * 2. Look up enrollment system by email
 * 3. If found: link the enrollmentUserId in portal Student
 * 4. If not found: create User + Student records in enrollment DB
 *
 * This function is IDEMPOTENT and SAFE to call multiple times.
 */
export async function syncStudentToEnrollment(
  portalStudentId: string
): Promise<SyncResult> {
  // 1. Fetch portal student data
  const portalStudent = await prisma.student.findUnique({
    where: { id: portalStudentId },
    select: {
      id: true,
      studentNumber: true,
      firstName: true,
      lastName: true,
      middleInit: true,
      email: true,
      phone: true,
      address: true,
      sex: true,
      course: true,
      major: true,
      status: true,
      enrollmentUserId: true,
    },
  });

  if (!portalStudent) {
    return { success: false, message: "Portal student not found.", created: false };
  }

  if (!portalStudent.email) {
    return {
      success: false,
      message: "Student has no email address. Email is required for enrollment system linking.",
      created: false,
    };
  }

  const normalizedEmail = portalStudent.email.trim().toLowerCase();

  // 2. Check if already linked and the link is still valid
  if (portalStudent.enrollmentUserId) {
    const existingUser = await enrollmentQueryOne<{ id: string }>(
      `SELECT id FROM "user" WHERE id = $1`,
      [portalStudent.enrollmentUserId]
    );
    if (existingUser) {
      return {
        success: true,
        enrollmentUserId: portalStudent.enrollmentUserId,
        message: "Already linked to enrollment system.",
        created: false,
      };
    }
    // Link is stale — the enrollment user was deleted. Clear it and re-sync.
    await prisma.student.update({
      where: { id: portalStudentId },
      data: { enrollmentUserId: null },
    });
  }

  // 3. Look up by email in enrollment system
  const enrollmentUser = await enrollmentQueryOne<{ id: string }>(
    `SELECT id FROM "user" WHERE email = $1`,
    [normalizedEmail]
  );

  if (enrollmentUser) {
    // User already exists in enrollment system — link them
    await prisma.student.update({
      where: { id: portalStudentId },
      data: { enrollmentUserId: enrollmentUser.id },
    });
    return {
      success: true,
      enrollmentUserId: enrollmentUser.id,
      message: "Linked to existing enrollment system account.",
      created: false,
    };
  }

  // 4. No existing user — create one
  // Resolve course and major IDs
  const courseId = await findEnrollmentCourseId(portalStudent.course);
  if (!courseId) {
    return {
      success: false,
      message: `Course "${portalStudent.course}" not found in enrollment system. Add it first.`,
      created: false,
    };
  }

  const majorId =
    portalStudent.major && portalStudent.major !== "NONE"
      ? await findEnrollmentMajorId(courseId, portalStudent.major)
      : null;

  const newUserId = uuidv4();
  const now = new Date().toISOString();
  const fullName = [portalStudent.firstName, portalStudent.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const studentType = mapPortalStatusToEnrollmentType(portalStudent.status);
  const gender = portalStudent.sex; // MALE→MALE, FEMALE→FEMALE

  try {
    // Use a raw transaction (simulated via sequential queries with error handling)
    // Create User record
    await enrollmentQueryOne(
      `INSERT INTO "user" (id, name, email, "emailVerified", role, status, department, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, false, 'STUDENT', 'PENDING_ACTIVATION', NULL, $4, $4)`,
      [newUserId, fullName, normalizedEmail, now]
    );

    // Create Student record
    await enrollmentQueryOne(
      `INSERT INTO "Student" (id, "studentNumber", "firstName", "middleName", "lastName",
         address, "dateOfBirth", gender, "contactNumber", "courseId", "majorId",
         status, type, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10, 'ADMITTED', $11, $12)`,
      [
        newUserId,
        portalStudent.studentNumber,
        portalStudent.firstName.toUpperCase(),
        portalStudent.middleInit?.toUpperCase().charAt(0) || null,
        portalStudent.lastName.toUpperCase(),
        portalStudent.address || "N/A",
        gender,
        portalStudent.phone || null,
        courseId,
        majorId,
        studentType,
        now,
      ]
    );

    // Create activation token (links to enrollment system's activation flow)
    const activationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await enrollmentQueryOne(
      `INSERT INTO "verification" (id, identifier, value, "expiresAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [
        uuidv4(),
        `activation:${activationToken}`,
        normalizedEmail,
        expiresAt,
        now,
      ]
    );

    // 5. Link the portal student
    await prisma.student.update({
      where: { id: portalStudentId },
      data: { enrollmentUserId: newUserId },
    });

    return {
      success: true,
      enrollmentUserId: newUserId,
      message: `Created enrollment system account. Activation token generated.`,
      created: true,
    };
  } catch (error) {
    // Attempt cleanup of the enrollment user on failure
    try {
      await enrollmentQueryOne(`DELETE FROM "user" WHERE id = $1`, [newUserId]);
    } catch {
      // best-effort cleanup
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown database error";
    console.error(`[Bridge] Failed to sync student ${portalStudentId}:`, errorMessage);
    return {
      success: false,
      message: `Failed to create enrollment system record: ${errorMessage}`,
      created: false,
    };
  }
}

/**
 * Bulk sync: sync ALL portal students that have emails and are not yet linked.
 * Returns a summary of results.
 */
export async function syncAllStudents(): Promise<{
  total: number;
  synced: number;
  linked: number;
  failed: number;
  skipped: number;
  errors: string[];
}> {
  const students = await prisma.student.findMany({
    where: {
      email: { not: null, not: "" },
    },
    select: { id: true, email: true, enrollmentUserId: true },
  });

  let synced = 0;
  let linked = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const student of students) {
    try {
      const result = await syncStudentToEnrollment(student.id);
      if (result.success) {
        if (result.created) synced++;
        else linked++;
      } else if (result.message.includes("no email")) {
        skipped++;
      } else {
        failed++;
        errors.push(`${student.email}: ${result.message}`);
      }
    } catch (error) {
      failed++;
      errors.push(
        `${student.email}: ${error instanceof Error ? error.message : "Unknown"}`
      );
    }
  }

  return { total: students.length, synced, linked, failed, skipped, errors };
}

/**
 * Get the enrollment system's current active academic term.
 * Used by the enrollment pages to show current enrollment data.
 */
export async function getActiveEnrollmentTerm(): Promise<{
  id: string;
  academicYearLabel: string;
  semester: number;
  phase: string;
  isActive: boolean;
} | null> {
  const row = await enrollmentQueryOne<{
    id: string;
    year_start: number;
    year_end: number;
    semester: number;
    phase: string;
    is_active: boolean;
  }>(
    `SELECT at.id, ay."yearStart" AS year_start, ay."yearEnd" AS year_end,
            at.semester, at."enrollmentPhase" AS phase, at."isActive" AS is_active
     FROM "AcademicTerm" at
     JOIN "AcademicYear" ay ON at."academicYearId" = ay.id
     WHERE at."isActive" = true
     LIMIT 1`
  );

  if (!row) return null;

  return {
    id: row.id,
    academicYearLabel: `AY ${row.year_start}-${row.year_end}`,
    semester: row.semester,
    phase: row.phase,
    isActive: row.is_active,
  };
}
