import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for the COG cross-term contamination bug.
 *
 * Symptom: generating a COG for AY_2024_2025/FIRST worked, but generating a
 * second COG for a different academic year + semester returned the *previous*
 * term's grades.
 *
 * Root cause: getStudentGradesWithReExam cached its result under a key that was
 * not scoped to the requested student, so the first caller's grade set was
 * served to every later caller. The admin COG path (getStudentGradesWithReExam(studentId))
 * was therefore poisoned by whatever student or term had been fetched first.
 */

import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { STUDENT_CACHE_PREFIX } from "@/lib/cache-keys";
import { clerkClient, setAuthAdmin } from "./__mocks__/clerk";

const TERM_A = { academicYear: "AY_2024_2025", semester: "FIRST" };
const TERM_B = { academicYear: "AY_2025_2026", semester: "SECOND" };

function grade(overrides: Record<string, unknown>) {
  return {
    courseCode: "CS101",
    courseTitle: "Intro",
    creditUnit: 3,
    grade: "1.75",
    reExam: null,
    remarks: "PASSED",
    instructor: "DR. SMITH",
    attemptNumber: 1,
    isRetaken: false,
    retakenAYSem: null,
    reassignedFromAYSem: null,
    ...TERM_A,
    ...overrides,
  };
}

/** In-memory Redis stand-in so the cache behaves like the real thing. */
function installRedisStore() {
  const store = new Map<string, string>();
  (redis.get as any).mockImplementation(async (key: string) => store.get(key) ?? null);
  (redis.set as any).mockImplementation(async (key: string, value: string) => {
    store.set(key, value);
    return "OK";
  });
  (redis.del as any).mockImplementation(async (key: string) => {
    store.delete(key);
    return 1;
  });
  return store;
}

/** Cache keys written for the grade payloads only, excluding settings caches. */
function writtenGradeCacheKeys(): string[] {
  return (redis.set as any).mock.calls
    .map((c: any[]) => String(c[0]))
    .filter((key: string) => key.startsWith(STUDENT_CACHE_PREFIX));
}

/**
 * Student fixture that honours the Prisma `grades.where` term filter, so the
 * test exercises the real "ask the DB for one term" behaviour instead of
 * returning every grade regardless of the query.
 */
function mockStudentWithTermFiltering(grades: any[]) {
  (prisma.student.findUnique as any).mockImplementation(
    async ({ where, select }: any) => ({
      studentNumber: where.id,
      firstName: "Alice",
      lastName: "Doe",
      middleInit: "A",
      course: "BSIT",
      major: "NONE",
      address: "Bacoor",
      phone: "0917",
      grades: applyTermFilter(grades, select?.grades?.where),
    }),
  );
}

/** Mirrors the Prisma `grades.where` term filter in memory. */
function applyTermFilter(grades: any[], termFilter?: any) {
  if (!termFilter) return grades;
  return grades.filter(
    (g) =>
      g.academicYear === termFilter.academicYear &&
      g.semester === termFilter.semester,
  );
}

/**
 * The shared Clerk mock resolves every user to one fixed role. This test needs
 * "student-a"/"student-b" (the mocked data ids) to resolve as students while the
 * acting admin resolves as an admin, so map ids to roles explicitly.
 */
function mockClerkRoles(roles: Record<string, string>) {
  (clerkClient as any).mockReturnValue({
    users: {
      getUser: vi.fn(async (id: string) => ({
        id,
        publicMetadata: { role: roles[id] ?? "admin" },
        firstName: "Test",
        lastName: "User",
        fullName: "Test User",
      })),
    },
  });
}

/** Student fixture whose grade set differs per student id. */
function mockGradesByStudent(gradesByStudent: Record<string, any[]>) {
  (prisma.student.findUnique as any).mockImplementation(
    async ({ where, select }: any) => ({
      studentNumber: where.id,
      firstName: "Alice",
      lastName: "Doe",
      middleInit: "A",
      course: "BSIT",
      major: "NONE",
      address: "Bacoor",
      phone: "0917",
      grades: applyTermFilter(gradesByStudent[where.id] ?? [], select?.grades?.where),
    }),
  );
}

