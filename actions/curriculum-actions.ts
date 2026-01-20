"use server";

import prisma from "@/lib/prisma";
import { CurriculumItem } from "@/lib/types";
import { Courses, Major, Semester, yearLevels } from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { curriculumChecklistData } from "@/prisma/curriculum";

export interface SeedLog {
  type: "success" | "info" | "warning" | "error";
  message: string;
}
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

export async function seedCurriculum(): Promise<SeedLog[]> {
  const logs: SeedLog[] = [];

  const { userId } = await auth();
  if (!userId) {
    logs.push({
      type: "error",
      message: "❌ Unauthorized. Please sign in first.",
    });
    return logs;
  }

  const user = await currentUser();
  const isAdmin =
    user?.publicMetadata?.role === "admin" ||
    user?.privateMetadata?.role === "admin";

  if (!isAdmin) {
    logs.push({
      type: "error",
      message: "❌ Forbidden. Only admins can seed curriculum data.",
    });
    return logs;
  }

  try {
    logs.push({
      type: "info",
      message: "🌱 Checking existing curriculum checklist records...",
    });

    const existing = await prisma.curriculumChecklist.count();
    if (existing > 0) {
      logs.push({
        type: "warning",
        message: `⚠️ ${existing} curriculum records already exist. Seeding skipped to avoid duplication.`,
      });
      return logs;
    }

    logs.push({
      type: "info",
      message: "🌱 Seeding Curriculum Checklist...",
    });

    for (const subject of curriculumChecklistData) {
      await prisma.curriculumChecklist.create({
        data: {
          course: subject.course as Courses,
          yearLevel: subject.yearLevel as yearLevels,
          semester: subject.semester as Semester,
          courseCode: subject.courseCode,
          courseTitle: subject.courseTitle,
          major: subject.major as Major,
          creditLec: subject.creditLec,
          creditLab: subject.creditLab,
          preRequisite: subject.preRequisite,
        },
      });

      logs.push({
        type: "success",
        message: `✅ Added ${subject.courseCode} (${subject.course})`,
      });
    }

    logs.push({
      type: "success",
      message: "✅ Curriculum Checklist seeding complete.",
    });
  } catch (error: any) {
    logs.push({
      type: "error",
      message: `❌ Seeding error: ${error.message}`,
    });
  } finally {
    await prisma.$disconnect();
  }

  return logs;
}

export async function getCurriculumForExport(course?: string) {
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

  const where: any = {};
  if (course && course !== "ALL") {
    where.course = course as Courses;
  }

  const items = await prisma.curriculumChecklist.findMany({
    where,
    orderBy: [
      { course: "asc" },
      { yearLevel: "asc" },
      { semester: "asc" },
      { courseCode: "asc" },
    ],
  });

  return items;
}
