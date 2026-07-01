// app/actions/getStudentCurriculum.ts
"use server";

import { getStudentData } from "./getStudentData";
import { getCurriculumChecklist } from "./curriculum-actions";
import { getCreditedSubjectCodes } from "./credited-subjects";
import { auth } from "@clerk/nextjs/server";

export async function getStudentCurriculum() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  try {
    const student = await getStudentData();
    const curriculum = await getCurriculumChecklist(
      student.course,
      student.major
    );

    // Fetch credited subjects to determine which subjects are creditable
    const creditedSubjectCodes = await getCreditedSubjectCodes(
      student.studentNumber,
    );

    // Merge curriculum with grades (and credited subjects)
    const curriculumWithGrades = curriculum.map((item) => {
      const grade = student.grades.find(
        (g) => g.courseCode === item.courseCode
      );

      const completion = grade
        ? grade.remarks?.toUpperCase().includes("FAILED")
          ? "Failed"
          : grade.remarks?.toUpperCase().includes("DROPPED")
            ? "Dropped"
            : "Completed"
        : creditedSubjectCodes[item.courseCode]
          ? "Credited"
          : "Not Taken";

      return {
        ...item,
        grade: grade?.grade || "",
        completion,
        remarks: grade?.remarks || "",
        academicYear: grade?.academicYear || "",
        semesterTaken: grade?.semester || "",
      };
    });

    return {
      studentInfo: {
        fullName: `${student.firstName} ${student.middleInit} ${student.lastName}`,
        studentNumber: student.studentNumber,
        address: student.address,
        course: student.course,
        major: student.major,
      },
      curriculum: curriculumWithGrades,
    };
  } catch (error) {
    console.error("Error fetching student curriculum:", error);
    throw error;
  }
}
