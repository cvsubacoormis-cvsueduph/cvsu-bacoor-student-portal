"use server";

import prisma from "@/lib/prisma";
import { AcademicYear, Semester } from "@prisma/client";

export type FacultyUploadStatus = {
  id: string;
  username: string;
  name: string;
  hasUploaded: boolean;
  gradesUploadedCount: number;
};

function normalizeInstructorName(name: string) {
  if (!name) return "";
  const cleaned = String(name).replace(/['.,]/g, "").toUpperCase();
  const tokens = cleaned.split(/\s+/);

  const ignoredWords = new Set([
    "MR", "MS", "MRS", "DR", "PROF", "ENGR", "ARCH", "ATTY", "REV", "FR", "HON",
    "LPT", "MIT", "MSCS", "MAED", "PHD", "EDD", "MAT", "MBA", "MPA", "RN", "CPA", "MD", "JD", "DMD", "DBA", "DPA",
    "INSTRUCTOR", "FACULTY", "PROFESSOR"
  ]);

  const filtered = tokens.filter(t => !ignoredWords.has(t));
  return filtered.join(" ");
}

export async function getFacultyUploadStatus(
  academicYear: AcademicYear,
  semester: Semester,
  page: number = 1,
  limit: number = 10
): Promise<{ data: FacultyUploadStatus[]; total: number }> {
  try {
    const isExport = limit === 0;

    // 1. Get total count of faculties
    const total = await prisma.user.count({
      where: {
        role: "faculty",
      },
    });

    if (total === 0) return { data: [], total: 0 };

    // 2. Get faculties with pagination (or all if export)
    const faculties = await prisma.user.findMany({
      where: {
        role: "faculty",
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        middleInit: true,
      },
      orderBy: {
        lastName: "asc",
      },
      ...(isExport ? {} : {
        skip: (page - 1) * limit,
        take: limit,
      }),
    });

    // 3. Get grades uploaded for the active term.
    // We group ALL grades by uploadedBy and instructor to map them properly.
    const gradesGrouped = await prisma.grade.groupBy({
      by: ["uploadedBy", "instructor"],
      where: {
        academicYear,
        semester,
      },
      _count: {
        id: true,
      },
    });

    // Create a map for robust lookup
    const uploadedByMap = new Map<string, number>();
    const instructorMap = new Map<string, number>();

    gradesGrouped.forEach((group) => {
      // Map by who uploaded it
      if (group.uploadedBy) {
        const cleanName = group.uploadedBy.toLowerCase().replace(/\s+/g, " ").trim();
        uploadedByMap.set(cleanName, (uploadedByMap.get(cleanName) || 0) + group._count.id);
      }

      // Map by who the instructor is
      if (group.instructor) {
        const cleanInst = normalizeInstructorName(group.instructor).toLowerCase();
        instructorMap.set(cleanInst, (instructorMap.get(cleanInst) || 0) + group._count.id);
      }
    });

    // 4. Map faculties to their upload status
    const statusResult: FacultyUploadStatus[] = faculties.map((faculty) => {
      const name = `${faculty.lastName}, ${faculty.firstName} ${faculty.middleInit ? faculty.middleInit + "." : ""
        }`.trim();

      const clerkFullName = `${faculty.firstName} ${faculty.lastName}`.toLowerCase().replace(/\s+/g, " ").trim();
      const clerkFullNameWithMiddle = faculty.middleInit
        ? `${faculty.firstName} ${faculty.middleInit} ${faculty.lastName}`.toLowerCase().replace(/\s+/g, " ").trim()
        : clerkFullName;
      const reverseName = `${faculty.lastName} ${faculty.firstName}`.toLowerCase().replace(/\s+/g, " ").trim();
      const usernameLower = faculty.username.toLowerCase();

      const possibleName1 = clerkFullName;
      const possibleName2 = usernameLower;
      const possibleName3 = reverseName;
      const possibleName4 = clerkFullNameWithMiddle;

      // Also generate the normalized instructor name for this faculty
      const normalInst1 = normalizeInstructorName(`${faculty.firstName} ${faculty.lastName}`).toLowerCase();
      const normalInst2 = normalizeInstructorName(`${faculty.firstName} ${faculty.middleInit || ""} ${faculty.lastName}`).toLowerCase();

      let count = uploadedByMap.get(possibleName1) ||
        uploadedByMap.get(possibleName2) ||
        uploadedByMap.get(possibleName3) ||
        uploadedByMap.get(possibleName4) || 0;

      // If we didn't find it by uploadedBy, try finding it by instructor
      if (count === 0) {
        count = instructorMap.get(normalInst1) || instructorMap.get(normalInst2) || 0;
      }

      return {
        id: faculty.id,
        username: faculty.username,
        name,
        hasUploaded: count > 0,
        gradesUploadedCount: count,
      };
    });

    return {
      data: statusResult,
      total,
    };
  } catch (error) {
    console.error("Failed to fetch faculty upload status", error);
    throw new Error("Failed to fetch faculty upload status");
  }
}
