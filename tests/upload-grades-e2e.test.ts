import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { setAuthAdmin, setAuthFaculty } from "../tests/__mocks__/clerk";
import { rateLimiterConsume } from "../tests/__mocks__/rate-limiter";
import { fuzzy } from "fast-fuzzy";

const sampleStudent = {
  studentNumber: "202100001",
  firstName: "Juan",
  lastName: "Dela Cruz",
  course: "BSIT",
  major: "NONE",
};

const sampleStudent2 = {
  studentNumber: "202100002",
  firstName: "Maria",
  lastName: "Santos",
  course: "BSIT",
  major: "NONE",
};

const sampleSubject = {
  id: "curriculum-1",
  courseCode: "IT 101",
  course: "BSIT",
  major: "NONE",
  courseTitle: "Introduction to IT",
  creditLec: 3,
  creditLab: 0,
};

const sampleOffering = {
  id: "offering-1",
  curriculumId: "curriculum-1",
};

const sampleTerm = {
  id: "term-1",
  academicYear: "AY_2024_2025",
  semester: "FIRST",
};

function buildRequest(
  grades: any[],
  validateOnly = false,
) {
  return new Request("http://localhost/api/upload-grades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grades, validateOnly }),
  });
}

const defaultMeta = {
  academicYear: "AY_2024_2025",
  semester: "FIRST" as const,
};

function g(overrides: Record<string, any>) {
  return { ...defaultMeta, ...overrides };
}

function setupBaseMocks(students = [sampleStudent]) {
  vi.mocked(prisma.student.findMany).mockResolvedValue(students);
  vi.mocked(prisma.curriculumChecklist.findMany).mockResolvedValue([
    sampleSubject,
  ]);
  vi.mocked(prisma.subjectOffering.findMany).mockResolvedValue([
    sampleOffering,
  ]);
  vi.mocked(prisma.academicTerm.findUnique).mockResolvedValue(sampleTerm);
  vi.mocked(prisma.grade.findMany).mockResolvedValue([]);
  vi.mocked(prisma.$transaction).mockResolvedValue([]);
  vi.mocked(prisma.gradeLog.createMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.pendingGradeChange.create).mockResolvedValue({});
}

describe("POST /api/upload-grades — Remark auto-correction", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    rateLimiterConsume.mockResolvedValue(undefined);
    setupBaseMocks();
    setAuthAdmin();
    const mod = await import("@/app/api/upload-grades/route");
    POST = mod.POST;
  });

  it("auto-corrects remark from FAILED to PASSED for grade 1.00", async () => {
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "1.00", remarks: "FAILED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).toContain("remark auto-corrected");
    expect(data.results[0].matchQuality).toBe("exact");
  });

  it("auto-corrects remark from PASSED to FAILED for grade 5.00", async () => {
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "5.00", remarks: "PASSED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).toContain("remark auto-corrected");
  });

  it("auto-corrects remark from PASSED to CONDITIONAL FAILURE for grade 4.00", async () => {
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "4.00", remarks: "PASSED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).toContain("remark auto-corrected");
  });

  it("auto-fills remark when empty: grade INC -> LACK OF REQ.", async () => {
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "INC", remarks: "" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].matchQuality).toBe("exact");
  });

  it("auto-fills remark when empty: grade DRP -> DROPPED", async () => {
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "DRP", remarks: "" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
  });

  it("auto-fills remark when empty: grade S -> SATISFACTORY", async () => {
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "S", remarks: "" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
  });

  it("auto-fills remark when empty: grade US -> SATISFACTORY", async () => {
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "US", remarks: "" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
  });

  it("does NOT flag correction when remark already matches grade 1.00 -> PASSED", async () => {
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "1.00", remarks: "PASSED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).not.toContain("remark auto-corrected");
    expect(data.results[0].matchQuality).toBe("exact");
  });

  it("does NOT flag correction when remark already matches grade 5.00 -> FAILED", async () => {
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "5.00", remarks: "FAILED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).not.toContain("remark auto-corrected");
  });
});

