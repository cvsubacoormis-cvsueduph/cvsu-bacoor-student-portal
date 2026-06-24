"use server";

import prisma from "@/lib/prisma";
import { AcademicYear, Semester, Prisma } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";

// ── Types ───────────────────────────────────────────────────────────────────

export interface FacultyUploadStatus {
  id: string;
  username: string;
  name: string;
  hasUploaded: boolean;
  gradesUploadedCount: number;
}

export interface GetFacultyUploadStatusParams {
  academicYear: AcademicYear;
  semester: Semester;
  page: number;
  pageSize: number;
  search?: string;
  status?: "all" | "uploaded" | "not-uploaded";
  /** If provided, only return status for this specific faculty (used for faculty self-view). */
  facultyId?: string;
}

/** A time-clustered grouping of GradeLog entries representing one upload batch. */
export interface UploadSession {
  /** Unique key derived from the session timestamp. */
  id: string;
  /** ISO-8601 timestamp when this session started. */
  startedAt: string;
  /** ISO-8601 timestamp when this session ended (last entry in the bucket). */
  endedAt: string;
  /** Number of successful GradeLog actions in this session. */
  successCount: number;
  /** Number of FAILED GradeLog actions in this session. */
  failureCount: number;
  /** Total rows processed in this session. */
  totalCount: number;
}

/** Full upload history for a single faculty member. */
export interface FacultyUploadHistory {
  sessions: UploadSession[];
  totalSuccessAllTime: number;
  totalFailuresAllTime: number;
  /** Success rate as a percentage (0-100). */
  successRate: number;
  lastUploadAt: string | null;
  firstUploadAt: string | null;
}

