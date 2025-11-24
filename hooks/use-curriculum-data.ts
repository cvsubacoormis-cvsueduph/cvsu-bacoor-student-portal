
import { useState, useEffect } from "react";
import { getCurriculumChecklist } from "@/actions/curriculum-actions";
import { getStudentGradesWithReExam } from "@/actions/student-grades/student-grades";
import { Subject, AcademicProgress } from "@/lib/types";
import { getBetterGrade } from "@/lib/checklist-utils";

export interface CurriculumData {
  curriculum: Subject[];
  progress: AcademicProgress;
  studentInfo: {
    fullName: string;
    studentNumber: string;
    course: string;
    major: string | null;
  };
}

export function useCurriculumData() {
  const [data, setData] = useState<CurriculumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    async function loadCurriculum() {
      try {
        setLoading(true);
        const student = await getStudentGradesWithReExam();

        if (!student || !student.student) {
            throw new Error("Student data not found");
        }

        const grades = student.student.grades || [];

        const curriculum = await getCurriculumChecklist(
          student.student.course,
          student.student.major
        );

        const gradesByCourse: Record<string, typeof grades> = {};
        grades.forEach((grade: any) => {
          if (!gradesByCourse[grade.courseCode]) {
            gradesByCourse[grade.courseCode] = [];
          }
          gradesByCourse[grade.courseCode].push(grade);
        });

        // Process retakes and assign attempt numbers
        Object.entries(gradesByCourse).forEach(([courseCode, grades]) => {
          if (grades.length > 1) {
            grades.sort((a: any, b: any) => {
              // Sort by academic year and semester
              const yearA = a.academicYear;
              const yearB = b.academicYear;
              if (yearA !== yearB) return yearA.localeCompare(yearB);
              return a.semester.localeCompare(b.semester);
            });

            grades.forEach((grade: any, index: number) => {
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

        // Merge curriculum with grades
        const curriculumWithGrades = curriculum.map((item) => {
          const gradesForCourse = gradesByCourse[item.courseCode] || [];
          const latestGrade = gradesForCourse[gradesForCourse.length - 1];
          const retakeCount =
            gradesForCourse.length > 1 ? gradesForCourse.length - 1 : 0;
          const allAttempts = gradesForCourse.map((g: any) => ({
            academicYear: g.academicYear,
            semester: g.semester,
            grade: g.grade,
            remarks: g.remarks,
            attemptNumber: g.attemptNumber,
            retakenAYSem: g.retakenAYSem,
            reExam: g.reExam,
          }));

          // Pick the better grade (grade vs reExam)
          const effectiveGrade = getBetterGrade(
            latestGrade?.grade,
            latestGrade?.reExam ?? ""
          );

          const completion = latestGrade
            ? effectiveGrade === "INC" ||
              latestGrade.remarks?.toUpperCase().includes("LACK OF REQ.")
              ? "Incomplete"
              : latestGrade.remarks?.toUpperCase().includes("FAILED")
                ? "Failed"
                : latestGrade.remarks?.toUpperCase().includes("UNSATISFACTORY")
                  ? "Unsatisfactory"
                  : latestGrade.remarks?.toUpperCase().includes("CON. FAILURE")
                    ? "Con. Failure"
                    : latestGrade.remarks?.toUpperCase().includes("DROPPED")
                      ? "Dropped"
                      : "Completed"
            : "Not Taken";

          return {
            ...item,
            grade: latestGrade?.grade || "",
            completion,
            remarks: latestGrade?.remarks || "",
            retakeCount,
            latestAttempt: latestGrade?.attemptNumber || 1,
            allAttempts,
            retaken: latestGrade?.isRetaken ? latestGrade.retakenAYSem : null,
          };
        });

        // Calculate progress metrics
        const creditsCompleted = curriculumWithGrades
          .filter((subject) => subject.completion === "Completed")
          .reduce(
            (sum, subject) =>
              sum + subject.creditUnit.lec + subject.creditUnit.lab,
            0
          );

        const totalCreditsRequired = curriculumWithGrades.reduce(
          (sum, item) => sum + item.creditUnit.lec + item.creditUnit.lab,
          0
        );

        // Calculate GPA
        const gradedSubjects = curriculumWithGrades
          .filter(
            (subject) => subject.completion === "Completed" && subject.grade
          )
          .map((subject) => ({
            grade: parseFloat(subject.grade) || 0,
            credits: subject.creditUnit.lec + subject.creditUnit.lab,
          }));

        const gpa =
          gradedSubjects.length > 0
            ? gradedSubjects.reduce(
                (sum, { grade, credits }) => sum + grade * credits,
                0
              ) / gradedSubjects.reduce((sum, { credits }) => sum + credits, 0)
            : 0;

        setData({
          curriculum: curriculumWithGrades as Subject[],
          progress: {
            creditsCompleted,
            totalCreditsRequired,
            completionRate: Math.round(
              (creditsCompleted / totalCreditsRequired) * 100
            ),
            currentGPA: parseFloat(gpa.toFixed(2)),
            subjectsCompleted: curriculumWithGrades.filter(
              (s) => s.completion === "Completed"
            ).length,
            subjectsRemaining: curriculumWithGrades.filter(
              (s) => s.completion !== "Completed"
            ).length,
          },
          studentInfo: {
            fullName: `${student.student.firstName} ${student.student.lastName}`,
            studentNumber: student.student.studentNumber,
            course: student.student.course,
            major: student.student.major,
          },
        });
      } catch (error: any) {
        console.error("Error fetching curriculum:", error);
        setError(error);
      } finally {
        setLoading(false);
      }
    }
    loadCurriculum();
  }, []);

  return { data, loading, error };
}
