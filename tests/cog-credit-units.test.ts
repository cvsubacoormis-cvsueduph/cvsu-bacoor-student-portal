import { describe, expect, it } from "vitest";
import {
  buildGradeTableBody,
  computeTotals,
  earnsCredit,
  isFailingOutcome,
  resolveOutcome,
  type CogGrade,
} from "@/lib/cog-pdf";

/**
 * Whether a subject earned its units is decided from the *resolved* outcome —
 * the re-exam when one was taken — not from the original grade.
 *
 * The bug this pins down: COSC 200A was graded 4.00 (conditional failure) and
 * then passed with a re-exam of 3.00. Because `computeFinalRemarks` derives
 * REMARKS from the re-exam, the row printed "PASSED" while the UNITS cell
 * printed 0, and the subject was dropped from every total. The same row
 * contradicted itself.
 */

function grade(overrides: Partial<CogGrade> = {}): CogGrade {
  return {
    courseCode: "COSC 200A",
    courseTitle: "Undergraduate Thesis I",
    creditUnit: 3,
    grade: "4.00",
    reExam: null,
    remarks: "",
    instructor: "DONNALYN MONTALLANA",
    academicYear: "AY_2024_2025",
    semester: "FIRST",
    ...overrides,
  };
}

describe("resolveOutcome", () => {
  it("lets the re-exam supersede the original grade", () => {
    expect(resolveOutcome({ grade: "4.00", reExam: "3.00" })).toBe("3.00");
  });

  it("falls back to the original grade when no re-exam was taken", () => {
    expect(resolveOutcome({ grade: "5.00", reExam: null })).toBe("5.00");
  });

  it("ignores a whitespace-only re-exam", () => {
    expect(resolveOutcome({ grade: "5.00", reExam: "   " })).toBe("5.00");
  });

  it("normalises case, since the stored values are free text", () => {
    expect(resolveOutcome({ grade: "inc", reExam: "" })).toBe("INC");
  });
});

describe("earnsCredit", () => {
  it.each(["1.00", "2.50", "3.00"])("counts a passing grade (%s)", (g) => {
    expect(earnsCredit({ grade: g, reExam: null })).toBe(true);
  });

  it("counts a satisfactory CVSU 101 grade", () => {
    expect(earnsCredit({ grade: "S", reExam: null })).toBe(true);
  });

  // The reported bug.
  it("counts a conditional failure that was passed on re-exam", () => {
    expect(earnsCredit({ grade: "4.00", reExam: "3.00" })).toBe(true);
  });

  it("counts a failure that was passed on re-exam", () => {
    expect(earnsCredit({ grade: "5.00", reExam: "2.75" })).toBe(true);
  });

  it.each(["4.00", "5.00", "DRP", "US", "FAILED"])(
    "still earns nothing for an unresolved %s",
    (g) => {
      expect(earnsCredit({ grade: g, reExam: null })).toBe(false);
    },
  );

  it("earns nothing when the re-exam also failed", () => {
    expect(earnsCredit({ grade: "4.00", reExam: "5.00" })).toBe(false);
  });

  it("earns nothing for an incomplete with no re-exam", () => {
    expect(earnsCredit({ grade: "INC", reExam: null })).toBe(false);
  });

  it("counts an incomplete resolved by a passing re-exam", () => {
    expect(earnsCredit({ grade: "INC", reExam: "2.00" })).toBe(true);
  });
});

describe("isFailingOutcome", () => {
  it("marks an unresolved conditional failure as failing", () => {
    expect(isFailingOutcome({ grade: "4.00", reExam: null })).toBe(true);
  });

  it("does not mark a re-exam-passed subject as failing, so it is not red", () => {
    expect(isFailingOutcome({ grade: "4.00", reExam: "3.00" })).toBe(false);
  });
});

