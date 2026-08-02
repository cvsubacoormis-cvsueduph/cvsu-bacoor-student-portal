"use server";

import prisma from "@/lib/prisma";
import { redis, withRedisFallback } from "@/lib/redis";
import { CurriculumItem } from "@/lib/types";
import {
  Courses,
  Major,
  Semester,
  yearLevels,
  CurriculumChecklist,
} from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { curriculumChecklistData } from "@/prisma/curriculum";

export interface SeedLog {
  type: "success" | "info" | "warning" | "error";
  message: string;
}
export async function getCurriculumChecklist(
  course: string,
  major: string | null,
  grades?: Array<{ courseCode: string; grade: string }>
): Promise<CurriculumItem[]> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  try {
    // Cache key includes course, major and a version suffix for easy invalidation
    // TTL: 3600s (1 hour) — curriculum data changes infrequently
    const cacheKey = `cache:curriculum:checklist:${course}:${major || "NONE"}:v1`;

    // Try Redis cache first (gracefully falls through on Redis failure)
    const cached = await withRedisFallback(async () => {
      const raw = await redis.get(cacheKey);
      return raw ? (JSON.parse(raw) as CurriculumChecklist[]) : null;
    });

    let curriculum: CurriculumChecklist[];
    if (cached) {
      curriculum = cached;
    } else {
      curriculum = await prisma.curriculumChecklist.findMany({
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

      // Cache the raw result (student grades are applied per-request below)
      await withRedisFallback(async () => {
        await redis.set(cacheKey, JSON.stringify(curriculum), "EX", 3600);
      });
    }

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
        grade: studentGrade?.grade || "",
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

  // Invalidate Redis cache for this course+major, the full list, and subject-offerings
  await withRedisFallback(async () => {
    await redis.del(
      `cache:curriculum:checklist:${data.course}:${data.major}:v1`,
      "cache:curriculum:all:v1"
    );
    // Subject offerings depend on curriculum data — bust all subject-offerings cache entries
    let cursor = "0";
    do {
      const result = await redis.scan(
        cursor,
        "MATCH",
        "cache:subject-offerings:*",
        "COUNT",
        "100"
      );
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
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
    role?.role !== "registrar" &&
    role?.role !== "registrar_staff"
  ) {
    throw new Error("Unauthorized role");
  }

  // Cache key for the full curriculum list (admin view)
  // TTL: 3600s (1 hour)
  const cacheKey = "cache:curriculum:all:v1";

  const cached = await withRedisFallback(async () => {
    const raw = await redis.get(cacheKey);
    return raw ? (JSON.parse(raw) as CurriculumChecklist[]) : null;
  });

  if (cached) {
    return cached;
  }

  const data = await prisma.curriculumChecklist.findMany({
    orderBy: { courseCode: "asc" },
  });

  await withRedisFallback(async () => {
    await redis.set(cacheKey, JSON.stringify(data), "EX", 3600);
  });

  return data;
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
  // Invalidate Redis cache for this course+major, the full list, and subject-offerings
  await withRedisFallback(async () => {
    await redis.del(
      `cache:curriculum:checklist:${data.course}:${data.major}:v1`,
      "cache:curriculum:all:v1"
    );
    // Subject offerings depend on curriculum data — bust all subject-offerings cache entries
    let cursor = "0";
    do {
      const result = await redis.scan(
        cursor,
        "MATCH",
        "cache:subject-offerings:*",
        "COUNT",
        "100"
      );
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  });

  revalidatePath("/curriculum");
  return item;
}

export async function deleteCurriculumChecklist(id: string) {
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

  await prisma.curriculumChecklist.delete({
    where: {
      id: id,
    },
  });

  // Invalidate the full-list cache (we don't have course+major from id alone)
  // and all subject-offerings cache entries (curriculum change affects them)
  await withRedisFallback(async () => {
    await redis.del("cache:curriculum:all:v1");
    let cursor = "0";
    do {
      const result = await redis.scan(
        cursor,
        "MATCH",
        "cache:subject-offerings:*",
        "COUNT",
        "100"
      );
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
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

  const user = await getCurrentUser();
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

    // Invalidate all curriculum and subject-offerings cache keys after bulk seeding
    await withRedisFallback(async () => {
      let cursor = "0";
      do {
        const result = await redis.scan(
          cursor,
          "MATCH",
          "cache:curriculum:*",
          "COUNT",
          "100"
        );
        cursor = result[0];
        const keys = result[1];
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== "0");

      cursor = "0";
      do {
        const result = await redis.scan(
          cursor,
          "MATCH",
          "cache:subject-offerings:*",
          "COUNT",
          "100"
        );
        cursor = result[0];
        const keys = result[1];
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== "0");
    });

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
    role?.role !== "registrar" &&
    role?.role !== "registrar_staff"
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