/** All the name variants used to match a faculty record against loose string fields. */
interface FacultyNamePermutations {
  /** Normalised variants (titles stripped, uppercased, no punctuation). */
  normalized: Set<string>;
  /** Raw lowercased variants (used for uploadedBy matching). */
  raw: Set<string>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalizes an instructor name by removing titles, suffixes, and special chars.
 * Used to robustly match Grade.instructor / Grade.uploadedBy fields to User records.
 */
function normalizeInstructorName(name: string): string {
  if (!name) return "";
  const cleaned = String(name).replace(/['.,\-]/g, "").toUpperCase();
  const tokens = cleaned.split(/\s+/);

  const ignoredWords = new Set([
    "MR", "MS", "MRS", "DR", "PROF", "ENGR", "ARCH", "ATTY", "REV", "FR",
    "HON", "LPT", "MIT", "MSCS", "MAED", "PHD", "EDD", "MAT", "MBA", "MPA",
    "RN", "CPA", "MD", "JD", "DMD", "DBA", "DPA", "INSTRUCTOR", "FACULTY",
    "PROFESSOR",
  ]);

  const filtered = tokens.filter((t) => !ignoredWords.has(t));
  return filtered.join(" ");
}

/**
 * Builds all name permutations for a faculty record.
 * These are used to match against Grade.uploadedBy and Grade.instructor
 * (which are free-text fields without a FK to User).
 */
function buildFacultyNamePermutations(faculty: {
  firstName: string;
  lastName: string;
  middleInit: string | null;
  username: string;
}): FacultyNamePermutations {
  const fn = faculty.firstName;
  const ln = faculty.lastName;
  const mi = faculty.middleInit ?? "";

  const rawVariants = [
    `${fn} ${ln}`,
    `${ln} ${fn}`,
    mi ? `${fn} ${mi} ${ln}` : null,
    faculty.username,
  ].filter(Boolean) as string[];

  const normalized = new Set<string>();
  const raw = new Set<string>();

  for (const v of rawVariants) {
    raw.add(v.toLowerCase().replace(/[\s\-]+/g, " ").trim());
    const norm = normalizeInstructorName(v).toLowerCase();
    if (norm) normalized.add(norm);
  }

  return { normalized, raw };
}

/**
 * Checks whether a raw instructor/uploadedBy string matches a faculty's
 * pre-computed name permutations.
 */
function nameMatchesFaculty(
  target: string,
  permutations: FacultyNamePermutations,
): boolean {
  if (!target) return false;

  const rawTarget = target.toLowerCase().replace(/\s+/g, " ").trim();
  if (permutations.raw.has(rawTarget)) return true;

  const normTarget = normalizeInstructorName(target).toLowerCase();
  if (!normTarget) return false;
  if (permutations.normalized.has(normTarget)) return true;

  // Partial match: normalized target contains one of the normalized permutations
  for (const perm of permutations.normalized) {
    if (normTarget.includes(perm)) return true;
  }

  return false;
}

// ── Auth guard ──────────────────────────────────────────────────────────────

async function authorizeAccess(): Promise<void> {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const allowedRoles = ["admin", "superuser", "registrar", "registrar_staff", "faculty"];
  if (!role || !allowedRoles.includes(role)) {
    throw new Error("Forbidden: insufficient permissions.");
  }
}

// ── Main action: per-term upload status ─────────────────────────────────────

export async function getFacultyUploadStatus(
  params: GetFacultyUploadStatusParams,
): Promise<{ data: FacultyUploadStatus[]; total: number }> {
  const { academicYear, semester, page, pageSize, search, status, facultyId } =
    params;

  await authorizeAccess();

  try {
    // ── 1. Build Prisma search filter ───────────────────────────────────
    const searchFilter: Prisma.UserWhereInput = search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    // ── 2. Fetch all matching faculties ─────────────────────────────────
    const userWhere: Prisma.UserWhereInput = {
      role: "faculty",
      ...searchFilter,
      ...(facultyId ? { id: facultyId } : {}),
    };

    const allFaculties = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        middleInit: true,
      },
      orderBy: { lastName: "asc" },
    });

    if (allFaculties.length === 0) {
      return { data: [], total: 0 };
    }

    // ── 3. Fetch grades for the active term ─────────────────────────────
    const gradesGrouped = await prisma.grade.groupBy({
      by: ["uploadedBy", "instructor"],
      where: { academicYear, semester },
      _count: { id: true },
    });

    // ── 4. Build lookup maps for robust matching ────────────────────────
    const uploadedByMap = new Map<string, number>();
    const instructorMap = new Map<string, number>();

    for (const group of gradesGrouped) {
      if (group.uploadedBy) {
        const cleanName = group.uploadedBy
          .toLowerCase()
          .replace(/[\s\-]+/g, " ")
          .trim();
        uploadedByMap.set(
          cleanName,
          (uploadedByMap.get(cleanName) ?? 0) + group._count.id,
        );
      }
      if (group.instructor) {
        const cleanInst = normalizeInstructorName(group.instructor).toLowerCase();
        instructorMap.set(
          cleanInst,
          (instructorMap.get(cleanInst) ?? 0) + group._count.id,
        );
      }
    }

    // ── 5. Map each faculty to upload status ────────────────────────────
    let statusResults: FacultyUploadStatus[] = allFaculties.map((faculty) => {
      const name = [
        `${faculty.lastName}, ${faculty.firstName}`,
        faculty.middleInit ? ` ${faculty.middleInit}.` : "",
      ]
        .join("")
        .trim();

      const perms = buildFacultyNamePermutations(faculty);

      // Count only the faculty's OWN uploads (uploadedBy match).
      // Falls through to instructor only if no uploadedBy match found.
      let count = 0;
      for (const rawName of perms.raw) {
        const found = uploadedByMap.get(rawName);
        if (found) {
          count = found;
          break;
        }
      }

      if (count === 0) {
        for (const normName of perms.normalized) {
          const found = instructorMap.get(normName);
          if (found) {
            count = found;
            break;
          }
        }
      }

      return {
        id: faculty.id,
        username: faculty.username,
        name,
        hasUploaded: count > 0,
        gradesUploadedCount: count,
      };
    });

    // ── 6. Apply status filter (after mapping) ──────────────────────────
    if (status === "uploaded") {
      statusResults = statusResults.filter((f) => f.hasUploaded);
    } else if (status === "not-uploaded") {
      statusResults = statusResults.filter((f) => !f.hasUploaded);
    }

    const total = statusResults.length;

    // ── 7. Paginate ─────────────────────────────────────────────────────
    const data =
      pageSize === 0
        ? statusResults
        : statusResults.slice((page - 1) * pageSize, page * pageSize);

    return { data, total };
  } catch (error) {
    console.error("Failed to fetch faculty upload status", error);
    throw new Error("Failed to fetch faculty upload status");
  }
}

