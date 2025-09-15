"use server";

import prisma from "@/lib/prisma";
import { CurriculumItem } from "@/lib/types";
import { Courses, Major, Semester, yearLevels } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
export async function getCurriculumChecklist(
  course: string,
  major: string | null,
  grades?: Array<{ courseCode: string; grade: string }> // Add grades parameter
): Promise<CurriculumItem[]> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  try {
    const curriculum = await prisma.curriculumChecklist.findMany({
      where: {
        course: course as Courses,
        major: (major as Major) || "NONE",
      },
      orderBy: [
        { yearLevel: "asc" },
        { semester: "asc" },
        { courseCode: "asc" },
      ],
    });

    return curriculum.map((item) => {
      // Find matching grade if grades array is provided
      const studentGrade = grades?.find(
        (g) => g.courseCode === item.courseCode
      );

      return {
        id: item.id,
        yearLevel: item.yearLevel,
        semester: item.semester,
        courseCode: item.courseCode,
        courseTitle: item.courseTitle,
        creditUnit: {
          lec: item.creditLec || 0,
          lab: item.creditLab || 0,
        },
        contactHrs: {
          lec: item.creditLec || 0,
          lab: item.creditLab || 0,
        },
        preRequisite: item.preRequisite || "",
        grade: studentGrade?.grade || "", // Use actual grade if available
        remarks: "",
        completion: studentGrade ? "Taken" : "Not Taken",
      };
    });
  } catch (error) {
    console.error("Error fetching curriculum:", error);
    throw error;
  }
}

export async function createCurriculumChecklist(data: {
  course: Courses;
  major: Major;
  yearLevel: yearLevels;
  semester: Semester;
  courseCode: string;
  courseTitle: string;
  creditLec: number;
  creditLab: number;
  preRequisite?: string | null;
}) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const role = sessionClaims?.metadata as { role?: string };

  if (
    role?.role !== "admin" &&
    role?.role !== "faculty" &&
    role?.role !== "registrar"
  ) {
    throw new Error("Unauthorized");
  }

  const item = await prisma.curriculumChecklist.create({
    data: {
      ...data,
      preRequisite: data.preRequisite || null,
    },
  });

  revalidatePath("/curriculum");
  return item;
}

export async function getCurriculumChecklistForCourse() {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.metadata as { role?: string };

  if (!userId) throw new Error("Unauthorized");

  if (
    role?.role !== "admin" &&
    role?.role !== "faculty" &&
    role?.role !== "registrar"
  ) {
    throw new Error("Unauthorized role");
  }

  return prisma.curriculumChecklist.findMany({
    orderBy: { courseCode: "asc" },
  });
}

export async function updateCurriculumChecklist(data: {
  id: string;
  course: Courses;
  major: Major;
  yearLevel: yearLevels;
  semester: Semester;
  courseCode: string;
  courseTitle: string;
  creditLec: number;
  creditLab: number;
  preRequisite?: string | null;
}) {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.metadata as { role?: string };

  if (!userId) {
    throw new Error("Unauthorized");
  }

  if (
    role?.role !== "admin" &&
    role?.role !== "faculty" &&
    role?.role !== "registrar"
  ) {
    throw new Error("Unauthorized role");
  }

  const item = await prisma.curriculumChecklist.update({
    where: { id: data.id },
    data: {
      ...data,
      preRequisite: data.preRequisite || null,
    },
  });
  revalidatePath("/curriculum");
  return item;
}

export async function deleteCurriculumChecklist(id: string) {
  await prisma.curriculumChecklist.delete({
    where: {
      id: id,
    },
  });

  revalidatePath("/curriculum");
  return { success: true, message: "Deleted successfully" };
}