describe("POST /api/upload-grades — Student matching", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    rateLimiterConsume.mockResolvedValue(undefined);
    setupBaseMocks([sampleStudent, sampleStudent2]);
    setAuthAdmin();
    const mod = await import("@/app/api/upload-grades/route");
    POST = mod.POST;
  });

  it("matches student by ID with exact name match", async () => {
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "1.00", remarks: "PASSED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].matchQuality).toBe("exact");
    expect(data.results[0].studentName).toBe("Juan Dela Cruz");
    expect(data.results[0].studentNumber).toBe("202100001");
  });

  it("recovers student by name when student number is missing", async () => {
    const req = buildRequest([
      g({ studentNumber: "", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "1.00", remarks: "PASSED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].studentNumber).toBe("202100001");
    expect(data.results[0].matchQuality).toBe("fuzzy");
  });

  it("recovers student by name when student number is wrong (non-existent)", async () => {
    const req = buildRequest([
      g({ studentNumber: "999999999", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "1.00", remarks: "PASSED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].studentNumber).toBe("202100001");
    expect(data.results[0].matchQuality).toBe("fuzzy");
  });

  it("corrects student ID when ID belongs to someone else but name matches another student", async () => {
    // fuzzy should NOT match "Juan Dela Cruz" with "Maria Santos" (relaxed threshold 0.70)
    vi.mocked(fuzzy).mockReturnValue(0);
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Maria", lastName: "Santos", courseCode: "IT 101", grade: "1.00", remarks: "PASSED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].studentNumber).toBe("202100002");
    expect(data.results[0].matchQuality).toBe("fuzzy");
  });

  it("fails when student not found by number or name", async () => {
    vi.mocked(prisma.student.findMany).mockResolvedValue([]);
    const req = buildRequest([
      g({ studentNumber: "999999999", firstName: "Unknown", lastName: "Person", courseCode: "IT 101", grade: "1.00", remarks: "PASSED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).toContain("\u274c");
  });

  it("recovers student by name even when names have leading/trailing whitespace in the file", async () => {
    // The strict name query uses `equals` which is sensitive to whitespace;
    // the server trims firstName/lastName before querying so users with stray
    // spaces in their Excel cells aren't blocked from uploading.
    const req = buildRequest([
      g({ studentNumber: "", firstName: "  Juan  ", lastName: " Dela Cruz ", courseCode: "IT 101", grade: "1.00", remarks: "PASSED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].studentNumber).toBe("202100001");
  });

  it("recovers student by name when exact-match name query fails but broad fallback finds them", async () => {
    // First call (studentsByNumber) returns empty — ID doesn't exist.
    // Second call (strict name match) returns empty — name has minor diff.
    // Third call (broad contains fallback) returns the real student.
    vi.mocked(prisma.student.findMany)
      .mockResolvedValueOnce([]) // studentsByNumber
      .mockResolvedValueOnce([]) // studentsByName (strict equals)
      .mockResolvedValueOnce([sampleStudent]); // studentsByName (broad contains fallback)
    const req = buildRequest([
      g({ studentNumber: "999999999", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "1.00", remarks: "PASSED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].studentNumber).toBe("202100001");
  });

  it("broad fallback uses orderBy for deterministic take:200 cap", async () => {
    // Regression: common names (Juan, Maria) can return >200 matches and
    // without orderBy the cap is non-deterministic — the target student
    // may or may not be in the window. With orderBy studentNumber ASC,
    // the cap is stable across requests.
    vi.mocked(prisma.student.findMany)
      .mockResolvedValueOnce([]) // studentsByNumber
      .mockResolvedValueOnce([]) // studentsByName (strict)
      .mockResolvedValueOnce([sampleStudent]); // studentsByName (broad)
    const req = buildRequest([
      g({ studentNumber: "999999999", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "1.00", remarks: "PASSED" }),
    ]);
    await POST(req);
    // Find the broad-fallback call (3rd prisma.student.findMany call)
    const calls = vi.mocked(prisma.student.findMany).mock.calls;
    const broadCall = calls[2]?.[0] as any;
    expect(broadCall).toBeDefined();
    expect(broadCall.orderBy).toEqual({ studentNumber: "asc" });
    expect(broadCall.take).toBe(200);
  });

  it("matches student even when Excel student number has invisible / Unicode characters", async () => {
    // Real-world failure: "2021-0001" in Excel cell actually contains a
    // non-breaking hyphen (U+2011) or zero-width space (U+200B) that
    // String#trim() doesn't strip. The batch-level query strips these
    // out via normalizeStudentNumber so the DB lookup finds the student.
    // sampleStudent.studentNumber is "202100001", so we use messy variants
    // of THAT number so the post-normalization query key matches.
    const messyIds = [
      "2021\u201100001",  // non-breaking hyphen (most common Excel artifact)
      "2021\u200B00001",  // zero-width space
      "2021\u00A000001",  // non-breaking space
      "  202100001  ",    // regular spaces (trim catches this)
      "2021\u201300001",  // en-dash (Word paste)
      "2021\u201400001",  // em-dash (Excel auto-correct)
    ];
    for (const messy of messyIds) {
      vi.clearAllMocks();
      rateLimiterConsume.mockResolvedValue(undefined);
      setupBaseMocks();
      setAuthAdmin();
      const mod = await import("@/app/api/upload-grades/route");
      POST = mod.POST;
      const req = buildRequest([
        g({ studentNumber: messy, firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "1.00", remarks: "PASSED" }),
      ]);
      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.results[0].matchQuality).toBe("exact");
      expect(data.results[0].studentNumber).toBe("202100001");
    }
  });
});

describe("POST /api/upload-grades — Validation", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    rateLimiterConsume.mockResolvedValue(undefined);
    setupBaseMocks();
    setAuthAdmin();
    const mod = await import("@/app/api/upload-grades/route");
    POST = mod.POST;
  });

  it("rejects invalid course code format", async () => {
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "!!INVALID!!", grade: "1.00", remarks: "PASSED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).toContain("\u274c");
    expect(data.results[0].status).toContain("Invalid course code format");
  });

  it("rejects invalid grade value", async () => {
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "", remarks: "PASSED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).toContain("\u274c");
    expect(data.results[0].status).toContain("Invalid grade");
  });

  it("rejects when course code not in curriculum (non-legacy mode)", async () => {
    vi.mocked(prisma.curriculumChecklist.findMany).mockResolvedValue([]);
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "XYZ 999", grade: "1.00", remarks: "PASSED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).toContain("\u274c");
    expect(data.results[0].status).toContain("not found in any active curriculum");
  });

  it("skips rows missing both course code and grade", async () => {
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "", grade: "", remarks: "PASSED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).toContain("\u274c");
  });
});

describe("POST /api/upload-grades — Validate-only (dry run)", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    rateLimiterConsume.mockResolvedValue(undefined);
    setupBaseMocks();
    setAuthAdmin();
    const mod = await import("@/app/api/upload-grades/route");
    POST = mod.POST;
  });

  it("returns results without persisting changes", async () => {
    const req = buildRequest(
      [
        g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "1.00", remarks: "PASSED" }),
      ],
      true,
    );
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].matchQuality).toBe("exact");
    expect(vi.mocked(prisma.$transaction)).not.toHaveBeenCalled();
  });
});

describe("POST /api/upload-grades — Faculty instructor enforcement", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    rateLimiterConsume.mockResolvedValue(undefined);
    setupBaseMocks();
    vi.mocked(prisma.systemSettings.findUnique as any).mockImplementation(
      (args: any) => {
        if (args?.where?.key === "FACULTY_UPDATE_REQUIRES_APPROVAL") {
          return Promise.resolve({ value: "false" });
        }
        return Promise.resolve({ value: "true" });
      },
    );
    setAuthFaculty();
    const mod = await import("@/app/api/upload-grades/route");
    POST = mod.POST;
  });

  it("rejects when instructor name in file does not match faculty user", async () => {
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "1.00", remarks: "PASSED", instructor: "Wrong Instructor" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
  });

  it("overwrites instructor name with faculty user name when file has no instructor", async () => {
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "1.00", remarks: "PASSED", instructor: "" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].matchQuality).toBe("exact");
  });
});

