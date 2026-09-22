import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import {
  setAuthAdmin,
  setAuthRegistrar,
  setAuthRegistrarStaff,
  setAuthSuperuser,
  setAuthFaculty,
  setAuthStudent,
  setAuthUnauthenticated,
} from "./__mocks__/clerk";
import { createMockRequest } from "./helpers";
import {
  GRADE_EXPORT_HEADERS,
  toGradeExportRow,
  gradeExportFileName,
} from "@/lib/grades-export";

const EXPORT_URL =
  "http://localhost/api/grades/export?academicYear=AY_2024_2025&semester=FIRST";

const sampleGrade = {
  studentNumber: "20210010",
  courseCode: "CS101",
  courseTitle: "Intro to Computing",
  creditUnit: 3,
  grade: "1.75",
  reExam: null,
  remarks: "PASSED",
  instructor: "DR. SMITH",
  student: {
    studentNumber: "20210010",
    firstName: "John",
    lastName: "Doe",
    middleInit: "A",
  },
};

/**
 * Shape returned by the route's raw keyset query: flat columns, because the
 * SQL joins Grade and Student into one row rather than nesting a relation.
 */
const sampleRawRow = {
  studentNumber: "20210010",
  courseCode: "CS101",
  courseTitle: "Intro to Computing",
  creditUnit: 3,
  grade: "1.75",
  reExam: null,
  remarks: "PASSED",
  instructor: "DR. SMITH",
  firstName: "John",
  lastName: "Doe",
  middleInit: "A",
};

describe("GET /api/grades/export", () => {
  let GET: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    setAuthUnauthenticated();
    const mod = await import("@/app/api/grades/export/route");
    GET = mod.GET as (req: Request) => Promise<Response>;
  });

  describe("authorization", () => {
    it("returns 401 when unauthenticated", async () => {
      setAuthUnauthenticated();
      const res = await GET(createMockRequest("GET", EXPORT_URL));
      expect(res.status).toBe(401);
    });

    it("returns 403 for a student", async () => {
      setAuthStudent();
      const res = await GET(createMockRequest("GET", EXPORT_URL));
      expect(res.status).toBe(403);
    });

    it("returns 403 for faculty", async () => {
      setAuthFaculty();
      const res = await GET(createMockRequest("GET", EXPORT_URL));
      expect(res.status).toBe(403);
    });

    // Per product decision the download is strictly admin + registrar.
    it("returns 403 for superuser", async () => {
      setAuthSuperuser();
      const res = await GET(createMockRequest("GET", EXPORT_URL));
      expect(res.status).toBe(403);
    });

    it("returns 403 for registrar_staff", async () => {
      setAuthRegistrarStaff();
      const res = await GET(createMockRequest("GET", EXPORT_URL));
      expect(res.status).toBe(403);
    });

    it("allows admin", async () => {
      setAuthAdmin();
      (prisma.grade.aggregate as any).mockResolvedValue({ _count: { _all: 1 } });
      (prisma.grade.findMany as any).mockResolvedValue([sampleGrade]);
      const res = await GET(createMockRequest("GET", EXPORT_URL));
      expect(res.status).toBe(200);
    });

    it("allows registrar", async () => {
      setAuthRegistrar();
      (prisma.grade.aggregate as any).mockResolvedValue({ _count: { _all: 1 } });
      (prisma.grade.findMany as any).mockResolvedValue([sampleGrade]);
      const res = await GET(createMockRequest("GET", EXPORT_URL));
      expect(res.status).toBe(200);
    });
  });

  describe("input validation", () => {
    beforeEach(() => setAuthRegistrar());

    it("rejects an unknown academic year", async () => {
      const res = await GET(
        createMockRequest(
          "GET",
          "http://localhost/api/grades/export?academicYear=AY_1900_1901&semester=FIRST",
        ),
      );
      expect(res.status).toBe(400);
    });

    it("rejects an unknown semester", async () => {
      const res = await GET(
        createMockRequest(
          "GET",
          "http://localhost/api/grades/export?academicYear=AY_2024_2025&semester=SUMMER",
        ),
      );
      expect(res.status).toBe(400);
    });

    it("rejects a missing term", async () => {
      const res = await GET(
        createMockRequest("GET", "http://localhost/api/grades/export"),
      );
      expect(res.status).toBe(400);
    });

    it("404s when the term has no grades", async () => {
      (prisma.grade.aggregate as any).mockResolvedValue({ _count: { _all: 0 } });
      const res = await GET(createMockRequest("GET", EXPORT_URL));
      expect(res.status).toBe(404);
    });
  });

  describe("response shape", () => {
    beforeEach(() => {
      setAuthRegistrar();
      (prisma.grade.aggregate as any).mockResolvedValue({ _count: { _all: 1 } });
      (prisma.$queryRaw as any).mockResolvedValue([sampleRawRow]);
    });

    it("queries only the requested term", async () => {
      await GET(createMockRequest("GET", EXPORT_URL));

      // The term is passed as a bound parameter to the raw query.
      const params = (prisma.$queryRaw as any).mock.calls[0].slice(1);
      expect(params).toContain("AY_2024_2025");
      expect(params).toContain("FIRST");
    });

    it("returns an xlsx attachment with the template filename", async () => {
      const res = await GET(createMockRequest("GET", EXPORT_URL));

      expect(res.headers.get("Content-Type")).toContain(
        "spreadsheetml.sheet",
      );
      expect(res.headers.get("Content-Disposition")).toContain(
        gradeExportFileName("AY_2024_2025", "FIRST"),
      );
      // Per-user export data must not be cached by browsers or a CDN.
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("writes the upload-template headers in order and marks text student numbers", async () => {
      await GET(createMockRequest("GET", EXPORT_URL));

      const jsonToSheet = XLSX.utils.json_to_sheet as unknown as ReturnType<
        typeof vi.fn
      >;
      expect(jsonToSheet).toHaveBeenCalled();

      const [rows, opts] = jsonToSheet.mock.calls.at(-1) as [any[], any];
      expect(opts.header).toEqual([...GRADE_EXPORT_HEADERS]);
      expect(Object.keys(rows[0])).toEqual([...GRADE_EXPORT_HEADERS]);
      // Leading-zero-safe: the template writes student numbers as text.
      expect(rows[0].studentNumber).toBe("20210010\t");
      expect(rows[0].creditUnit).toBe(3);
    });
  });
});

