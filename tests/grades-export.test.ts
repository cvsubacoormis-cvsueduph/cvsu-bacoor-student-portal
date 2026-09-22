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
      (prisma.grade.findMany as any).mockResolvedValue([]);
      const res = await GET(createMockRequest("GET", EXPORT_URL));
      expect(res.status).toBe(404);
    });
  });

  describe("response shape", () => {
    beforeEach(() => {
      setAuthRegistrar();
      (prisma.grade.aggregate as any).mockResolvedValue({ _count: { _all: 1 } });
      (prisma.grade.findMany as any).mockResolvedValue([sampleGrade]);
    });

    it("queries only the requested term", async () => {
      await GET(createMockRequest("GET", EXPORT_URL));

      expect(prisma.grade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { academicYear: "AY_2024_2025", semester: "FIRST" },
        }),
      );
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
