// Shared grade utilities — types, constants, and helpers used across grade components

export type GradeRecord = {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  courseCode: string;
  creditUnit: number;
  courseTitle: string;
  grade: string;
  reExam?: string;
  remarks?: string;
  instructor: string;
  academicYear: string;
  semester: string;
  uploadedBy?: string;
};

export type SubjectOption = {
  id: string;
  courseCode: string;
  courseTitle: string;
  creditUnit: number;
};

export type AcademicTerm = {
  id: string;
  academicYear: string;
  semester: string;
};

export const GRADE_OPTIONS = [
  "1.00", "1.25", "1.50", "1.75",
  "2.00", "2.25", "2.50", "2.75",
  "3.00", "4.00", "5.00",
  "INC", "S", "US", "DRP",
];

export function computeRemarks(gradeValue: string): string {
  const g = parseFloat(gradeValue);
  if (isNaN(g)) {
    const upper = gradeValue.trim().toUpperCase();
    if (upper === "S") return "PASSED";
    if (upper === "US") return "UNSATISFACTORY";
    if (upper === "DRP") return "DROPPED";
    if (upper === "INC") return "LACK OF REQ.";
    return "";
  }
  if (g >= 1.0 && g <= 3.0) return "PASSED";
  if (g === 4.0) return "CONDITIONAL FAILURE";
  if (g === 5.0) return "FAILED";
  return "";
}

export function computeFinalRemarks(gradeValue: string, reExamValue?: string): string {
  if (reExamValue && reExamValue.trim() !== "") {
    return computeRemarks(reExamValue.trim());
  }
  return computeRemarks(gradeValue);
}

export function formatAcademicYear(ay: string): string {
  return ay?.replace("AY_", "AY ").replace("_", "-") ?? "";
}

export function formatGradeDisplay(g: string | null | undefined): string {
  if (!g) return "—";
  const n = parseFloat(g);
  return isNaN(n) ? g : n.toFixed(2);
}

export const DIRECT_MODIFY_ROLES = ["admin", "superuser", "registrar"];
export const ALL_MODIFY_ROLES = [...DIRECT_MODIFY_ROLES, "registrar_staff"];

export function canEdit(role?: string): boolean {
  return !!role && ALL_MODIFY_ROLES.includes(role);
}

export function isDirectModify(role?: string): boolean {
  return !!role && DIRECT_MODIFY_ROLES.includes(role);
}

export function isRegistrarStaff(role?: string): boolean {
  return role === "registrar_staff";
}
