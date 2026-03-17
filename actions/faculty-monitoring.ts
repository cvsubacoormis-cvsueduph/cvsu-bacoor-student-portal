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

    // 3. Get grades uploaded by these specific faculties for the active term
    const facultyUsernames = faculties.map((f) => f.username);

    const gradesGrouped = await prisma.grade.groupBy({
      by: ["uploadedBy"],
      where: {
        academicYear,
        semester,
        uploadedBy: {
          in: facultyUsernames,
        },
      },
      _count: {
        id: true,
      },
    });

    // Create a map for quick lookup
    const uploadedByMap = new Map<string, number>();
    gradesGrouped.forEach((group) => {
      uploadedByMap.set(group.uploadedBy, group._count.id);
    });

    // 4. Map faculties to their upload status
    const statusResult: FacultyUploadStatus[] = faculties.map((faculty) => {
      const name = `${faculty.lastName}, ${faculty.firstName} ${
        faculty.middleInit ? faculty.middleInit + "." : ""
      }`.trim();
      const count = uploadedByMap.get(faculty.username) || 0;

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