describe("toGradeExportRow", () => {
  it("keeps creditUnit numeric and coerces missing optional cells to empty strings", () => {
    const row = toGradeExportRow({
      studentNumber: "00123",
      courseCode: "CS101",
      courseTitle: "Intro",
      creditUnit: 3,
      grade: "1.50",
      reExam: null,
      remarks: null,
      instructor: "",
    });

    expect(row.studentNumber).toBe("00123\t");
    expect(row.creditUnit).toBe(3);
    expect(row.reExam).toBe("");
    expect(row.remarks).toBe("");
    expect(row.lastName).toBe("");
    expect(row.firstName).toBe("");
  });

  it("populates name fields from the included student relation", () => {
    const row = toGradeExportRow(sampleGrade);
    expect(row.lastName).toBe("Doe");
    expect(row.firstName).toBe("John");
    expect(row.middleInit).toBe("A");
  });
});

/**
 * The export used to stop at 5,000 rows because I mistakenly copied the upload
 * parser's *per-batch* limit, which is not a property of a term. A term can hold
 * far more grades, so the route now pages through all of them and compresses the
 * workbook. These tests pin both behaviours down.
 */
describe("GET /api/grades/export — pagination and compression", () => {
  let GET: (req: Request) => Promise<Response>;

  const PAGE = 5000;

  /**
   * Rows must have UNIQUE (studentNumber, courseCode) pairs — that is the real
   * @@unique constraint the keyset seek relies on. Deriving both columns from
   * `i` with modular arithmetic would alias different rows onto the same key
   * and make the cursor ambiguous.
   */
  function fakeRow(i: number) {
    const studentIndex = Math.floor(i / 50); // 50 subjects per student
    const subjectIndex = i % 50;
    const studentNumber = `2021${String(studentIndex).padStart(5, "0")}`;
    return {
      studentNumber,
      courseCode: `CS${100 + subjectIndex}`,
      courseTitle: "Intro to Computing",
      creditUnit: 3,
      grade: "1.75",
      reExam: null,
      remarks: "PASSED",
      instructor: "DR. SMITH",
      firstName: "John",
      lastName: "Doe",
      middleInit: "A",
    };
  }

  /**
   * Emulates the raw keyset query.
   *
   * `$queryRaw` is called as a tagged template, so the mock receives
   * (sqlFragmentsArray, ...params) — NOT a query object. The cursor values and
   * page size arrive as bound parameters, in the order they appear in the SQL.
   *
   * The mock deliberately keys off the parameter count to distinguish the first
   * page (2 params: year, semester) from a seeking page (4 params: year,
   * semester, cursor studentNumber, cursor courseCode). If the seek is ever
   * lost, the mock returns the same page forever and the loop spins — which
   * vitest surfaces as a worker crash rather than a silent pass.
   */
  function queryRawMock(total: number, onRows?: (n: number) => void) {
    return async (strings: TemplateStringsArray, ...params: unknown[]) => {
      const all = Array.from({ length: total }, (_, i) => fakeRow(i)).sort(
        (a, b) =>
          a.studentNumber.localeCompare(b.studentNumber) ||
          a.courseCode.localeCompare(b.courseCode),
      );

      // First page passes [academicYear, semester, take].
      // Seeking page passes [academicYear, semester, sn, cc, take].
      let start = 0;
      let take: number;
      if (params.length >= 5) {
        const [sn, cc] = params.slice(2, 4) as [string, string];
        take = params[params.length - 1] as number;
        const idx = all.findIndex(
          (r) => r.studentNumber === sn && r.courseCode === cc,
        );
        if (idx === -1) throw new Error("cursor row not found");
        start = idx + 1; // strictly after the cursor
      } else {
        take = params[params.length - 1] as number;
      }

      const page = all.slice(start, start + take);
      onRows?.(page.length);
      return page;
    };
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    setAuthRegistrar();
    const mod = await import("@/app/api/grades/export/route");
    GET = mod.GET as (req: Request) => Promise<Response>;
  });

  it("exports a term larger than one page without truncating", async () => {
    const total = 12_345;
    (prisma.grade.aggregate as any).mockResolvedValue({ _count: { _all: total } });
    (prisma.$queryRaw as any).mockImplementation(queryRawMock(total));

    const res = await GET(createMockRequest("GET", EXPORT_URL));

    expect(res.status).toBe(200);
    // Every row for the term, not just the first page.
    expect(res.headers.get("X-Export-Row-Count")).toBe(String(total));
    // The old truncation signal is gone because nothing is truncated.
    expect(res.headers.get("X-Export-Truncated")).toBeNull();
  });

  it("seeks with a row comparison rather than Prisma cursors or OFFSET", async () => {
    const total = 12_345;
    (prisma.grade.aggregate as any).mockResolvedValue({ _count: { _all: total } });
    (prisma.$queryRaw as any).mockImplementation(queryRawMock(total));

    await GET(createMockRequest("GET", EXPORT_URL));

    // The Prisma query builder is no longer used for paging at all: it cannot
    // emit a row comparison, so the seek must not go through findMany.
    expect(prisma.grade.findMany).not.toHaveBeenCalled();

    const calls = (prisma.$queryRaw as any).mock.calls;
    expect(calls.length).toBeGreaterThan(1);

    const sqlOf = (call: any[]) => (call[0] as string[]).join("?");

    // First page: term filter only, no cursor predicate.
    expect(sqlOf(calls[0])).not.toMatch(/\)\s*>\s*\(/);
    expect(sqlOf(calls[0])).toMatch(/ORDER BY/i);
    expect(sqlOf(calls[0])).toMatch(/LIMIT/i);

    // Seeking pages use a genuine row comparison, which PostgreSQL can serve
    // from the composite index. This is the whole point of using raw SQL.
    const seeking = calls.filter((c) => c.length >= 5);
    expect(seeking.length).toBeGreaterThan(0);
    for (const c of seeking) {
      expect(sqlOf(c)).toMatch(
        /\(\s*\w+\."studentNumber"\s*,\s*\w+\."courseCode"\s*\)\s*>\s*\(/,
      );
    }
  });

  it("fetches each row exactly once (no duplicates, no drops)", async () => {
    const total = 12_000;
    (prisma.grade.aggregate as any).mockResolvedValue({ _count: { _all: total } });

    let fetched = 0;
    (prisma.$queryRaw as any).mockImplementation(
      queryRawMock(total, (n) => {
        fetched += n;
      }),
    );

    const res = await GET(createMockRequest("GET", EXPORT_URL));

    // 5000 + 5000 + 2000 rows, then one empty page to confirm exhaustion.
    expect(fetched).toBe(total);
    expect(Number(res.headers.get("X-Export-Row-Count"))).toBe(total);
  });

  it("binds the term and cursor as parameters, never interpolated", async () => {
    (prisma.grade.aggregate as any).mockResolvedValue({ _count: { _all: 1 } });
    (prisma.$queryRaw as any).mockResolvedValue([fakeRow(0)]);

    await GET(createMockRequest("GET", EXPORT_URL));

    const params = (prisma.$queryRaw as any).mock.calls[0].slice(1);
    // academicYear, semester, take — passed as bound values, so the SQL text
    // contains no literal term values.
    expect(params).toContain("AY_2024_2025");
    expect(params).toContain("FIRST");

    const sql = ((prisma.$queryRaw as any).mock.calls[0][0] as string[]).join("?");
    expect(sql).not.toContain("AY_2024_2025");
    expect(sql).not.toContain("FIRST");
  });

  it("enables DEFLATE and a shared string table so the workbook stays small", async () => {
    (prisma.grade.aggregate as any).mockResolvedValue({ _count: { _all: 1 } });
    (prisma.$queryRaw as any).mockResolvedValue([fakeRow(0)]);

    await GET(createMockRequest("GET", EXPORT_URL));

    const write = XLSX.write as unknown as ReturnType<typeof vi.fn>;
    expect(write).toHaveBeenCalled();
    // Called as XLSX.write(workbook, opts) — the options object is index 1.
    const opts = write.mock.calls.at(-1)![1];
    // SheetJS defaults compression OFF; omitting it is what made the file huge.
    expect(opts.compression).toBe(true);
    // Repeated course titles / instructors are stored once, not per row.
    expect(opts.bookSST).toBe(true);
  });

  it("breaks out of paging on an empty page rather than relying on the count", async () => {
    // totalForTerm says 10,000 (two pages), but the term shrinks between the
    // count and the reads. Returning an empty FIRST page distinguishes the
    // explicit `break` from the loop-bound alone: without the break the loop
    // would still issue a second query.
    (prisma.grade.aggregate as any).mockResolvedValue({ _count: { _all: 10_000 } });
    (prisma.$queryRaw as any).mockResolvedValue([]);

    const res = await GET(createMockRequest("GET", EXPORT_URL));

    expect(res.status).toBe(200);
    expect((prisma.$queryRaw as any).mock.calls).toHaveLength(1);
    expect(res.headers.get("X-Export-Row-Count")).toBe("0");
  });

  it("terminates when a later page comes back empty", async () => {
    // Same guard, exercised mid-loop: page 1 is full, page 2 is empty.
    (prisma.grade.aggregate as any).mockResolvedValue({ _count: { _all: 20_000 } });
    let call = 0;
    (prisma.$queryRaw as any).mockImplementation(async () => {
      call++;
      return call === 1 ? Array.from({ length: PAGE }, (_, i) => fakeRow(i)) : [];
    });

    const res = await GET(createMockRequest("GET", EXPORT_URL));

    expect(res.status).toBe(200);
    expect((prisma.$queryRaw as any).mock.calls).toHaveLength(2);
    expect(res.headers.get("X-Export-Row-Count")).toBe(String(PAGE));
  });

  it("404s (not a truncated 200) when the term is empty", async () => {
    (prisma.grade.aggregate as any).mockResolvedValue({ _count: { _all: 0 } });

    const res = await GET(createMockRequest("GET", EXPORT_URL));

    expect(res.status).toBe(404);
    // The count short-circuits before any page is read.
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
