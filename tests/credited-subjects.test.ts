import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import {
  setAuth,
  setAuthAdmin,
  setAuthFaculty,
  setAuthRegistrar,
  setAuthRegistrarStaff,
  setAuthStudent,
  setAuthUnauthenticated,
} from "./__mocks__/clerk";

/**
 * Credited subjects are courses a student took at another institution. The
 * details of how they were taken there — grade, remarks, instructor — are now
 * recorded alongside the school name, and they are per subject: a transferee
 * earns a different grade in each credited course.
 */

type CreditedSubjectsModule = typeof import("@/actions/credited-subjects");

let actions: CreditedSubjectsModule;

const STUDENT_NUMBER = "20210010";
const CACHE_KEY = `cache:creditedCodes:${STUDENT_NUMBER}:v1`;

const baseSingle = {
  studentNumber: STUDENT_NUMBER,
  courseCode: "CS101",
  courseTitle: "Intro to Computing",
  creditUnits: 3,
};

beforeEach(async () => {
  vi.clearAllMocks();
  setAuthAdmin();
  actions = await import("@/actions/credited-subjects");

  // Defaults: the student exists and nothing is credited yet.
  (prisma.student.findUnique as any).mockResolvedValue({
    studentNumber: STUDENT_NUMBER,
  });
  (prisma.creditedSubject.findUnique as any).mockResolvedValue(null);
  (prisma.creditedSubject.create as any).mockResolvedValue({ id: "cs-1" });
  (prisma.creditedSubject.findMany as any).mockResolvedValue([]);
  (prisma.creditedSubject.count as any).mockResolvedValue(0);
  (redis.get as any).mockResolvedValue(null);
});

