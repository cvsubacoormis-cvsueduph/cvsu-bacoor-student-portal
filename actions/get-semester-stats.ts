// app/actions/get-semester-stats.ts
"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

interface SemesterStats {
  totalCreditsEnrolled: number;
  totalCreditsEarned: number;
  gpa: string;
}

export async function getPreviousSemesterStats(): Promise<SemesterStats> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("User not authenticated");

    // Get the student's data including grades
    const student = await prisma.student.findUnique({
      where: { id: userId },
      include: {
        grades: {
          orderBy: [{ academicYear: "desc" }, { semester: "desc" }],
        },
      },
    });

    if (!student) throw new Error("Student not found");

    // If no grades exist, return default values
    if (student.grades.length === 0) {
      return {
        totalCreditsEnrolled: 0,
        totalCreditsEarned: 0,
        gpa: "0.00",
      };
    }

    // Get the most recent academic term from the grades
    const mostRecentGrade = student.grades[0];
    const previousAcademicYear = mostRecentGrade.academicYear;
    const previousSemester = mostRecentGrade.semester;

    const previousSemesterGrades = student.grades.filter(
      (grade) =>
        grade.academicYear === previousAcademicYear &&
        grade.semester === previousSemester
    );

    // Calculate statistics
    let totalCreditsEnrolled = 0;
    let totalCreditsEarned = 0;

    for (const grade of previousSemesterGrades) {
      const finalGrade = grade.reExam !== null ? grade.reExam : grade.grade;

      // Skip if grade is incomplete or dropped
      if (["INC", "DRP"].includes(finalGrade)) continue;

      totalCreditsEnrolled += grade.creditUnit;

      // Convert grade to number if possible
      const numericGrade = parseFloat(finalGrade);
      if (!isNaN(numericGrade)) {
        totalCreditsEarned += grade.creditUnit * numericGrade;
      }
    }

    // Calculate GPA
    const gpa =
      totalCreditsEnrolled > 0
        ? (totalCreditsEarned / totalCreditsEnrolled).toFixed(2)
        : "0.00";

    return {
      totalCreditsEnrolled,
      totalCreditsEarned,
      gpa,
    };
  } catch (error) {
    console.error("Error fetching semester stats:", error);
    throw error;
  }
}
