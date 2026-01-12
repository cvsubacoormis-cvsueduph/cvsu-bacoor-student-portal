import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function yearLevelMap(yearlevelAbbreviation: string) {
  switch (yearlevelAbbreviation) {
    case "FIRST":
      return "First Year";
    case "SECOND":
      return "Second Year";
    case "THIRD":
      return "Third Year";
    case "FOURTH":
      return "Fourth Year";
    default:
      return "";
  }
}

export function semesterMap(semesterAbbreviation: string) {
  switch (semesterAbbreviation) {
    case "FIRST":
      return "First Semester";
    case "SECOND":
      return "Second Semester";
    case "MIDYEAR":
      return "Mid year";
    default:
      return "";
  }
}

// Course-specific color mapping
export const courseColors: { [key: string]: string } = {
  BSCS: "#800000",    // Maroon
  BSIT: "#22c55e",    // Green
  BSCRIM: "#000000",  // Black
  BSP: "#a855f7",     // Purple
  BSHM: "#ef4444",    // Red
  BSED: "#3b82f6",    // Blue
  BSBA: "#eab308",    // Yellow
};

export const allCourses = [
  "BSCS",
  "BSIT",
  "BSCRIM",
  "BSP",
  "BSHM",
  "BSBA",
  "BSED",
];

