import { Courses, Major, Semester, yearLevels } from "@prisma/client";

export interface CurriculumChecklist {
    id: string;
    course: Courses;
    major: Major;
    yearLevel: yearLevels;
    semester: Semester;
    courseCode: string;
    courseTitle: string;
    creditLec: number;
    creditLab: number;
    preRequisite?: string;
}

export type CurriculumFormData = Omit<CurriculumChecklist, "id">;
