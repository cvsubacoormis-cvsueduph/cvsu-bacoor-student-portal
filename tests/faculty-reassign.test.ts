import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  setAuthUnauthenticated,
  setAuthAdmin,
  setAuthFaculty,
} from "./__mocks__/clerk";

// ── Local Prisma mock ───────────────────────────────────────────────────────
// Overrides the global setup mock so $transaction actually invokes its
// callback with the mock client (the setup mock resolves [] without running
// the callback, which would silently skip the reassignment writes).
const prismaMock = vi.hoisted(() => {
  const mock: any = {
    user: {
      findUnique: vi.fn(),
    },
    grade: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    gradeLog: {
      createMany: vi.fn(),
    },
    academicTerm: {
      upsert: vi.fn(),
    },
    subjectOffering: {
      findMany: vi.fn(),
    },
    student: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn((arg: any) => {
      if (typeof arg === "function") {
        return arg(mock);
      }
      return Promise.resolve([]);
    }),
  };
  return mock;
});

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { reassignFacultyGrades } from "@/actions/faculty-monitoring";

const FACULTY = {
  id: "fac-1",
  firstName: "Juan",
  lastName: "Santos",
  middleInit: null,
  username: "jsantos",
};

function makeGrade(overrides: Record<string, unknown> = {}) {
  return {
    id: "grade-1",
    studentNumber: "20240001",
    courseCode: "IT101",
    courseTitle: "Introduction to IT",
    creditUnit: 3,
    grade: "1.50",
    remarks: null,
    instructor: "Juan Santos",
    uploadedBy: "Juan Santos",
    subjectOfferingId: null,
    ...overrides,
  };
}

const BASE_PARAMS = {
  facultyId: "fac-1",
  fromAcademicYear: "AY_2024_2025",
  fromSemester: "FIRST",
  toAcademicYear: "AY_2025_2026",
  toSemester: "SECOND",
} as const;