// ── History action: per-faculty upload tracking ─────────────────────────────

/** Maximum GradeLog rows to fetch for history (pre-filtered by name). */
const HISTORY_LOG_LIMIT = 500;

/** Time window (ms) used to cluster consecutive GradeLog entries into one session. */
const SESSION_GAP_MS = 5 * 60 * 1000; // 5 minutes

export async function getFacultyHistory(
  facultyId: string,
  academicYear?: AcademicYear,
  semester?: Semester,
): Promise<FacultyUploadHistory> {
  await authorizeAccess();

  try {
    // ── 1. Fetch the faculty record ─────────────────────────────────────
    const faculty = await prisma.user.findUnique({
      where: { id: facultyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleInit: true,
        username: true,
      },
    });

    if (!faculty) {
      throw new Error("Faculty not found");
    }

    // ── 2. Build name permutations for matching ─────────────────────────
    const perms = buildFacultyNamePermutations(faculty);

    // ── 3. Branch: term-scoped vs all-time ──────────────────────────────
    if (academicYear && semester) {
      return await getTermScopedHistory(faculty, perms, academicYear, semester);
    }

    return await getAllTimeHistory(faculty, perms);
  } catch (error) {
    console.error("Failed to fetch faculty history", error);
    throw new Error("Failed to fetch faculty history");
  }
}

// ── Term-scoped history: uses Grade table to discover upload time windows ───

