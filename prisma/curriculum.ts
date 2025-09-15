import { Courses, Major, Semester, yearLevels } from "@prisma/client";
import {
  BMHRchecklistData,
  BMMMchecklistData,
  BSEDENGData,
  BSEDMATHchecklistData,
  CRIMchecklistData,
  CSchecklistData,
  HMchecklistData,
  ITchecklistData,
  PSYchecklistData,
} from "../lib/data";

function parseYearLevel(text: string): yearLevels {
  const map = {
    "First Year": "FIRST",
    "Second Year": "SECOND",
    "Third Year": "THIRD",
    "Fourth Year": "FOURTH",
  };
  return map[text as keyof typeof map] as yearLevels;
}

function parseSemester(text: string): Semester {
  const map = {
    "First Semester": "FIRST",
    "Second Semester": "SECOND",
    "Mid-year": "MIDYEAR",
  };
  return map[text as keyof typeof map] as Semester;
}

function convertChecklist(data: typeof CRIMchecklistData, course: Courses) {
  return data.map((subject) => ({
    course,
    yearLevel: parseYearLevel(subject.yearLevel),
    semester: parseSemester(subject.semester),
    courseCode: subject.courseCode,
    courseTitle: subject.courseTitle,
    major: subject.major,
    creditLec: subject.creditUnit.lec ?? 0,
    creditLab: subject.creditUnit.lab ?? 0,
    preRequisite: subject.preRequisite ? subject.preRequisite : null,
  }));
}

export const curriculumChecklistData = [
  ...convertChecklist(
    PSYchecklistData.filter(
      (item) => item !== undefined
    ) as typeof ITchecklistData,
    Courses.BSP
  ),
  ...convertChecklist(ITchecklistData, Courses.BSIT),
  ...convertChecklist(CSchecklistData, Courses.BSCS),
  ...convertChecklist(HMchecklistData, Courses.BSHM),
  ...convertChecklist(BMHRchecklistData, Courses.BSBA),
  ...convertChecklist(BMMMchecklistData, Courses.BSBA),
  ...convertChecklist(CRIMchecklistData, Courses.BSCRIM),
  ...convertChecklist(BSEDENGData, Courses.BSED),
  ...convertChecklist(BSEDMATHchecklistData, Courses.BSED),
];
