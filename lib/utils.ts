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