async function getTermScopedHistory(
  faculty: {
    id: string;
    firstName: string;
    lastName: string;
    middleInit: string | null;
    username: string;
  },
  perms: FacultyNamePermutations,
  academicYear: AcademicYear,
  semester: Semester,
): Promise<FacultyUploadHistory> {
  // Step 1: Find ALL Grade entries attributed to this faculty for this term.
  // We use a broad Prisma filter (lastName + username) to avoid the fragility
  // of substring "contains" matching with name permutations. The JS-refine
  // below does the precise matching using the same logic as getFacultyUploadStatus.
  const candidateGrades = await prisma.grade.findMany({
    where: {
      academicYear,
      semester,
      OR: [
        { instructor: { contains: faculty.lastName, mode: "insensitive" } },
        { instructor: { contains: faculty.username, mode: "insensitive" } },
        { uploadedBy: { contains: faculty.lastName, mode: "insensitive" } },
        { uploadedBy: { contains: faculty.username, mode: "insensitive" } },
      ],
    },
    select: {
      createdAt: true,
      instructor: true,
      uploadedBy: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // JS-refine: keep only grades actually matching this faculty
  const attributed = candidateGrades.filter(
    (g) =>
      nameMatchesFaculty(g.instructor, perms) ||
      nameMatchesFaculty(g.uploadedBy ?? "", perms),
  );

  if (attributed.length === 0) {
    return {
      sessions: [],
      totalSuccessAllTime: 0,
      totalFailuresAllTime: 0,
      successRate: 0,
      lastUploadAt: null,
      firstUploadAt: null,
    };
  }

  // Step 2: Derive time window from attributed grades
  const minTime = attributed[0].createdAt;
  const maxTime = attributed[attributed.length - 1].createdAt;
  const windowStart = new Date(minTime.getTime() - SESSION_GAP_MS);
  const windowEnd = new Date(maxTime.getTime() + SESSION_GAP_MS);

  // Collect all instructor names seen in attributed grades so we can
  // include GradeLog entries whose instructor matches those names (even
  // when they don't directly match the faculty's own name permutations).
  const attributedInstructorKeys = new Set<string>();
  for (const g of attributed) {
    const key = g.instructor.toLowerCase().replace(/\s+/g, " ").trim();
    if (key) attributedInstructorKeys.add(key);
  }

  // Step 3: Query GradeLog within the time window for this term.
  // No instructor filter here — we fetch all logs in the time window and
  // rely on JS-refine below for precise attribution. A Prisma-level
  // instructor filter would be too fragile (same problem we fixed in Step 1).
  const logs = await prisma.gradeLog.findMany({
    where: {
      academicYear,
      semester,
      performedAt: { gte: windowStart, lte: windowEnd },
    },
    orderBy: { performedAt: "asc" },
    take: HISTORY_LOG_LIMIT,
    select: {
      id: true,
      action: true,
      performedAt: true,
      instructor: true,
      studentNumber: true,
      courseCode: true,
      courseTitle: true,
      grade: true,
      remarks: true,
    },
  });

  // Step 4: Refine — keep logs whose instructor matches either the faculty
  // directly, or one of the instructor names seen in attributed grades.
  const matched = logs.filter((log) => {
    if (nameMatchesFaculty(log.instructor, perms)) return true;
    const key = log.instructor.toLowerCase().replace(/\s+/g, " ").trim();
    return attributedInstructorKeys.has(key);
  });

  return buildHistoryResult(matched);
}

// ── All-time history: uses instructor name matching only ────────────────────

async function getAllTimeHistory(
  faculty: {
    id: string;
    firstName: string;
    lastName: string;
    middleInit: string | null;
    username: string;
  },
  perms: FacultyNamePermutations,
): Promise<FacultyUploadHistory> {
  // Use broad filters (lastName + username) to avoid the fragility of
  // substring matching with specific name permutations.
  const logs = await prisma.gradeLog.findMany({
    where: {
      OR: [
        { instructor: { contains: faculty.lastName, mode: "insensitive" } },
        { instructor: { contains: faculty.username, mode: "insensitive" } },
      ],
    },
    orderBy: { performedAt: "desc" },
    take: HISTORY_LOG_LIMIT,
    select: {
      id: true,
      action: true,
      performedAt: true,
      instructor: true,
      studentNumber: true,
      courseCode: true,
      courseTitle: true,
      grade: true,
      remarks: true,
    },
  });

  const matched = logs.filter((log) =>
    nameMatchesFaculty(log.instructor, perms),
  );

  return buildHistoryResult(matched);
}

// ── Shared: build sessions + aggregate stats from matched logs ──────────────

function buildHistoryResult(
  matched: {
    id: string;
    action: string;
    performedAt: Date;
    instructor: string;
    studentNumber: string;
    courseCode: string;
    courseTitle: string;
    grade: string;
    remarks: string | null;
  }[],
): FacultyUploadHistory {
  if (matched.length === 0) {
    return {
      sessions: [],
      totalSuccessAllTime: 0,
      totalFailuresAllTime: 0,
      successRate: 0,
      lastUploadAt: null,
      firstUploadAt: null,
    };
  }

  // Sort ascending for session clustering
  const sorted = [...matched].sort(
    (a, b) => a.performedAt.getTime() - b.performedAt.getTime(),
  );

  const sessions: UploadSession[] = [];
  let currentBucket: typeof sorted = [];

  for (const log of sorted) {
    if (currentBucket.length === 0) {
      currentBucket.push(log);
    } else {
      const lastTime =
        currentBucket[currentBucket.length - 1].performedAt.getTime();
      const gap = log.performedAt.getTime() - lastTime;
      if (gap <= SESSION_GAP_MS) {
        currentBucket.push(log);
      } else {
        sessions.push(buildSession(currentBucket));
        currentBucket = [log];
      }
    }
  }

  if (currentBucket.length > 0) {
    sessions.push(buildSession(currentBucket));
  }

  // Most recent first
  sessions.reverse();

  const totalSuccess = matched.filter((l) => l.action !== "FAILED").length;
  const totalFailures = matched.filter((l) => l.action === "FAILED").length;
  const total = totalSuccess + totalFailures;

  return {
    sessions,
    totalSuccessAllTime: totalSuccess,
    totalFailuresAllTime: totalFailures,
    successRate: total > 0 ? Math.round((totalSuccess / total) * 100) : 0,
    lastUploadAt: matched[0]?.performedAt.toISOString() ?? null,
    firstUploadAt:
      matched[matched.length - 1]?.performedAt.toISOString() ?? null,
  };
}

// ── Session builder ─────────────────────────────────────────────────────────

function buildSession(
  bucket: {
    id: string;
    action: string;
    performedAt: Date;
  }[],
): UploadSession {
  const successCount = bucket.filter((l) => l.action !== "FAILED").length;
  const failureCount = bucket.filter((l) => l.action === "FAILED").length;

  const lastEntry = bucket[bucket.length - 1];

  return {
    id: `session-${bucket[0].performedAt.getTime()}`,
    startedAt: bucket[0].performedAt.toISOString(),
    endedAt: lastEntry.performedAt.toISOString(),
    successCount,
    failureCount,
    totalCount: bucket.length,
  };
}

// ── Uploaded Grades: detail view with courseCode/courseTitle filtering ──────

/** A single uploaded grade record shown in the detail panel. */
export interface UploadedGradeRecord {
  id: string;
  studentNumber: string;
  studentName: string;
  courseCode: string;
  courseTitle: string;
  creditUnit: number;
  grade: string;
  reExam: string | null;
  remarks: string | null;
  instructor: string;
  uploadedBy: string;
  createdAt: string;
}

export interface GetFacultyUploadedGradesParams {
  facultyId: string;
  academicYear: AcademicYear;
  semester: Semester;
  /** ISO-8601 start of the session window (inclusive). */
  sessionStartedAt: string;
  /** ISO-8601 end of the session window (exclusive). */
  sessionEndedAt: string;
  courseCode?: string;
  courseTitle?: string;
  page: number;
  pageSize: number;
}

export interface GetFacultyUploadedGradesResult {
  data: UploadedGradeRecord[];
  total: number;
  /** Distinct course codes available for the selected faculty/term/session. */
  availableCourseCodes: string[];
  /** Distinct course titles available (respecting any active courseCode filter). */
  availableCourseTitles: string[];
}

export async function getFacultyUploadedGrades(
  params: GetFacultyUploadedGradesParams,
): Promise<GetFacultyUploadedGradesResult> {
  const {
    facultyId,
    academicYear,
    semester,
    sessionStartedAt,
    sessionEndedAt,
    courseCode,
    courseTitle,
    page,
    pageSize,
  } = params;

  await authorizeAccess();

  try {
    // ── 1. Fetch faculty record & build name permutations ──────────────
    const faculty = await prisma.user.findUnique({
      where: { id: facultyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleInit: true,
        username: true,
      },
    });

    if (!faculty) {
      throw new Error("Faculty not found");
    }

    const perms = buildFacultyNamePermutations(faculty);

    // ── 2. Build where clause ──────────────────────────────────────────
    const sessionStart = new Date(sessionStartedAt);
    const sessionEnd = new Date(sessionEndedAt);

    // Use a generous window (±60s) for the session to account for clock skew
    const windowStart = new Date(sessionStart.getTime() - 60_000);
    const windowEnd = new Date(sessionEnd.getTime() + 60_000);

    // Use broad filters (lastName + username) instead of fragile raw-name
    // "contains" matching. JS-refine below handles precise attribution.
    const nameFilters: Prisma.GradeWhereInput[] = [
      { instructor: { contains: faculty.lastName, mode: "insensitive" } },
      { instructor: { contains: faculty.username, mode: "insensitive" } },
      { uploadedBy: { contains: faculty.lastName, mode: "insensitive" } },
      { uploadedBy: { contains: faculty.username, mode: "insensitive" } },
    ];

    const where: Prisma.GradeWhereInput = {
      academicYear,
      semester,
      createdAt: { gte: windowStart, lte: windowEnd },
      OR: nameFilters,
    };

    if (courseCode) {
      where.courseCode = { equals: courseCode, mode: "insensitive" };
    }

    if (courseTitle) {
      where.courseTitle = { contains: courseTitle, mode: "insensitive" };
    }

    // ── 3. Get available filters (unfiltered by courseCode/courseTitle) ─
    const filterWhere: Prisma.GradeWhereInput = {
      academicYear,
      semester,
      createdAt: { gte: windowStart, lte: windowEnd },
      OR: nameFilters,
    };

    const [distinctCodes, distinctTitles] = await Promise.all([
      prisma.grade.findMany({
        where: filterWhere,
        select: { courseCode: true },
        distinct: ["courseCode"],
        orderBy: { courseCode: "asc" },
      }),
      prisma.grade.findMany({
        where: {
          ...filterWhere,
          ...(courseCode ? { courseCode: { equals: courseCode, mode: "insensitive" } } : {}),
        },
        select: { courseTitle: true },
        distinct: ["courseTitle"],
        orderBy: { courseTitle: "asc" },
      }),
    ]);

    // ── 4. Query grades with pagination ────────────────────────────────
    const [grades, total] = await Promise.all([
      prisma.grade.findMany({
        where,
        select: {
          id: true,
          studentNumber: true,
          student: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          courseCode: true,
          courseTitle: true,
          creditUnit: true,
          grade: true,
          reExam: true,
          remarks: true,
          instructor: true,
          uploadedBy: true,
          createdAt: true,
        },
        orderBy: [{ courseCode: "asc" }, { courseTitle: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.grade.count({ where }),
    ]);

    // ── 5. Post-filter: only keep grades matching the faculty name ─────
    const matched = grades.filter(
      (g) =>
        nameMatchesFaculty(g.instructor, perms) ||
        nameMatchesFaculty(g.uploadedBy, perms),
    );

    return {
      data: matched.map((g) => ({
        ...g,
        studentName: `${g.student.lastName}, ${g.student.firstName}`,
        createdAt: g.createdAt.toISOString(),
      })),
      total,
      availableCourseCodes: distinctCodes.map((c) => c.courseCode),
      availableCourseTitles: distinctTitles.map((t) => t.courseTitle),
    };
  } catch (error) {
    console.error("Failed to fetch faculty uploaded grades", error);
    throw new Error("Failed to fetch uploaded grades");
  }
}

// ── Rollback: delete grades from a session and log the action ──────────────

export interface RollbackFacultyGradesParams {
  facultyId: string;
  academicYear: AcademicYear;
  semester: Semester;
  sessionStartedAt: string;
  sessionEndedAt: string;
  /** If provided, only rollback grades matching this course code. */
  courseCode?: string;
  /** If provided, only rollback grades matching this course title. */
  courseTitle?: string;
}

export interface RollbackFacultyGradesResult {
  deletedCount: number;
  /** IDs of the GradeLog entries created for this rollback. */
  rollbackLogIds: string[];
}

export async function rollbackFacultyGrades(
  params: RollbackFacultyGradesParams,
): Promise<RollbackFacultyGradesResult> {
  const { facultyId, academicYear, semester, sessionStartedAt, sessionEndedAt, courseCode, courseTitle } =
    params;

  await authorizeAccess();

  // Only admin, superuser, and registrar can rollback
  const { sessionClaims } = await auth();
  const userRole = (sessionClaims?.metadata as { role?: string })?.role;
  if (userRole !== "admin" && userRole !== "superuser" && userRole !== "registrar") {
    throw new Error("Forbidden: only admin, superuser, and registrar can perform rollbacks.");
  }

  try {
    // ── 1. Fetch faculty & build name permutations ────────────────────
    const faculty = await prisma.user.findUnique({
      where: { id: facultyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleInit: true,
        username: true,
      },
    });

    if (!faculty) {
      throw new Error("Faculty not found");
    }

    const perms = buildFacultyNamePermutations(faculty);

    const sessionStart = new Date(sessionStartedAt);
    const sessionEnd = new Date(sessionEndedAt);
    const windowStart = new Date(sessionStart.getTime() - 60_000);
    const windowEnd = new Date(sessionEnd.getTime() + 60_000);

    // ── 2. Find all grades in the session window ───────────────────────
    // Use broad filters (lastName + username) instead of fragile raw-name
    // "contains" matching. JS-refine below handles precise attribution.
    const candidateGrades = await prisma.grade.findMany({
      where: {
        academicYear,
        semester,
        createdAt: { gte: windowStart, lte: windowEnd },
        OR: [
          { instructor: { contains: faculty.lastName, mode: "insensitive" } },
          { instructor: { contains: faculty.username, mode: "insensitive" } },
          { uploadedBy: { contains: faculty.lastName, mode: "insensitive" } },
          { uploadedBy: { contains: faculty.username, mode: "insensitive" } },
        ],
        ...(courseCode ? { courseCode: { equals: courseCode, mode: "insensitive" } } : {}),
        ...(courseTitle ? { courseTitle: { contains: courseTitle, mode: "insensitive" } } : {}),
      },
      select: {
        id: true,
        studentNumber: true,
        courseCode: true,
        courseTitle: true,
        creditUnit: true,
        grade: true,
        remarks: true,
        instructor: true,
        uploadedBy: true,
        createdAt: true,
      },
    });

    // ── 3. Refine: only grades actually matching faculty name ──────────
    const matched = candidateGrades.filter(
      (g) =>
        nameMatchesFaculty(g.instructor, perms) ||
        nameMatchesFaculty(g.uploadedBy, perms),
    );

    if (matched.length === 0) {
      return { deletedCount: 0, rollbackLogIds: [] };
    }

    const gradeIds = matched.map((g) => g.id);

    // ── 4. Build rollback GradeLog entries ─────────────────────────────
    const fullUserName = [
      `${faculty.firstName} ${faculty.lastName}`,
      faculty.middleInit ? ` ${faculty.middleInit}.` : "",
    ]
      .join("")
      .trim();

    const rollbackLogData = matched.map((g) => ({
      studentNumber: g.studentNumber,
      courseCode: g.courseCode,
      courseTitle: g.courseTitle,
      creditUnit: g.creditUnit,
      grade: g.grade,
      remarks: `ROLLBACK: ${g.remarks ?? ""}`.trim(),
      instructor: g.instructor,
      academicYear,
      semester,
      action: "ROLLBACK",
      isResolved: true,
      importedName: fullUserName,
    }));

    // ── 5. Execute transaction: delete grades + create log entries ─────
    const [, logResult] = await prisma.$transaction([
      prisma.grade.deleteMany({
        where: { id: { in: gradeIds } },
      }),
      prisma.gradeLog.createMany({
        data: rollbackLogData,
      }),
    ]);

    return {
      deletedCount: gradeIds.length,
      rollbackLogIds: [],
    };
  } catch (error) {
    console.error("Failed to rollback faculty grades", error);
    throw new Error(
      `Rollback failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