describe("addCreditedSubject — previous-school details", () => {
  it("stores grade, remarks and instructor", async () => {
    await actions.addCreditedSubject({
      ...baseSingle,
      courseCode: "gneD 11",
      courseTitle: "understanding the self",
      schoolName: "University of the Philippines",
      notes: "Equivalent to GNED 11",
      grade: "1.75",
      remarks: "PASSED",
      instructor: "Prof. Dela Cruz",
    });

    expect(prisma.creditedSubject.create).toHaveBeenCalledWith({
      data: {
        studentNumber: STUDENT_NUMBER,
        // Course identity is normalised, the free-text details are not.
        courseCode: "GNED 11",
        courseTitle: "UNDERSTANDING THE SELF",
        creditUnits: 3,
        schoolName: "University of the Philippines",
        notes: "Equivalent to GNED 11",
        grade: "1.75",
        remarks: "PASSED",
        instructor: "Prof. Dela Cruz",
      },
    });
  });

  it("stores whitespace-only details as NULL, not empty strings", async () => {
    await actions.addCreditedSubject({
      ...baseSingle,
      grade: "   ",
      remarks: "",
      instructor: undefined,
    });

    const { data } = (prisma.creditedSubject.create as any).mock.calls[0][0];
    // The table renders "—" for falsy values, which an empty string would
    // defeat by rendering an invisible cell.
    expect(data.grade).toBeNull();
    expect(data.remarks).toBeNull();
    expect(data.instructor).toBeNull();
  });

  it("accepts grades from a foreign scale, which 1.00–5.00 would reject", async () => {
    const result = await actions.addCreditedSubject({
      ...baseSingle,
      grade: "A-",
      remarks: "PASSED",
    });

    expect(result.success).toBe(true);
    const { data } = (prisma.creditedSubject.create as any).mock.calls[0][0];
    expect(data.grade).toBe("A-");
  });

  it("rejects an over-long grade without touching the database", async () => {
    const result = await actions.addCreditedSubject({
      ...baseSingle,
      grade: "x".repeat(51),
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Grade is too long");
    expect(prisma.creditedSubject.create).not.toHaveBeenCalled();
  });

  it("still refuses a duplicate course code", async () => {
    (prisma.creditedSubject.findUnique as any).mockResolvedValue({
      id: "existing",
    });

    const result = await actions.addCreditedSubject({
      ...baseSingle,
      grade: "1.00",
    });

    expect(result.success).toBe(false);
    expect(prisma.creditedSubject.create).not.toHaveBeenCalled();
  });
});

describe("bulkAddCreditedSubjects — per-subject details", () => {
  it("keeps a separate grade and instructor for each subject", async () => {
    const result = await actions.bulkAddCreditedSubjects({
      studentNumber: STUDENT_NUMBER,
      subjects: [
        {
          courseCode: "CS101",
          courseTitle: "Intro",
          creditUnits: 3,
          grade: "1.25",
          remarks: "PASSED",
          instructor: "Prof. A",
        },
        {
          courseCode: "CS102",
          courseTitle: "Data Structures",
          creditUnits: 4,
          grade: "2.00",
          remarks: "PASSED",
          instructor: "Prof. B",
        },
      ],
    });

    expect(result.created).toBe(2);

    const { data } = (prisma.creditedSubject.createMany as any).mock.calls[0][0];
    expect(data).toHaveLength(2);
    // The whole point: values must not collapse into one shared grade.
    expect(data[0]).toMatchObject({
      courseCode: "CS101",
      creditUnits: 3,
      grade: "1.25",
      instructor: "Prof. A",
    });
    expect(data[1]).toMatchObject({
      courseCode: "CS102",
      creditUnits: 4,
      grade: "2.00",
      instructor: "Prof. B",
    });
  });

  it("applies the shared school and notes to every subject", async () => {
    await actions.bulkAddCreditedSubjects({
      studentNumber: STUDENT_NUMBER,
      subjects: [
        {
          courseCode: "CS101",
          courseTitle: "Intro",
          creditUnits: 3,
          schoolName: "University of the Philippines",
          notes: "Credited from TOR",
        },
        {
          courseCode: "CS102",
          courseTitle: "Data",
          creditUnits: 3,
          schoolName: "University of the Philippines",
          notes: "Credited from TOR",
        },
      ],
    });

    const { data } = (prisma.creditedSubject.createMany as any).mock.calls[0][0];
    expect(data).toHaveLength(2);
    // The UI collects one school for the whole batch and fans it out per row.
    for (const row of data) {
      expect(row.schoolName).toBe("University of the Philippines");
      expect(row.notes).toBe("Credited from TOR");
    }
  });

  it("leaves subjects with no details as NULL", async () => {
    await actions.bulkAddCreditedSubjects({
      studentNumber: STUDENT_NUMBER,
      subjects: [{ courseCode: "CS101", courseTitle: "Intro", creditUnits: 3 }],
    });

    const { data } = (prisma.creditedSubject.createMany as any).mock.calls[0][0];
    expect(data[0].grade).toBeNull();
    expect(data[0].remarks).toBeNull();
    expect(data[0].instructor).toBeNull();
  });

  it("skips subjects that are already credited", async () => {
    (prisma.creditedSubject.findMany as any).mockResolvedValue([
      { courseCode: "CS101" },
    ]);

    const result = await actions.bulkAddCreditedSubjects({
      studentNumber: STUDENT_NUMBER,
      subjects: [
        { courseCode: "CS101", courseTitle: "Intro", creditUnits: 3, grade: "1.00" },
        { courseCode: "CS102", courseTitle: "Data", creditUnits: 3, grade: "2.00" },
      ],
    });

    expect(result.created).toBe(1);
    const { data } = (prisma.creditedSubject.createMany as any).mock.calls[0][0];
    expect(data.map((d: any) => d.courseCode)).toEqual(["CS102"]);
  });
});

describe("credited-code cache invalidation", () => {
  // getCreditedSubjectCodes caches for 600s, so without invalidation the
  // curriculum checklist can show a freshly credited subject as "Not Taken".
  it("drops the cache after a single add", async () => {
    await actions.addCreditedSubject(baseSingle);
    expect(redis.del).toHaveBeenCalledWith(CACHE_KEY);
  });

  it("drops the cache after a bulk add", async () => {
    await actions.bulkAddCreditedSubjects({
      studentNumber: STUDENT_NUMBER,
      subjects: [{ courseCode: "CS101", courseTitle: "Intro", creditUnits: 3 }],
    });
    expect(redis.del).toHaveBeenCalledWith(CACHE_KEY);
  });

  it("drops the cache after a removal", async () => {
    (prisma.creditedSubject.findUnique as any).mockResolvedValue({
      id: "cs-1",
      studentNumber: STUDENT_NUMBER,
      courseCode: "CS101",
    });

    await actions.removeCreditedSubject({ id: "cs-1" });
    expect(redis.del).toHaveBeenCalledWith(CACHE_KEY);
  });

  it("drops the cache after clearing all subjects", async () => {
    (prisma.creditedSubject.count as any).mockResolvedValue(2);

    await actions.clearCreditedSubjects(STUDENT_NUMBER);
    expect(redis.del).toHaveBeenCalledWith(CACHE_KEY);
  });

  it("populates the cache under the same key the invalidators clear", async () => {
    const map = { CS101: { courseTitle: "INTRO", creditUnits: 3 } };
    (prisma.creditedSubject.findMany as any).mockResolvedValue([
      { courseCode: "CS101", courseTitle: "INTRO", creditUnits: 3 },
    ]);

    const codes = await actions.getCreditedSubjectCodes(STUDENT_NUMBER);

    expect(codes).toEqual(map);
    // The reader writes CACHE_KEY; the invalidation tests above assert the
    // mutations delete that same literal. If either key drifts, one of the two
    // sets of assertions fails.
    expect(redis.set).toHaveBeenCalledWith(
      CACHE_KEY,
      JSON.stringify(map),
      "EX",
      600,
    );
  });

  it("serves from the cache without hitting the database", async () => {
    (redis.get as any).mockResolvedValue(
      JSON.stringify({ CS101: { courseTitle: "INTRO", creditUnits: 3 } }),
    );

    const codes = await actions.getCreditedSubjectCodes(STUDENT_NUMBER);

    expect(codes).toEqual({ CS101: { courseTitle: "INTRO", creditUnits: 3 } });
    expect(prisma.creditedSubject.findMany).not.toHaveBeenCalled();
  });
});

describe("credited subject role gate", () => {
  const input = { ...baseSingle, grade: "1.50" };

  it("rejects an unauthenticated caller", async () => {
    setAuthUnauthenticated();
    await expect(actions.addCreditedSubject(input)).rejects.toThrow(
      "Unauthorized",
    );
  });

  it.each([
    ["faculty", setAuthFaculty],
    ["student", setAuthStudent],
    ["csg", () => setAuth({ userId: "csg-1", role: "csg" })],
  ])("rejects the %s role", async (_role, applyAuth) => {
    (applyAuth as () => void)();
    await expect(actions.addCreditedSubject(input)).rejects.toThrow(/Forbidden/);
    expect(prisma.creditedSubject.create).not.toHaveBeenCalled();
  });

  it.each([
    ["admin", setAuthAdmin],
    ["registrar", setAuthRegistrar],
    ["registrar_staff", setAuthRegistrarStaff],
  ])("permits the %s role", async (_role, applyAuth) => {
    (applyAuth as () => void)();
    const result = await actions.addCreditedSubject(input);
    expect(result.success).toBe(true);
  });
});