describe("buildGradeTableBody — the UNITS cell", () => {
  it("prints the credit units for a re-exam-passed subject, not 0", () => {
    const body = buildGradeTableBody([
      grade({ grade: "4.00", reExam: "3.00", remarks: "PASSED" }),
    ]);

    // Columns: CODE, UNITS, TITLE, GRADE, RE-EXAM, REMARKS, FACULTY
    expect(body[0][1]).toBe("3");
    // The original grade and the re-exam both stay visible.
    expect((body[0][3] as { content: string }).content).toBe("4.00");
    expect(body[0][4]).toBe("3.00");
  });

  it("prints 0 for a subject that genuinely earned no credit", () => {
    const body = buildGradeTableBody([grade({ grade: "5.00", remarks: "FAILED" })]);
    expect(body[0][1]).toBe("0");
  });

  it("still prints 0 for an unresolved conditional failure", () => {
    const body = buildGradeTableBody([grade({ grade: "4.00", remarks: "CON. FAILURE" })]);
    expect(body[0][1]).toBe("0");
  });

  it("keeps a passed subject's grade black and a failed one red", () => {
    const [passed] = buildGradeTableBody([
      grade({ grade: "4.00", reExam: "3.00", remarks: "PASSED" }),
    ]);
    const [failed] = buildGradeTableBody([grade({ grade: "5.00", remarks: "FAILED" })]);

    expect((passed[3] as { styles: { textColor: number[] } }).styles.textColor).toEqual([
      0, 0, 0,
    ]);
    expect((failed[3] as { styles: { textColor: number[] } }).styles.textColor).toEqual([
      255, 0, 0,
    ]);
  });
});

describe("computeTotals", () => {
  it("counts a re-exam-passed subject in units and in the GPA", () => {
    const totals = computeTotals([
      grade({ grade: "4.00", reExam: "3.00", creditUnit: 3, remarks: "PASSED" }),
    ]);

    expect(totals.totalSubjectsEnrolled).toBe(1);
    expect(totals.totalUnitsEnrolled).toBe(3);
    // min(4.00, 3.00) = 3.00 -> 3 units x 3.00 = 9 grade points
    expect(totals.totalGPAUnits).toBe(3);
    expect(totals.totalCreditsEarned).toBe(9);
    expect(totals.gpa).toBe("3.00");
  });

  it("excludes a subject that was never passed", () => {
    const totals = computeTotals([grade({ grade: "5.00", creditUnit: 3 })]);

    expect(totals.totalUnitsEnrolled).toBe(0);
    expect(totals.totalGPAUnits).toBe(0);
    expect(totals.totalCreditsEarned).toBe(0);
    expect(totals.gpa).toBe("0.00");
  });

  it("sums a mixed term, counting only resolved outcomes", () => {
    const totals = computeTotals([
      grade({ courseCode: "A", grade: "1.00", creditUnit: 3 }),
      grade({ courseCode: "B", grade: "4.00", reExam: "2.00", creditUnit: 3 }),
      grade({ courseCode: "C", grade: "5.00", creditUnit: 3 }),
    ]);

    expect(totals.totalSubjectsEnrolled).toBe(3);
    // A (3) + B (3); C earns nothing.
    expect(totals.totalUnitsEnrolled).toBe(6);
    expect(totals.totalGPAUnits).toBe(6);
    // A: 3 x 1.00 = 3, B: 3 x 2.00 = 6
    expect(totals.totalCreditsEarned).toBe(9);
    expect(totals.gpa).toBe("1.50");
  });

  it("counts CVSU 101 'S' in the GPA denominator but scores it no points", () => {
    const totals = computeTotals([
      grade({ courseCode: "CVSU 101", grade: "S", creditUnit: 2 }),
    ]);

    expect(totals.totalUnitsEnrolled).toBe(2);
    expect(totals.totalGPAUnits).toBe(2);
    expect(totals.totalCreditsEarned).toBe(0);
    expect(totals.gpa).toBe("0.00");
  });

  it("reports zeros for an empty term", () => {
    const totals = computeTotals([]);

    expect(totals).toEqual({
      gpa: "0.00",
      totalSubjectsEnrolled: 0,
      totalUnitsEnrolled: 0,
      totalGPAUnits: 0,
      totalCreditsEarned: 0,
    });
  });
});
