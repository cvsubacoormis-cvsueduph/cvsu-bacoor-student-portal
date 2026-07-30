// app/actions/getStudentData.ts
"use server";

import prisma from "@/lib/prisma";
import { redis, withRedisFallback } from "@/lib/redis";
import { StudentData } from "@/lib/types";
import { auth } from "@clerk/nextjs/server";
import { getSetting } from "@/actions/settings";

export async function getStudentData(): Promise<StudentData> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("User not authenticated");

    const gradesVisible = await getSetting("GRADES_VISIBLE_TO_STUDENTS");
    const gradesHidden = gradesVisible === "false";

    // Cache key: per-user student data (grades, retake info, profile)
    // TTL: 300s (5 minutes) — quick convergence when grades are updated
    const cacheKey = `cache:student:${userId}:v1`;

    const cached = await withRedisFallback(async () => {
      const raw = await redis.get(cacheKey);
      return raw ? (JSON.parse(raw) as StudentData) : null;
    });

    if (cached) {
      // Use current gradesHidden setting (may have changed independently)
      cached.gradesHidden = gradesHidden;
      return cached;
    }

    const student = await prisma.student.findUnique({
      where: { id: userId },
      include: {
        grades: {
          include: {
            subjectOffering: {
              include: {
                curriculum: true,
              },
            },
          },
          orderBy: [
            { academicYear: "asc" },
            { semester: "asc" },
            { courseCode: "asc" },
          ],
        },
      },
    });

    if (!student) throw new Error("Student not found");

    const emptyGrades: typeof student.grades = [];

    const rawGrades = gradesHidden ? emptyGrades : student.grades;

    // Group grades by course code to calculate attempt numbers
    const gradesByCourse: Record<string, typeof rawGrades> = {};
    rawGrades.forEach((grade) => {
      if (!gradesByCourse[grade.courseCode]) {
        gradesByCourse[grade.courseCode] = [];
      }
      gradesByCourse[grade.courseCode].push(grade);
    });

    // Process retakes and assign attempt numbers
    Object.entries(gradesByCourse).forEach(([courseCode, grades]) => {
      if (grades.length > 1) {
        grades.forEach((grade, index) => {
          grade.attemptNumber = index + 1;
          grade.isRetaken = index > 0;
          grade.retakenAYSem = `AY ${grade.academicYear
            .split("_")
            .slice(1)
            .join("-")} / ${
            grade.semester === "FIRST"
              ? "1st"
              : grade.semester === "SECOND"
                ? "2nd"
                : "Midyear"
          } Sem (Attempt ${index + 1})`;
        });
      } else {
        grades[0].attemptNumber = 1;
        grades[0].isRetaken = false;
      }
    });

    const data: StudentData = {
      id: student.id,
      username: student.username,
      firstName: student.firstName,
      lastName: student.lastName,
      middleInit: student.middleInit || "",
      studentNumber: student.studentNumber,
      address: student.address,
      phone: student.phone || "",
      course: student.course,
      major: student.major,
      grades: rawGrades.map((grade) => ({
        courseCode: grade.courseCode,
        courseTitle:
          grade.subjectOffering?.curriculum.courseTitle || grade.courseTitle,
        grade: grade.grade,
        reExam: grade.reExam || "",
        remarks: grade.remarks || "",
        academicYear: grade.academicYear,
        semester: grade.semester,
        instructor: grade.instructor || "",
        attemptNumber: grade.attemptNumber || 1,
        isRetaken: grade.isRetaken || false,
        retakenAYSem: grade.retakenAYSem || "",
        creditUnit: grade.creditUnit,
        createdAt: grade.createdAt,
      })),
      gradesHidden,
      status: student.status,
      email: student.email || "",
      sex: student.sex,
      role: student.role,
      isApproved: student.isApproved,
      isPasswordSet: student.isPasswordSet,
      createdAt: student.createdAt,
    };

    // Populate cache for subsequent requests (fire-and-forget; Redis failure won't block)
    await withRedisFallback(async () => {
      await redis.set(cacheKey, JSON.stringify(data), "EX", 300);
    });

    return data;
  } catch (err: any) {
    if (err.code === "RATE_LIMIT_EXCEEDED") {
      throw err;
    }
    console.error("Error fetching student data:", err);
    throw new Error("Internal server error");
  }
}
