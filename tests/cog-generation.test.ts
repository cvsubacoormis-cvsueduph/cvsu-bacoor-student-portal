import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  canExportGrades,
  canGenerateCOG,
  COG_GENERATION_ROLES,
  COG_FORBIDDEN_MESSAGE,
  GRADE_EXPORT_ROLES,
} from "@/lib/cog-roles";
import {
  clerkClient,
  setAuthAdmin,
  setAuthRegistrar,
  setAuthRegistrarStaff,
  setAuthSuperuser,
  setAuthFaculty,
  setAuthStudent,
  setAuthUnauthenticated,
} from "./__mocks__/clerk";

function mockClerkRole(role: string) {
  (clerkClient as any).mockReturnValue({
    users: {
      getUser: vi.fn(async (id: string) => ({
        id,
        publicMetadata: { role },
        firstName: "Test",
        lastName: "User",
        fullName: "Test User",
      })),
    },
  });
}

describe("COG role gate", () => {
  it("permits admin, registrar and registrar staff to generate a COG", () => {
    expect([...COG_GENERATION_ROLES]).toEqual([
      "admin",
      "registrar",
      "registrar_staff",
    ]);
    expect(canGenerateCOG("admin")).toBe(true);
    expect(canGenerateCOG("registrar")).toBe(true);
    // Registrar staff issue certificates as day-to-day registrar work.
    expect(canGenerateCOG("registrar_staff")).toBe(true);
  });

  it.each(["superuser", "faculty", "student", "csg", undefined, "", null])(
    "denies %s",
    (role) => {
      expect(canGenerateCOG(role)).toBe(false);
    },
  );

  it("describes the gate accurately in its message", () => {
    expect(COG_FORBIDDEN_MESSAGE).toContain("admins");
    expect(COG_FORBIDDEN_MESSAGE).toContain("registrars");
    expect(COG_FORBIDDEN_MESSAGE).toContain("registrar staff");
  });

  /**
   * Generation and export are separate privileges and must not share a list.
   * Collapsing them once removed a capability registrar staff had always had.
   */
  it("keeps the grade export gate narrower than COG generation", () => {
    expect([...GRADE_EXPORT_ROLES]).toEqual(["admin", "registrar"]);
    expect(canExportGrades("admin")).toBe(true);
    expect(canExportGrades("registrar")).toBe(true);
    // Registrar staff may generate a COG but may not bulk-export a term.
    expect(canGenerateCOG("registrar_staff")).toBe(true);
    expect(canExportGrades("registrar_staff")).toBe(false);
    expect(canExportGrades("superuser")).toBe(false);
  });
});

describe("generateCOGAdminWithRateLimit", () => {
  let generate: (
    studentId: string,
    academicYear: string,
    semester: string,
  ) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    setAuthUnauthenticated();
    const mod = await import("@/actions/document-generation");
    generate = mod.generateCOGAdminWithRateLimit;
    (prisma.student.findUnique as any).mockResolvedValue({
      studentNumber: "20210010",
      firstName: "Alice",
      lastName: "Doe",
      middleInit: "A",
      course: "BSIT",
      major: "NONE",
      address: "Bacoor",
      phone: "0917",
      grades: [
        {
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
          academicYear: "AY_2024_2025",
          semester: "FIRST",
          reassignedFromAYSem: null,
        },
      ],
    });
  });

  it("throws Unauthorized when not signed in", async () => {
    await expect(
      generate("student-a", "AY_2024_2025", "FIRST"),
    ).rejects.toThrow("Unauthorized");
  });

  it.each(["faculty", "superuser", "student", "csg"])(
    "rejects the %s role",
    async (role) => {
      setAuthAdmin();
      mockClerkRole(role);
      await expect(
        generate("student-a", "AY_2024_2025", "FIRST"),
      ).rejects.toThrow(COG_FORBIDDEN_MESSAGE);
    },
  );

  it.each(["admin", "registrar", "registrar_staff"])(
    "permits the %s role",
    async (role) => {
      if (role === "admin") setAuthAdmin();
      else if (role === "registrar") setAuthRegistrar();
      else setAuthRegistrarStaff();

      mockClerkRole(role);

      const result = await generate("student-a", "AY_2024_2025", "FIRST");
      expect(result.student.studentNumber).toBe("20210010");
    },
  );

  it("requires an academic year and semester", async () => {
    setAuthRegistrar();
    mockClerkRole("registrar");
    await expect(generate("student-a", "", "FIRST")).rejects.toThrow(
      /academic year and semester/i,
    );
  });

  it("passes the requested term through to the database", async () => {
    setAuthRegistrar();
    mockClerkRole("registrar");

    await generate("student-a", "AY_2024_2025", "FIRST");

    const call = (prisma.student.findUnique as any).mock.calls.at(-1)[0];
    expect(call.select.grades.where).toEqual({
      academicYear: "AY_2024_2025",
      semester: "FIRST",
    });
  });

  it("reports an empty term instead of emitting a blank COG", async () => {
    setAuthRegistrar();
    mockClerkRole("registrar");
    (prisma.student.findUnique as any).mockResolvedValue({
      studentNumber: "20210010",
      firstName: "Alice",
      lastName: "Doe",
      middleInit: "A",
      course: "BSIT",
      major: "NONE",
      address: "Bacoor",
      phone: "0917",
      grades: [],
    });

    await expect(
      generate("student-a", "AY_2024_2025", "SECOND"),
    ).rejects.toThrow(/no grades found/i);
  });
});

