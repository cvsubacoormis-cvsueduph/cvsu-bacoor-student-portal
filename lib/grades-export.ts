/**
 * Maps grade records onto the canonical bulk-upload spreadsheet format.
 *
 * The exported file is a round-trippable mirror of the upload template:
 * downloading a term's grades, editing them, and re-uploading produces a
 * valid import rather than an opaque report. Column headers therefore match
 * `lib/templateSample.ts` / `components/Notices/upload-grade-notice.tsx`
 * exactly, and `studentNumber` is written as text so leading zeros survive.
 */

import type { Grade } from "@prisma/client";

/** A row in the upload-template spreadsheet, in template column order. */
export interface GradeExportRow {
  studentNumber: string;
  lastName: string;
  firstName: string;
  middleInit: string;
  courseCode: string;
  courseTitle: string;
  creditUnit: number;
  grade: string;
  reExam: string;
  remarks: string;
  instructor: string;
}

/**
 * Minimal student shape needed to render a roster row.
 * Deliberately narrow so callers can push the projection into the query.
 */
export interface GradeExportStudent {
  studentNumber: string;
  firstName: string;
  lastName: string;
  middleInit?: string | null;
}

export type GradeWithStudent = Pick<
  Grade,
  | "studentNumber"
  | "courseCode"
  | "courseTitle"
  | "creditUnit"
  | "grade"
  | "reExam"
  | "remarks"
  | "instructor"
> & {
  student?: GradeExportStudent | null;
};

/**
 * Column headers in the exact order the upload parser expects.
 * Kept `as const` so the order is type-checked against the row builder.
 */
export const GRADE_EXPORT_HEADERS = [
  "studentNumber",
  "lastName",
  "firstName",
  "middleInit",
  "courseCode",
  "courseTitle",
  "creditUnit",
  "grade",
  "reExam",
  "remarks",
  "instructor",
] as const satisfies readonly (keyof GradeExportRow)[];

/**
 * Column widths (in characters) tuned to the widest realistic value,
 * matching the widths used by the upload-template generator.
 */
export const GRADE_EXPORT_COLUMN_WIDTHS = [
  { wch: 15 }, // studentNumber
  { wch: 15 }, // lastName
  { wch: 15 }, // firstName
  { wch: 15 }, // middleInit
  { wch: 12 }, // courseCode
  { wch: 30 }, // courseTitle
  { wch: 10 }, // creditUnit
  { wch: 8 }, // grade
  { wch: 15 }, // reExam
  { wch: 12 }, // remarks
  { wch: 20 }, // instructor
];

/**
 * Builds a single spreadsheet row.
 *
 * `creditUnit` stays numeric so the template's units arithmetic works on
 * re-upload; every other cell is coerced to string (empty string, not
 * `undefined`) so no cell is left blank-but-present in the sheet.
 */
export function toGradeExportRow(record: GradeWithStudent): GradeExportRow {
  return {
    // Trailing tab forces spreadsheet apps to treat the value as text,
    // preserving leading zeros in student numbers on re-open.
    studentNumber: `${record.studentNumber}\t`,
    lastName: record.student?.lastName ?? "",
    firstName: record.student?.firstName ?? "",
    middleInit: record.student?.middleInit ?? "",
    courseCode: record.courseCode,
    courseTitle: record.courseTitle,
    creditUnit: record.creditUnit,
    grade: record.grade ?? "",
    reExam: record.reExam ?? "",
    remarks: record.remarks ?? "",
    instructor: record.instructor ?? "",
  };
}

/** Maps a batch of grade records, preserving input order. */
export function toGradeExportRows(
  records: GradeWithStudent[],
): GradeExportRow[] {
  return records.map(toGradeExportRow);
}

/**
 * Spreadsheet-safe name for a term export, e.g.
 * `Grades_AY_2024_2025_FIRST_2025-01-31.xlsx`.
 * `academicYear` already looks like `AY_2024_2025`; underscores are kept so
 * the filename stays a single token per field.
 */
export function gradeExportFileName(
  academicYear: string,
  semester: string,
  now: Date = new Date(),
): string {
  const stamp = now.toISOString().slice(0, 10);
  return `Grades_${academicYear}_${semester}_${stamp}.xlsx`;
}

/** Worksheet / sheet-tab name shown inside the workbook. */
export const GRADE_EXPORT_SHEET_NAME = "Sheet 1";
