"use client";

import { jsPDF } from "jspdf";
import { useRef, useState } from "react";
import { Button } from "./ui/button";
import { CurriculumItem, GradeAttempt } from "@/lib/types";
import { DownloadIcon } from "lucide-react";
import { CurriculumData } from "@/hooks/use-curriculum-data";

type CourseRowProps = {
  code: string;
  title: string;
  lecUnit: number;
  labUnit: number;
  lecHrs: number;
  labHrs: number;
  prereq?: string;
  semester?: string;
  grade?: string;
  instructor?: string;
  academicYear?: string;
  isRetaken?: boolean;
  allAttempts?: GradeAttempt[];
};

const GenerateChecklistPDF = ({ data }: { data: CurriculumData }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [generating, setGenerating] = useState(false);

  const studentData = {
    fullName: data.studentInfo.fullName,
    studentNumber: data.studentInfo.studentNumber,
    address: data.studentInfo.address || "",
    phone: data.studentInfo.phone || "",
    course: data.studentInfo.course,
    major: data.studentInfo.major,
  };

  const checklistData = data.curriculum;

  const getCourseTitle = () => {
    if (!studentData) return "";

    switch (studentData.course) {
      case "BSCS":
        return "BACHELOR OF SCIENCE IN COMPUTER SCIENCE";
      case "BSIT":
        return "BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY";
      case "BSHM":
        return "BACHELOR OF SCIENCE IN HOSPITALITY MANAGEMENT";
      case "BSCRIM":
        return "BACHELOR OF SCIENCE IN CRIMINOLOGY";
      case "BSP":
        return "BACHELOR OF SCIENCE IN PSYCHOLOGY";
      case "BSBA":
        if (studentData.major === "MARKETING_MANAGEMENT") {
          return "BACHELOR OF SCIENCE IN BUSINESS ADMINISTRATION - MARKETING MANAGEMENT";
        } else if (studentData.major === "HUMAN_RESOURCE_MANAGEMENT") {
          return "BACHELOR OF SCIENCE IN BUSINESS ADMINISTRATION - HUMAN RESOURCE MANAGEMENT";
        }
        return "BACHELOR OF SCIENCE IN BUSINESS ADMINISTRATION";
      case "BSED":
        if (studentData.major === "ENGLISH") {
          return "BACHELOR OF SCIENCE IN SECONDARY EDUCATION - Major in English";
        } else if (studentData.major === "MATH") {
          return "BACHELOR OF SCIENCE IN SECONDARY EDUCATION - Major in Mathematics";
        }
        return "BACHELOR OF SCIENCE IN SECONDARY EDUCATION";
      default:
        return "";
    }
  };

  const generateChecklistPDF = async () => {
    if (!buttonRef.current || !studentData || !checklistData.length) return;

    setGenerating(true);

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      doc.setFont("helvetica", "normal");

      const logoWidth = 18;
      const logoHeight = 15;
      const logoX = 40;
      const logoY = 5;

      // Ensure the logo exists in public folder
      try {
        doc.addImage(
          "/printlogo.png",
          "PNG",
          logoX,
          logoY,
          logoWidth,
          logoHeight
        );
      } catch (e) {
        console.warn("Logo not found or invalid");
      }

      doc.setFontSize(9);
      doc.text("Republic of the Philippines", 105, 11, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("CAVITE STATE UNIVERSITY", 105, 16, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Bacoor City Campus", 105, 20, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.text(getCourseTitle(), 105, 25, {
        align: "center",
      });
      doc.setFont("helvetica", "bold");
      if (studentData?.major) {
        doc.text(getCourseTitle(), 105, 25, {
          align: "center",
        });
      } else {
        doc.text(getCourseTitle().split("-")[0].trim(), 105, 25, {
          align: "center",
        });
      }
      doc.text("CHECKLIST OF COURSES", 105, 30, { align: "center" });

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(`Name of Student : ${studentData.fullName}`, 20, 42);
      doc.text("Date of Admission :", 120, 42);
      doc.text(`Student Number : ${studentData.studentNumber}`, 20, 48);
      doc.text(`Contact Number : ${studentData.phone}`, 120, 48);
      doc.text(`Address : ${studentData.address}`, 20, 54);
      doc.text("Name of Adviser :", 120, 54);

      const tableHeaders = [
        "Course Code",
        "Course Title",
        "Credit Unit",
        "Contact Hrs",
        "Pre-Requisite",
        "AY/SEM Taken",
        "Final Grade",
        "Instructor",
      ];

      const creditUnitSubHeaders = ["Lec", "Lab"];
      const contactHrsSubHeaders = ["Lec", "Lab"];

      let yPos = 55;

      const drawTableHeaders = () => {
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");

        doc.text(tableHeaders[0], 10, yPos);
        doc.text(tableHeaders[1], 25, yPos);

        doc.text(tableHeaders[2], 77, yPos - 5);
        doc.text(creditUnitSubHeaders[0], 75, yPos);
        doc.text(creditUnitSubHeaders[1], 85, yPos);

        doc.text(tableHeaders[3], 95, yPos - 5);
        doc.text(contactHrsSubHeaders[0], 95, yPos);
        doc.text(contactHrsSubHeaders[1], 105, yPos);

        doc.text(tableHeaders[4], 115, yPos);
        doc.text(tableHeaders[5], 135, yPos);
        doc.text(tableHeaders[6], 155, yPos);
        doc.text(tableHeaders[7], 170, yPos);

        doc.line(10, yPos + 2, 200, yPos + 2);
        yPos += 5;
      };

      const addCourseRow = ({
        code,
        title,
        lecUnit,
        labUnit,
        lecHrs,
        labHrs,
        prereq,
        academicYear,
        grade,
        instructor,
        allAttempts = [],
      }: CourseRowProps) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
          drawTableHeaders();
        }

        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");

        const titleLines = doc.splitTextToSize(title, 50);
        const prereqLines = doc.splitTextToSize(prereq || "-", 20);

        // Format all attempts text
        let attemptsText = "";
        if (allAttempts && allAttempts.length > 0) {
          attemptsText = allAttempts
            .map(
              (attempt) =>
                `${attempt.academicYear} (${attempt.grade || "-"}) ${attempt.attemptNumber > 1
                  ? `(Attempt ${attempt.attemptNumber})`
                  : ""
                }`
            )
            .join("\n");
        } else {
          attemptsText = "-";
        }

        const maxLines = Math.max(
          titleLines.length,
          prereqLines.length,
          allAttempts?.length || 1
        );
        const rowHeight = maxLines * 4;

        doc.text(code, 10, yPos);
        doc.text(titleLines, 25, yPos);
        doc.text(lecUnit.toString(), 76, yPos);
        doc.text(labUnit.toString(), 86, yPos);
        doc.text(lecHrs.toString(), 96, yPos);
        doc.text(labHrs.toString(), 106, yPos);
        doc.text(prereqLines, 115, yPos);

        // Display all attempts
        const attemptsLines = doc.splitTextToSize(attemptsText, 20);
        doc.text(attemptsLines, 135, yPos);

        doc.text(grade || "-", 155, yPos);
        doc.text(instructor || "-", 170, yPos);

        doc.line(10, yPos + rowHeight - 2, 200, yPos + rowHeight - 2);
        yPos += rowHeight;
      };

      const addSemesterHeader = (semester: string, isYearLevel = false) => {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        } else {
          yPos += 5;
        }

        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(semester, 12, yPos);
        yPos += 5;

        if (!isYearLevel) {
          drawTableHeaders();
        }
      };

      const addSummaryTable = () => {
        if (yPos > 250) {
          doc.addPage();
          yPos = 30;
        } else {
          yPos += 10;
        }

        const tableStartX = 40;
        const columnWidths = [30, 10, 10, 10, 10, 15, 15, 15];
        const totalTableWidth = columnWidths.reduce(
          (sum, width) => sum + width,
          0
        );

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");

        doc.setFontSize(6);
        doc.text("SUMMARY", tableStartX, yPos - 3);
        doc.text("1st Sem", tableStartX + columnWidths[0], yPos - 3);
        doc.text(
          "2nd Sem",
          tableStartX + columnWidths[0] + columnWidths[1] + columnWidths[2],
          yPos - 3
        );
        doc.text(
          "Summer",
          tableStartX +
          columnWidths[0] +
          columnWidths[1] +
          columnWidths[2] +
          columnWidths[3] +
          columnWidths[4],
          yPos - 3
        );
        doc.text(
          "TOTAL (Lec)",
          tableStartX +
          columnWidths[0] +
          columnWidths[1] +
          columnWidths[2] +
          columnWidths[3] +
          columnWidths[4] +
          columnWidths[5],
          yPos - 3
        );
        doc.text(
          "TOTAL (Lab)",
          tableStartX + totalTableWidth - columnWidths[7],
          yPos - 3
        );

        doc.text("Year Level", tableStartX, yPos + 4);
        doc.text("Lec", tableStartX + columnWidths[0], yPos + 4);
        doc.text(
          "Lab",
          tableStartX + columnWidths[0] + columnWidths[1],
          yPos + 4
        );
        doc.text(
          "Lec",
          tableStartX + columnWidths[0] + columnWidths[1] + columnWidths[2],
          yPos + 4
        );
        doc.text(
          "Lab",
          tableStartX +
          columnWidths[0] +
          columnWidths[1] +
          columnWidths[2] +
          columnWidths[3],
          yPos + 4
        );

        yPos += 8;

        const lineStartX = tableStartX - 5;
        const lineEndX = lineStartX + totalTableWidth + 10;
        doc.line(lineStartX, yPos, lineEndX, yPos);
        yPos += 3;

        const summaryData = ["FIRST", "SECOND", "THIRD", "FOURTH"].map(
          (yearLevel) => {
            const firstSem = checklistData.filter(
              (item) =>
                item.yearLevel === yearLevel && item.semester === "FIRST"
            );
            const secondSem = checklistData.filter(
              (item) =>
                item.yearLevel === yearLevel && item.semester === "SECOND"
            );
            const midYear = checklistData.filter(
              (item) =>
                item.yearLevel === yearLevel && item.semester === "MIDYEAR"
            );

            const sem1Lec = firstSem.reduce(
              (sum, item) => sum + (item.creditUnit.lec || 0),
              0
            );
            const sem1Lab = firstSem.reduce(
              (sum, item) => sum + (item.creditUnit.lab || 0),
              0
            );
            const sem2Lec = secondSem.reduce(
              (sum, item) => sum + (item.creditUnit.lec || 0),
              0
            );
            const sem2Lab = secondSem.reduce(
              (sum, item) => sum + (item.creditUnit.lab || 0),
              0
            );
            const summer = midYear.reduce(
              (sum, item) =>
                sum + (item.creditUnit.lec || 0) + (item.creditUnit.lab || 0),
              0
            );
            const totalLec = sem1Lec + sem2Lec;
            const totalLab = sem1Lab + sem2Lab;

            return {
              year: `${yearLevel === "FIRST"
                ? "First"
                : yearLevel === "SECOND"
                  ? "Second"
                  : yearLevel === "THIRD"
                    ? "Third"
                    : "Fourth"
                } Year`,
              sem1Lec,
              sem1Lab,
              sem2Lec,
              sem2Lab,
              summer,
              totalLec,
              totalLab,
            };
          }
        );

        const grandTotalLec = summaryData.reduce(
          (sum, row) => sum + row.totalLec,
          0
        );
        const grandTotalLab = summaryData.reduce(
          (sum, row) => sum + row.totalLab,
          0
        );

        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");

        summaryData.forEach((row) => {
          doc.text(row.year, tableStartX, yPos);
          doc.text(row.sem1Lec.toString(), tableStartX + columnWidths[0], yPos);
          doc.text(
            row.sem1Lab.toString(),
            tableStartX + columnWidths[0] + columnWidths[1],
            yPos
          );
          doc.text(
            row.sem2Lec.toString(),
            tableStartX + columnWidths[0] + columnWidths[1] + columnWidths[2],
            yPos
          );
          doc.text(
            row.sem2Lab.toString(),
            tableStartX +
            columnWidths[0] +
            columnWidths[1] +
            columnWidths[2] +
            columnWidths[3],
            yPos
          );
          doc.text(
            row.summer.toString(),
            tableStartX +
            columnWidths[0] +
            columnWidths[1] +
            columnWidths[2] +
            columnWidths[3] +
            columnWidths[4],
            yPos
          );
          doc.text(
            row.totalLec.toString(),
            tableStartX +
            columnWidths[0] +
            columnWidths[1] +
            columnWidths[2] +
            columnWidths[3] +
            columnWidths[4] +
            columnWidths[5],
            yPos
          );
          doc.text(
            row.totalLab.toString(),
            tableStartX + totalTableWidth - columnWidths[7],
            yPos
          );
          yPos += 5;
        });

        doc.setFont("helvetica", "bold");
        doc.text("Grand Total", tableStartX, yPos);
        doc.text(
          grandTotalLec.toString(),
          tableStartX +
          columnWidths[0] +
          columnWidths[1] +
          columnWidths[2] +
          columnWidths[3] +
          columnWidths[4] +
          columnWidths[5],
          yPos
        );
        doc.text(
          grandTotalLab.toString(),
          tableStartX + totalTableWidth - columnWidths[7],
          yPos
        );
        yPos += 10;
      };

      ["FIRST", "SECOND", "THIRD", "FOURTH"].forEach((yearLevel) => {
        const yearLabel =
          yearLevel === "FIRST"
            ? "First Year"
            : yearLevel === "SECOND"
              ? "Second Year"
              : yearLevel === "THIRD"
                ? "Third Year"
                : "Fourth Year";

        addSemesterHeader(yearLabel, true);

        addSemesterHeader("First Semester");
        checklistData
          .filter(
            (item) => item.yearLevel === yearLevel && item.semester === "FIRST"
          )
          .forEach((item) => {
            addCourseRow({
              code: item.courseCode,
              title: item.courseTitle,
              lecUnit: item.creditUnit.lec,
              labUnit: item.creditUnit.lab,
              lecHrs: item.contactHrs.lec,
              labHrs: item.contactHrs.lab,
              prereq: item.preRequisite || "-",
              academicYear: item.academicYear || "-",
              grade: item.grade || "-",
              instructor: item.instructor || "-",
              allAttempts: item.allAttempts,
            });
          });

        addSemesterHeader("Second Semester");
        checklistData
          .filter(
            (item) => item.yearLevel === yearLevel && item.semester === "SECOND"
          )
          .forEach((item) => {
            addCourseRow({
              code: item.courseCode,
              title: item.courseTitle,
              lecUnit: item.creditUnit.lec,
              labUnit: item.creditUnit.lab,
              lecHrs: item.contactHrs.lec,
              labHrs: item.contactHrs.lab,
              prereq: item.preRequisite || "-",
              academicYear: item.academicYear || "-",
              grade: item.grade || "-",
              instructor: item.instructor || "-",
              allAttempts: item.allAttempts,
            });
          });

        const hasMidYear = checklistData.some(
          (item) => item.yearLevel === yearLevel && item.semester === "MIDYEAR"
        );
        if (hasMidYear) {
          addSemesterHeader("Mid-year");
          checklistData
            .filter(
              (item) =>
                item.yearLevel === yearLevel && item.semester === "MIDYEAR"
            )
            .forEach((item) => {
              addCourseRow({
                code: item.courseCode,
                title: item.courseTitle,
                lecUnit: item.creditUnit.lec,
                labUnit: item.creditUnit.lab,
                lecHrs: item.contactHrs.lec,
                labHrs: item.contactHrs.lab,
                prereq: item.preRequisite || "-",
                academicYear: item.academicYear || "-",
                grade: item.grade || "-",
                instructor: item.instructor || "-",
                allAttempts: item.allAttempts,
              });
            });
        }
      });

      addSummaryTable();

      // Add retake summary
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      } else {
        yPos += 10;
      }

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Retake Summary", 20, yPos);
      yPos += 5;

      // Get all retaken courses
      const retakenCourses = checklistData.filter(
        (item) => item.allAttempts && item.allAttempts.length > 1
      );

      if (retakenCourses.length > 0) {
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.text("Course Code", 20, yPos);
        doc.text("Course Title", 50, yPos);
        doc.text("Attempts", 120, yPos);
        doc.text("Grades", 150, yPos);
        yPos += 5;

        doc.line(20, yPos, 200, yPos);
        yPos += 3;

        doc.setFont("helvetica", "normal");
        retakenCourses.forEach((course) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
            doc.setFont("helvetica", "bold");
            doc.text("Course Code", 20, yPos);
            doc.text("Course Title", 50, yPos);
            doc.text("Attempts", 120, yPos);
            doc.text("Grades", 150, yPos);
            yPos += 5;
            doc.line(20, yPos, 200, yPos);
            yPos += 3;
            doc.setFont("helvetica", "normal");
          }

          const titleLines = doc.splitTextToSize(course.courseTitle, 50);
          const attemptsText = course.allAttempts
            ?.map((attempt: any) =>
              attempt.attemptNumber === 1
                ? "First Take"
                : `Retake ${attempt.attemptNumber - 1}`
            )
            .join("\n");
          const gradesText = course.allAttempts
            ?.map((attempt: any) => attempt.grade || "-")
            .join("\n");

          doc.text(course.courseCode, 20, yPos);
          doc.text(titleLines, 50, yPos);
          doc.text(attemptsText || "-", 120, yPos);
          doc.text(gradesText || "-", 150, yPos);

          const maxLines = Math.max(
            titleLines.length,
            course.allAttempts?.length || 1
          );
          yPos += maxLines * 4;
        });
      } else {
        doc.setFontSize(6);
        doc.text("No retaken courses found.", 20, yPos);
        yPos += 5;
      }

      doc.save(`${studentData.fullName}_Checklist_of_Courses.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button
      ref={buttonRef}
      className="bg-blue-700 hover:bg-blue-500 w-full sm:w-auto text-sm px-4 py-2 rounded-lg"
      onClick={generateChecklistPDF}
      disabled={generating || !studentData || !checklistData.length}
    >
      <DownloadIcon className="h-4 w-4 mr-2" />
      {generating ? "Generating..." : "Download Checklist"}
    </Button>
  );
};

export default GenerateChecklistPDF;