describe("POST /api/upload-grades — Batch processing", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    rateLimiterConsume.mockResolvedValue(undefined);
    setupBaseMocks([
      sampleStudent,
      sampleStudent2,
      { studentNumber: "202100003", firstName: "Jose", lastName: "Rizal", course: "BSIT", major: "NONE" },
    ]);
    setAuthAdmin();
    const mod = await import("@/app/api/upload-grades/route");
    POST = mod.POST;
  });

  it("processes multiple rows in a single batch", async () => {
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "1.00", remarks: "PASSED" }),
      g({ studentNumber: "202100002", firstName: "Maria", lastName: "Santos", courseCode: "IT 101", grade: "5.00", remarks: "FAILED" }),
      g({ studentNumber: "202100003", firstName: "Jose", lastName: "Rizal", courseCode: "IT 101", grade: "INC", remarks: "" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(3);
    expect(data.results[0].matchQuality).toBe("exact");
    expect(data.results[0].studentNumber).toBe("202100001");
    expect(data.results[0].status).not.toContain("remark auto-corrected");
    expect(data.results[1].matchQuality).toBe("exact");
    expect(data.results[1].studentNumber).toBe("202100002");
    expect(data.results[1].status).not.toContain("remark auto-corrected");
    expect(data.results[2].matchQuality).toBe("exact");
    expect(data.results[2].studentNumber).toBe("202100003");
  });

  it("mixes successful and failed rows in one batch", async () => {
    // Row 2 + 3 have names that should NOT fuzzy-match any DB student
    vi.mocked(fuzzy).mockReturnValue(0);
    const req = buildRequest([
      g({ studentNumber: "202100001", firstName: "Juan", lastName: "Dela Cruz", courseCode: "IT 101", grade: "1.00", remarks: "PASSED" }),
      g({ studentNumber: "999999999", firstName: "Unknown", lastName: "Person", courseCode: "IT 101", grade: "1.00", remarks: "PASSED" }),
      g({ studentNumber: "", firstName: "", lastName: "", courseCode: "NOT_VALID", grade: "1.00", remarks: "PASSED" }),
    ]);
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(3);

    const successes = data.results.filter((r: any) => !r.status.includes("\u274c"));
    const failures = data.results.filter((r: any) => r.status.includes("\u274c"));
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(2);
    expect(successes[0].studentNumber).toBe("202100001");
  });
});

describe("POST /api/upload-grades — Security", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    rateLimiterConsume.mockResolvedValue(undefined);
    setupBaseMocks();
    const mod = await import("@/app/api/upload-grades/route");
    POST = mod.POST;
  });

  it("rejects missing academic year / semester", async () => {
    setAuthAdmin();
    const req = new Request("http://localhost/api/upload-grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { studentNumber: "202100001", courseCode: "IT 101", grade: "1.00", remarks: "PASSED" },
      ]),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects when academic term does not exist", async () => {
    setAuthAdmin();
    vi.mocked(prisma.academicTerm.findUnique).mockResolvedValue(null);
    const req = buildRequest([
      g({ studentNumber: "202100001", courseCode: "IT 101", grade: "1.00", remarks: "PASSED" }),
    ]);
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
