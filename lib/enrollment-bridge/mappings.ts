/**
 * Field mappings between portal-sana and cvsub-enrollment systems.
 *
 * Portal uses Prisma-generated enums (Courses, Status, Major, UserSex).
 * Enrollment uses string-based enums (Course.code, StudentType, Gender).
 *
 * All mapping functions are PURE: same input always yields same output.
 */

import type { Courses, Status, Major } from "@prisma/client";

// ─── Course code mapping (direct 1:1 match) ─────────────────────────────────

/** Portal Courses enum → Enrollment Course.code string */
export function mapPortalCourseToEnrollmentCode(course: Courses): string {
  // Both systems use the same course codes: BSIT, BSCS, BSCRIM, BSP, BSHM, BSED, BSBA
  return course;
}

// ─── Student type / status mapping ──────────────────────────────────────────

/** Portal Status enum → Enrollment StudentType string */
export function mapPortalStatusToEnrollmentType(
  status: Status
): "REGULAR" | "IRREGULAR" | "TRANSFEREE" | "SHIFTEE" | "RETURNEE" {
  const map: Record<Status, string> = {
    REGULAR: "REGULAR",
    IRREGULAR: "IRREGULAR",
    NOT_ANNOUNCED: "IRREGULAR", // fallback: no enrollment data = irregular
    TRANSFEREE: "TRANSFEREE",
    RETURNEE: "RETURNEE",
  };
  return map[status] as "REGULAR" | "IRREGULAR" | "TRANSFEREE" | "SHIFTEE" | "RETURNEE";
}

// ─── Gender mapping ─────────────────────────────────────────────────────────

/** Portal UserSex → Enrollment Gender */
export function mapPortalSexToEnrollmentGender(
  sex: "MALE" | "FEMALE"
): "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY" {
  return sex; // MALE→MALE, FEMALE→FEMALE
}

// ─── Major mapping ──────────────────────────────────────────────────────────

/** Portal Major enum → display name for enrollment system matching */
export function mapPortalMajorToName(major: Major | null): string | null {
  if (!major || major === "NONE") return null;
  const map: Record<string, string> = {
    HUMAN_RESOURCE_MANAGEMENT: "Human Resource Management",
    MARKETING_MANAGEMENT: "Marketing Management",
    ENGLISH: "English",
    MATHEMATICS: "Mathematics",
  };
  return map[major] ?? null;
}

// ─── Enrollment → Portal mappings (for display) ────────────────────────────

/** Enrollment system EnrollmentStatus → human-readable label */
export const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Pending Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

/** Enrollment system EnrollmentPhase → human-readable label */
export const ENROLLMENT_PHASE_LABELS: Record<string, string> = {
  CLOSED: "Enrollment Closed",
  VALIDATION: "Grade Validation Phase",
  ENROLLMENT_OPEN: "Enrollment Open",
  LOCKED: "Enrollment Locked",
};

/** Enrollment system schedule day index → day name */
export const SCHEDULE_DAY_NAMES: Record<number, string> = {
  0: "Monday",
  1: "Tuesday",
  2: "Wednesday",
  3: "Thursday",
  4: "Friday",
  5: "Saturday",
};
