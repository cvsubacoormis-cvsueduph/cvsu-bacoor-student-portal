import { Courses, Major, Semester, yearLevels } from "@prisma/client";

export const courseOptions: Courses[] = [
    "BSIT",
    "BSCS",
    "BSCRIM",
    "BSP",
    "BSHM",
    "BSBA",
    "BSED",
];

export const majorOptions: Major[] = [
    "NONE",
    "ENGLISH",
    "HUMAN_RESOURCE_MANAGEMENT",
    "MATHEMATICS",
    "MARKETING_MANAGEMENT",
];

export const yearLevelOptions: yearLevels[] = ["FIRST", "SECOND", "THIRD", "FOURTH"];

export const semesterOptions: Semester[] = ["FIRST", "SECOND", "MIDYEAR"];

export const formatLabel = (value: string) => {
    return value
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase());
};
