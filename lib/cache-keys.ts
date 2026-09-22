/**
 * Canonical Redis cache-key builders for student grade data.
 *
 * These live in a dependency-free module (no Prisma, no Clerk, no Redis client)
 * so that both the read paths in `actions/student-grades/student-grades.ts` and
 * every mutation path that invalidates the cache import the *same* builder.
 *
 * Symptom prevented: an interaction-free copy of a cache key silently drifting
 * out of sync with the writer, which leaves stale grades in Redis until the TTL
 * expires — and, historically, served one student's grades to another student.
 *
 * IMPORTANT: there are two independently-prefixed families of student grade
 * caches. Both must be invalidated on every grade mutation:
 *   1. `cache:student:<id>:*`  — this module (full record, history, term slices)
 *   2. `cache:grades:<id>:*`   — the per-term cache written by `getGrades()`
 * Use {@link studentGradeCacheInvalidation} to get both in one call.
 */

/** Prefix shared by every cached student payload (`cache:student:<id>:`). */
export const STUDENT_CACHE_PREFIX = "cache:student:";

/**
 * Prefix used by `getGrades()` for its per-(student, term) payloads.
 * Distinct from {@link STUDENT_CACHE_PREFIX} — do not assume either covers the
 * other.
 */
export const GRADES_CACHE_PREFIX = "cache:grades:";

/**
 * Key for the full student record incl. all terms and re-exam history.
 * `getStudentData` writes this; several mutations invalidate it.
 */
export function studentCacheKey(userId: string): string {
  return `${STUDENT_CACHE_PREFIX}${userId}:v1`;
}

/**
 * Key for the complete grade history returned by `getStudentGradesWithReExam`.
 *
 * Scoped by the *resolved* student id (not the acting user) because admins,
 * faculty and registrar staff may request any student's history — keying by
 * caller would let one student's grades be reused for another.
 */
export function studentGradesCacheKey(studentId: string): string {
  return `${STUDENT_CACHE_PREFIX}${studentId}:gradesWithReExam:v2`;
}

/** Key for a single student's grades restricted to one academic term. */
export function studentTermGradesCacheKey(
  studentId: string,
  academicYear: string,
  semester: string,
): string {
  return `${STUDENT_CACHE_PREFIX}${studentId}:termGrades:${academicYear}:${semester}:v1`;
}

/**
 * Key written by `getGrades(userId, year, semester)`.
 * Mirrors the literal in `actions/student-grades/student-grades.ts`.
 */
export function studentGetGradesCacheKey(
  userId: string,
  year?: string | null,
  semester?: string | null,
): string {
  return `${GRADES_CACHE_PREFIX}${userId}:${year ?? "ALL"}:${
    semester ?? "ALL"
  }:v1`;
}

/** Glob covering every cache this module writes for one student. */
export function studentAllGradeCachePattern(studentId: string): string {
  return `${STUDENT_CACHE_PREFIX}${studentId}:*`;
}

/** Glob covering every per-term `getGrades()` cache for one student. */
export function studentGetGradesCachePattern(studentId: string): string {
  return `${GRADES_CACHE_PREFIX}${studentId}:*`;
}

/**
 * Everything that must be cleared after any grade mutation for one student,
 * across BOTH cache families.
 *
 * Prefer this over hand-writing key strings at mutation sites — drifting string
 * literals are exactly what caused stale (and mis-attributed) grades to be
 * served after an edit.
 *
 * @returns `del` exact keys and `patterns` globs to pass to invalidateByPattern.
 */
export function studentGradeCacheInvalidation(studentId: string): {
  del: string[];
  patterns: string[];
} {
  return {
    del: [studentCacheKey(studentId), studentGradesCacheKey(studentId)],
    patterns: [
      studentAllGradeCachePattern(studentId),
      studentGetGradesCachePattern(studentId),
    ],
  };
}

/**
 * Convenience helper that clears every grade-bearing cache for one student.
 * Accepts the minimal Redis surface so callers can pass either the shared
 * client or a stub in tests.
 */
export async function invalidateStudentGradeCaches(
  studentId: string,
  client: {
    del: (...keys: string[]) => Promise<unknown>;
  },
  invalidateByPattern?: (pattern: string) => Promise<unknown>,
): Promise<void> {
  const { del, patterns } = studentGradeCacheInvalidation(studentId);

  await Promise.all([
    client.del(...del).catch(() => {}),
    ...patterns.map((p) => invalidateByPattern?.(p).catch(() => {})),
  ]).catch(() => {});
}
