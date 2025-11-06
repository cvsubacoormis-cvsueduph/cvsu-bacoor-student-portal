export type AcademicYears =
  | "AY_2019_2020"
  | "AY_2020_2021"
  | "AY_2021_2022"
  | "AY_2022_2023"
  | "AY_2023_2024"
  | "AY_2024_2025"
  | "AY_2025_2026"
  | "AY_2026_2027"
  | "AY_2027_2028"
  | "AY_2028_2029"
  | "AY_2029_2030"
  | "AY_2030_2031"
  | "AY_2031_2032"
  | "AY_2032_2033"
  | "AY_2033_2034"
  | "AY_2034_2035"
  | "AY_2035_2036"
  | "AY_2036_2037"
  | "AY_2037_2038"
  | "AY_2038_2039"
  | "AY_2039_2040";
export type Semester = "FIRST" | "SECOND" | "MIDYEAR";
export type Courses =
  | "BSIT"
  | "BSCS"
  | "BSCRIM"
  | "BSP"
  | "BSHM"
  | "BSED"
  | "BSBA";
export type Major =
  | "NONE"
  | "ENGLISH"
  | "MATHEMATICS"
  | "MARKETING_MANAGEMENT"
  | "HUMAN_RESOURCE_MANAGEMENT";

export interface CourseMajorConfig {
  course: Courses;
  majors: Major[];
  enabled: boolean;
}

export interface SeedLog {
  id: string;
  type: "success" | "info" | "warning" | "error";
  message: string;
  timestamp: Date;
}

export const initialCourseMajorConfig: CourseMajorConfig[] = [
  { course: "BSIT", majors: ["NONE"], enabled: true },
  { course: "BSCS", majors: ["NONE"], enabled: true },
  { course: "BSCRIM", majors: ["NONE"], enabled: true },
  { course: "BSP", majors: ["NONE"], enabled: true },
  { course: "BSHM", majors: ["NONE"], enabled: true },
  { course: "BSED", majors: ["ENGLISH", "MATHEMATICS"], enabled: true },
  {
    course: "BSBA",
    majors: ["MARKETING_MANAGEMENT", "HUMAN_RESOURCE_MANAGEMENT"],
    enabled: true,
  },
];

export const academicYears: AcademicYears[] = [
  "AY_2019_2020",
  "AY_2020_2021",
  "AY_2021_2022",
  "AY_2022_2023",
  "AY_2023_2024",
  "AY_2024_2025",
  "AY_2025_2026",
  "AY_2026_2027",
  "AY_2027_2028",
  "AY_2028_2029",
  "AY_2029_2030",
  "AY_2030_2031",
  "AY_2031_2032",
  "AY_2032_2033",
  "AY_2033_2034",
  "AY_2034_2035",
  "AY_2035_2036",
  "AY_2036_2037",
  "AY_2037_2038",
  "AY_2038_2039",
  "AY_2039_2040",
];

export const availableMajors: Record<Courses, Major[]> = {
  BSIT: ["NONE"],
  BSCS: ["NONE"],
  BSCRIM: ["NONE"],
  BSP: ["NONE"],
  BSHM: ["NONE"],
  BSED: ["NONE", "ENGLISH", "MATHEMATICS"],
  BSBA: ["NONE", "MARKETING_MANAGEMENT", "HUMAN_RESOURCE_MANAGEMENT"],
};