describe("getStudentIdByNumber", () => {
  /**
   * `actions/student-grades/student-grades.ts` captures `clerkClient()` at
   * module-eval time, so the Clerk mock must be configured BEFORE the dynamic
   * import (same constraint AGENTS.md documents for route handlers). Each test
   * therefore re-imports after setting the auth + role.
   */
  async function load(role: string | null, auth: () => void) {
    vi.resetModules();
    auth();
    if (role) mockClerkRole(role);
    const mod = await import("@/actions/student-grades/student-grades");
    return mod.getStudentIdByNumber;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setAuthUnauthenticated();
  });

  it("returns null when unauthenticated", async () => {
    const resolveId = await load(null, setAuthUnauthenticated);
    await expect(resolveId("20210010")).resolves.toBeNull();
  });

  it("returns null for a role that cannot read grades", async () => {
    const resolveId = await load("csg", setAuthRegistrar);
    await expect(resolveId("20210010")).resolves.toBeNull();
  });

  it("resolves a student number for staff", async () => {
    const resolveId = await load("registrar", setAuthRegistrar);
    (prisma.student.findUnique as any).mockResolvedValue({ id: "student-a" });

    await expect(resolveId("20210010")).resolves.toBe("student-a");
  });

  it("only lets a student resolve their own record", async () => {
    const resolveId = await load("student", setAuthStudent);
    (prisma.student.findUnique as any).mockResolvedValue({
      id: "student-123",
      studentNumber: "20210010",
    });

    await expect(resolveId("20210010")).resolves.toBe("student-123");
    // Someone else's number must not resolve.
    await expect(resolveId("99999999")).resolves.toBeNull();
  });
});

/**
 * The student portal (components/GenerateCOG.tsx) calls this action. Its
 * signature is unchanged, but its internals were switched from
 * "fetch all history then filter in memory" to a term-scoped query — so the
 * behaviour needs its own coverage rather than relying on the admin path's.
 */
describe("generateCOGWithRateLimit (student path)", () => {
  const STUDENT_ID = "student-123";

  async function load() {
    vi.resetModules();
    setAuthStudent();
    mockClerkRole("student");
    const mod = await import("@/actions/document-generation");
    return mod.generateCOGWithRateLimit;
  }

  function mockStudent(grades: any[]) {
    (prisma.student.findUnique as any).mockResolvedValue({
      studentNumber: "20210010",
      firstName: "John",
      lastName: "Doe",
      middleInit: "A",
      course: "BSIT",
      major: "NONE",
      address: "Bacoor",
      phone: "0917",
      grades,
    });
  }

  const termGrade = {
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
    academicYear: "AY_2024_2025",
    semester: "FIRST",
    reassignedFromAYSem: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setAuthUnauthenticated();
  });

  it("scopes the query to the calling student and requested term", async () => {
    const generate = await load();
    mockStudent([termGrade]);

    const result = await generate("AY_2024_2025", "FIRST");

    const call = (prisma.student.findUnique as any).mock.calls.at(-1)[0];
    // Resolved to the *caller's own* id, never a client-supplied one.
    expect(call.where).toEqual({ id: STUDENT_ID });
    expect(call.select.grades.where).toEqual({
      academicYear: "AY_2024_2025",
      semester: "FIRST",
    });

    expect(result.student.studentNumber).toBe("20210010");
    expect(result.student.grades).toHaveLength(1);
  });

  it("does not leak another term's grades", async () => {
    const generate = await load();
    mockStudent([termGrade]);

    const result = await generate("AY_2025_2026", "SECOND");

    const call = (prisma.student.findUnique as any).mock.calls.at(-1)[0];
    // The term the caller asked for is what reaches the database.
    expect(call.select.grades.where).toEqual({
      academicYear: "AY_2025_2026",
      semester: "SECOND",
    });
    expect(result.student.grades).toHaveLength(1);
  });

  it("reports an empty term rather than emitting a blank COG", async () => {
    const generate = await load();
    mockStudent([]);

    await expect(generate("AY_2024_2025", "FIRST")).rejects.toThrow(
      /no grades found/i,
    );
  });

  it("refuses when grades are hidden by the faculty", async () => {
    const generate = await load();
    mockStudent([termGrade]);
    (prisma.systemSettings.findUnique as any).mockResolvedValue({
      value: "false",
    });

    await expect(generate("AY_2024_2025", "FIRST")).rejects.toThrow(
      /hidden by the faculty/i,
    );
  });
});