describe("COG term isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installRedisStore();
    setAuthAdmin();
    // Every mocked student id resolves as a student; the acting admin does not.
    mockClerkRoles({ "student-a": "student", "student-b": "student" });
  });

  it("returns the requested student's grades when two different students are fetched in sequence", async () => {
    // Both students have exactly one grade, in the same term, but different
    // course codes — so a leaked cache entry is unmistakable.
    const gradesByStudent: Record<string, any[]> = {
      "student-a": [grade({ courseCode: "CS101" })],
      "student-b": [grade({ courseCode: "MATH201" })],
    };

    mockGradesByStudent(gradesByStudent);

    const { getStudentGradesWithReExam } = await import(
      "@/actions/student-grades/student-grades"
    );

    const first = await getStudentGradesWithReExam("student-a");
    const second = await getStudentGradesWithReExam("student-b");

    expect(first.student?.grades[0].courseCode).toBe("CS101");
    // Must NOT be served student-a's cached grade set.
    expect(second.student?.grades[0].courseCode).toBe("MATH201");
  });

  it("does not serve term A grades for a term B COG request", async () => {
    mockStudentWithTermFiltering([
      grade(TERM_A),
      grade({ courseCode: "MATH201", ...TERM_B }),
    ]);

    const { getStudentGradesWithReExam, getStudentGradesForTerm } = await import(
      "@/actions/student-grades/student-grades"
    );

    const fullHistory = await getStudentGradesWithReExam("student-a");
    const termB = await getStudentGradesForTerm(
      "student-a",
      TERM_B.academicYear,
      TERM_B.semester,
    );

    // The unscoped reader still returns the whole history...
    expect(fullHistory.student?.grades).toHaveLength(2);

    // ...but the term reader must forward the requested term to Prisma and
    // return only that term's grades, never the cached term A payload.
    const lastCall = (prisma.student.findUnique as any).mock.calls.at(-1)[0];
    expect(lastCall.select.grades.where).toEqual({
      academicYear: TERM_B.academicYear,
      semester: TERM_B.semester,
    });
    expect(termB.student?.grades).toHaveLength(1);
    expect(termB.student?.grades[0].academicYear).toBe(TERM_B.academicYear);
    expect(termB.student?.grades[0].semester).toBe(TERM_B.semester);
  });

  it("scopes the admin cache key per student and per term", async () => {
    mockStudentWithTermFiltering([grade(TERM_A)]);

    const { getStudentGradesForTerm } = await import(
      "@/actions/student-grades/student-grades"
    );

    await getStudentGradesForTerm("student-a", TERM_A.academicYear, TERM_A.semester);

    const setKeys = writtenGradeCacheKeys();
    expect(setKeys.length).toBeGreaterThan(0);
    for (const key of setKeys) {
      expect(key).toContain("student-a");
      expect(key).toContain(TERM_A.academicYear);
      expect(key).toContain(TERM_A.semester);
    }
  });
});

describe("studentGradeCacheInvalidation", () => {
  it("clears both cache families, including the getGrades per-term cache", async () => {
    const { studentGradeCacheInvalidation, studentGetGradesCacheKey } =
      await import("@/lib/cache-keys");

    const { del, patterns } = studentGradeCacheInvalidation("student-a");

    // Exact keys: the full student record and the full grade history.
    expect(del).toContain("cache:student:student-a:v1");
    expect(del).toContain("cache:student:student-a:gradesWithReExam:v2");

    // Globs must cover the family this module owns AND the separately-prefixed
    // getGrades() cache — missing the latter was a real regression.
    expect(patterns).toContain("cache:student:student-a:*");
    expect(patterns).toContain("cache:grades:student-a:*");

    const getGradesKey = studentGetGradesCacheKey("student-a", "AY_2024_2025", "FIRST");
    expect(getGradesKey).toBe("cache:grades:student-a:AY_2024_2025:FIRST:v1");
    expect(patterns.some((p) => p.startsWith("cache:grades:student-a:"))).toBe(true);
  });

  it("defaults the getGrades cache key to ALL when no term is supplied", async () => {
    const { studentGetGradesCacheKey } = await import("@/lib/cache-keys");
    expect(studentGetGradesCacheKey("student-a")).toBe(
      "cache:grades:student-a:ALL:ALL:v1",
    );
  });
});
