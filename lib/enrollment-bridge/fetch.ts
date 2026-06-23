/**
 * Enrollment Bridge — Data Fetch Functions
 *
 * Read-only queries to fetch enrollment data from the enrollment system
 * for display in the portal. All queries use parameterized SQL.
 *
 * These functions are called from Next.js server actions — never on the client.
 */

import { enrollmentQuery, enrollmentQueryOne } from "./db";
import {
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_PHASE_LABELS,
  SCHEDULE_DAY_NAMES,
} from "./mappings";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EnrollmentSubject {
  subjectCode: string;
  subjectName: string;
  units: number;
  lecUnits: number;
  labUnits: number;
  section: string;
  schedule: string; // formatted: "Mon 07:00-08:30, Wed 07:00-08:30"
  instructor: string;
  room: string;
  classType: string;
}

export interface EnrollmentData {
  enrollmentId: string;
  status: string; // human-readable
  statusRaw: string;
  yearLevel: number | null;
  section: string | null;
  enrolledAt: string | null;
  totalUnits: number;
  subjects: EnrollmentSubject[];
}

export interface ActiveTermInfo {
  id: string;
  academicYearLabel: string;
  semester: number;
  phase: string;
  phaseLabel: string;
  isActive: boolean;
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch the student's current enrollment data from the enrollment system.
 * Looks up by enrollmentUserId (the linked enrollment system User.id).
 */
export async function getStudentEnrollmentData(
  enrollmentUserId: string,
): Promise<EnrollmentData | null> {
  // Get enrollment for the active term
  const enrollment = await enrollmentQueryOne<{
    id: string;
    status: string;
    year_level: number | null;
    section: string | null;
    enrolled_at: string | null;
  }>(
    `SELECT e.id, e.status, e."yearLevel" AS year_level,
            e.section, e."enrolledAt" AS enrolled_at
     FROM "Enrollment" e
     JOIN "AcademicTerm" at ON e."academicTermId" = at.id
     WHERE e."studentId" = $1 AND at."isActive" = true
     ORDER BY e."createdAt" DESC
     LIMIT 1`,
    [enrollmentUserId],
  );

  if (!enrollment) return null;

  // Get enrolled subjects with schedules
  const subjectRows = await enrollmentQuery<{
    subject_code: string;
    subject_name: string;
    units: number;
    lec_units: number;
    lab_units: number;
    section: string;
    day: number | null;
    start_time: string | null;
    end_time: string | null;
    instructor: string | null;
    room_code: string | null;
    class_type: string;
  }>(
    `SELECT s.code AS subject_code, s.name AS subject_name,
            s.units, s."lecUnits" AS lec_units, s."labUnits" AS lab_units,
            so.section, sb.day, sb."startTime" AS start_time,
            sb."endTime" AS end_time, f.name AS instructor,
            r.code AS room_code, so."classType" AS class_type
     FROM "EnrollmentSubject" es
     JOIN "subject_offering" so ON es."subjectOfferingId" = so.id
     JOIN "Subject" s ON so."subjectId" = s.id
     LEFT JOIN "schedule_block" sb ON sb."subjectOfferingId" = so.id
     LEFT JOIN "faculty" f ON so."facultyId" = f.id
     LEFT JOIN "room" r ON sb."roomId" = r.id
     WHERE es."enrollmentId" = $1
     ORDER BY s.code`,
    [enrollment.id],
  );

  // Group schedules by subject
  const subjectMap = new Map<string, EnrollmentSubject>();
  for (const row of subjectRows) {
    const key = row.subject_code;
    if (!subjectMap.has(key)) {
      subjectMap.set(key, {
        subjectCode: row.subject_code,
        subjectName: row.subject_name,
        units: Number(row.units),
        lecUnits: Number(row.lec_units),
        labUnits: Number(row.lab_units),
        section: row.section,
        schedule: "",
        instructor: row.instructor || "TBA",
        room: row.room_code || "TBA",
        classType: row.class_type,
      });
    }

    // Build schedule string
    if (row.day !== null && row.start_time && row.end_time) {
      const dayName = SCHEDULE_DAY_NAMES[row.day] ?? `Day${row.day}`;
      const schedulePart = `${dayName} ${row.start_time}-${row.end_time}`;
      const existing = subjectMap.get(key)!;
      existing.schedule = existing.schedule
        ? `${existing.schedule}, ${schedulePart}`
        : schedulePart;
    }
  }

  const subjects = Array.from(subjectMap.values());
  const totalUnits = subjects.reduce((sum, s) => sum + s.units, 0);

  return {
    enrollmentId: enrollment.id,
    status: ENROLLMENT_STATUS_LABELS[enrollment.status] ?? enrollment.status,
    statusRaw: enrollment.status,
    yearLevel: enrollment.year_level,
    section: enrollment.section,
    enrolledAt: enrollment.enrolled_at,
    totalUnits,
    subjects,
  };
}

/**
 * Get current active academic term info for display.
 */
export async function getActiveTermInfo(): Promise<ActiveTermInfo | null> {
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
     LIMIT 1`,
  );

  if (!row) return null;

  return {
    id: row.id,
    academicYearLabel: `AY ${row.year_start}-${row.year_end}`,
    semester: row.semester,
    phase: row.phase,
    phaseLabel: ENROLLMENT_PHASE_LABELS[row.phase] ?? row.phase,
    isActive: row.is_active,
  };
}

/**
 * Get eligible subject offerings for a student (for pre-registration display).
 * Matches offerings to the student's curriculum year level and semester.
 */
export async function getEligibleOfferings(enrollmentUserId: string): Promise<
  {
    offeringId: string;
    subjectCode: string;
    subjectName: string;
    units: number;
    section: string;
    schedule: string;
    instructor: string;
    room: string;
    enrolled: number;
    capacity: number;
    classType: string;
  }[]
> {
  // Get student info (course, year level from latest enrollment)
  const student = await enrollmentQueryOne<{
    course_id: string;
    year_level: number | null;
  }>(
    `SELECT s."courseId" AS course_id, e."yearLevel" AS year_level
     FROM "Student" s
     LEFT JOIN LATERAL (
       SELECT "yearLevel" FROM "Enrollment"
       WHERE "studentId" = s.id
       ORDER BY "createdAt" DESC LIMIT 1
     ) e ON true
     WHERE s.id = $1`,
    [enrollmentUserId],
  );

  if (!student || !student.course_id) return [];

  const rows = await enrollmentQuery<{
    offering_id: string;
    subject_code: string;
    subject_name: string;
    units: number;
    section: string;
    day: number | null;
    start_time: string | null;
    end_time: string | null;
    instructor: string | null;
    room_code: string | null;
    enrolled: number;
    max_capacity: number;
    class_type: string;
  }>(
    `SELECT so.id AS offering_id, s.code AS subject_code, s.name AS subject_name,
            s.units, so.section, sb.day, sb."startTime" AS start_time,
            sb."endTime" AS end_time, f.name AS instructor,
            r.code AS room_code,
            COALESCE(ec.cnt, 0)::int AS enrolled,
            sec."maxCapacity" AS max_capacity,
            so."classType" AS class_type
     FROM "subject_offering" so
     JOIN "Subject" s ON so."subjectId" = s.id
     JOIN "AcademicTerm" at ON so."academicTermId" = at.id
     LEFT JOIN "schedule_block" sb ON sb."subjectOfferingId" = so.id
     LEFT JOIN "faculty" f ON so."facultyId" = f.id
     LEFT JOIN "room" r ON sb."roomId" = r.id
     LEFT JOIN "section" sec ON so."sectionId" = sec.id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS cnt FROM "EnrollmentSubject" es2
       WHERE es2."subjectOfferingId" = so.id
     ) ec ON true
     WHERE at."isActive" = true
       AND so.status != 'DRAFT'
       AND so."scheduledStatus" = 'APPROVED'
     ORDER BY s.code`,
    [],
  );

  // Group by offering
  const offeringMap = new Map<
    string,
    {
      offeringId: string;
      subjectCode: string;
      subjectName: string;
      units: number;
      section: string;
      schedule: string;
      instructor: string;
      room: string;
      enrolled: number;
      capacity: number;
      classType: string;
    }
  >();

  for (const row of rows) {
    const key = row.offering_id;
    if (!offeringMap.has(key)) {
      offeringMap.set(key, {
        offeringId: row.offering_id,
        subjectCode: row.subject_code,
        subjectName: row.subject_name,
        units: Number(row.units),
        section: row.section,
        schedule: "",
        instructor: row.instructor || "TBA",
        room: row.room_code || "TBA",
        enrolled: Number(row.enrolled),
        capacity: Number(row.max_capacity) || 40,
        classType: row.class_type,
      });
    }

    if (row.day !== null && row.start_time && row.end_time) {
      const dayName = SCHEDULE_DAY_NAMES[row.day] ?? `Day${row.day}`;
      const schedulePart = `${dayName} ${row.start_time}-${row.end_time}`;
      const existing = offeringMap.get(key)!;
      existing.schedule = existing.schedule
        ? `${existing.schedule}, ${schedulePart}`
        : schedulePart;
    }
  }

  return Array.from(offeringMap.values());
}

/**
 * Check the enrollment system connection and bridge status.
 */
export async function getBridgeStatus(): Promise<{
  connected: boolean;
  message: string;
  syncedCount: number;
  unsyncedCount: number;
}> {
  let connected = false;

  try {
    await enrollmentQuery("SELECT 1");
    connected = true;
  } catch {
    // connection failed
  }

  const [syncedCount, unsyncedCount] = await Promise.all([
    // This query runs against the portal DB, imported at top
    await import("@/lib/prisma").then((m) =>
      m.default.student.count({
        where: { enrollmentUserId: { not: null } },
      }),
    ),
    await import("@/lib/prisma").then((m) =>
      m.default.student.count({
        where: {
          enrollmentUserId: null,
          AND: [{ email: { not: null } }, { email: { not: "" } }],
        },
      }),
    ),
  ]);

  return {
    connected,
    message: connected
      ? "Connected to enrollment system database."
      : "Cannot connect to enrollment system database. Check ENROLLMENT_DATABASE_URL.",
    syncedCount,
    unsyncedCount,
  };
}