describe("reassignFacultyGrades", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock.user.findUnique.mockResolvedValue(FACULTY);
    prismaMock.grade.update.mockResolvedValue({});
    prismaMock.gradeLog.createMany.mockResolvedValue({ count: 0 });
    prismaMock.academicTerm.upsert.mockResolvedValue({});
    prismaMock.subjectOffering.findMany.mockResolvedValue([]);
    prismaMock.student.findMany.mockResolvedValue([{ id: "user-1" }]);
  });

  it("throws when unauthenticated", async () => {
    setAuthUnauthenticated();
    await expect(
      reassignFacultyGrades({
        ...BASE_PARAMS,
        toAcademicYear: "AY_2025_2026" as const,
        toSemester: "SECOND" as const,
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("throws for non-admin roles (faculty)", async () => {
    setAuthFaculty();
    await expect(
      reassignFacultyGrades({
        ...BASE_PARAMS,
        toAcademicYear: "AY_2025_2026" as const,
        toSemester: "SECOND" as const,
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("throws when source and target terms are identical", async () => {
    setAuthAdmin();
    await expect(
      reassignFacultyGrades({
        ...BASE_PARAMS,
        toAcademicYear: "AY_2024_2025" as const,
        toSemester: "FIRST" as const,
      }),
    ).rejects.toThrow("must be different");
  });

  it("throws on invalid academic year values", async () => {
    setAuthAdmin();
    await expect(
      reassignFacultyGrades({
        ...BASE_PARAMS,
        toAcademicYear: "AY_2099_2100" as never,
        toSemester: "SECOND" as const,
      }),
    ).rejects.toThrow("Invalid academic year or semester");
  });

  it("moves all attributed grades to the target term", async () => {
    setAuthAdmin();

    const grades = [
      makeGrade({ id: "g1", studentNumber: "20240001" }),
      makeGrade({ id: "g2", studentNumber: "20240002", courseCode: "IT102" }),
    ];

    // Call #1: candidate grades in the source term.
    prismaMock.grade.findMany.mockResolvedValueOnce(grades);
    // Call #2: existing grades in the target term (conflict detection).
    prismaMock.grade.findMany.mockResolvedValueOnce([]);

    const result = await reassignFacultyGrades({
      ...BASE_PARAMS,
      toAcademicYear: "AY_2025_2026" as const,
      toSemester: "SECOND" as const,
    });

    expect(result.movedCount).toBe(2);
    expect(result.skippedCount).toBe(0);
    expect(result.totalCount).toBe(2);
    expect(result.conflicts).toEqual([]);

    // Target term must be ensured.
    expect(prismaMock.academicTerm.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          academicYear_semester: {
            academicYear: "AY_2025_2026",
            semester: "SECOND",
          },
        },
        create: {
          academicYear: "AY_2025_2026",
          semester: "SECOND",
        },
      }),
    );

    // Every grade was updated to the target term and flagged as reassigned.
    expect(prismaMock.grade.update).toHaveBeenCalledTimes(2);
    for (const g of grades) {
      expect(prismaMock.grade.update).toHaveBeenCalledWith({
        where: { id: g.id },
        data: expect.objectContaining({
          academicYear: "AY_2025_2026",
          semester: "SECOND",
          reassignedFromAYSem: "AY_2024_2025 / FIRST",
        }),
      });
    }

    // Audit logs were written against the source term.
    expect(prismaMock.gradeLog.createMany).toHaveBeenCalledTimes(1);
    const logCall = prismaMock.gradeLog.createMany.mock.calls[0][0];
    expect(logCall.data).toHaveLength(2);
    expect(logCall.data[0]).toMatchObject({
      academicYear: "AY_2024_2025",
      semester: "FIRST",
      action: "REASSIGNED",
      changeReason: "Reassigned to AY_2025_2026 / SECOND",
    });
  });

  it("skips grades that already exist in the target term", async () => {
    setAuthAdmin();

    const grades = [
      makeGrade({ id: "g1", studentNumber: "20240001", courseCode: "IT101" }),
      makeGrade({ id: "g2", studentNumber: "20240002", courseCode: "IT102" }),
      makeGrade({ id: "g3", studentNumber: "20240003", courseCode: "IT103" }),
    ];

    prismaMock.grade.findMany.mockResolvedValueOnce(grades);
    // One conflicting (student, course) pair already exists in the target term.
    prismaMock.grade.findMany.mockResolvedValueOnce([
      { studentNumber: "20240001", courseCode: "IT101" },
    ]);

    const result = await reassignFacultyGrades({
      ...BASE_PARAMS,
      toAcademicYear: "AY_2025_2026" as const,
      toSemester: "SECOND" as const,
    });

    expect(result.movedCount).toBe(2);
    expect(result.skippedCount).toBe(1);
    expect(result.totalCount).toBe(3);
    expect(result.conflicts).toEqual([
      { studentNumber: "20240001", courseCode: "IT101" },
    ]);

    expect(prismaMock.grade.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.grade.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "g1" } }),
    );
  });

  it("remaps subject offerings to the target term when available", async () => {
    setAuthAdmin();

    const grades = [
      makeGrade({
        id: "g1",
        studentNumber: "20240001",
        courseCode: "IT101",
        subjectOfferingId: "offering-old",
      }),
    ];

    prismaMock.grade.findMany.mockResolvedValueOnce(grades);
    prismaMock.grade.findMany.mockResolvedValueOnce([]);
    // Old offering lookup → curriculum match.
    prismaMock.subjectOffering.findMany.mockResolvedValueOnce([
      { id: "offering-old", curriculumId: "cur-1" },
    ]);
    // New-term offering lookup by curriculumId.
    prismaMock.subjectOffering.findMany.mockResolvedValueOnce([
      { id: "offering-new", curriculumId: "cur-1" },
    ]);
    // New-term offering lookup by courseCode (only queried if remap failed —
    // here it is skipped because curriculum remap succeeded, so default []).
    prismaMock.subjectOffering.findMany.mockResolvedValueOnce([]);

    const result = await reassignFacultyGrades({
      ...BASE_PARAMS,
      toAcademicYear: "AY_2025_2026" as const,
      toSemester: "SECOND" as const,
    });

    expect(result.movedCount).toBe(1);
    expect(prismaMock.grade.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: expect.objectContaining({
        subjectOfferingId: "offering-new",
      }),
    });
  });

  it("returns empty result when the faculty has no grades in the source term", async () => {
    setAuthAdmin();
    prismaMock.grade.findMany.mockResolvedValueOnce([]);

    const result = await reassignFacultyGrades({
      ...BASE_PARAMS,
      toAcademicYear: "AY_2025_2026" as const,
      toSemester: "SECOND" as const,
    });

    expect(result).toEqual({
      movedCount: 0,
      skippedCount: 0,
      totalCount: 0,
      conflicts: [],
    });
    expect(prismaMock.academicTerm.upsert).not.toHaveBeenCalled();
    expect(prismaMock.grade.update).not.toHaveBeenCalled();
  });
});
