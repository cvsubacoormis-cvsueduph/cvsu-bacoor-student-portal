"use client";

import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAvailableAcademicOptions,
  getStudentGradesWithReExam,
} from "@/actions/student-grades/student-grades";
import {
  courseClerkshipMap,
  courseMap,
  coursePositionMap,
  formatMajor,
} from "@/lib/courses";
import toast from "react-hot-toast";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { AlertCircleIcon, CheckCircle2Icon, PopcornIcon } from "lucide-react";

const yearLevels = ["FIRST YEAR", "SECOND YEAR", "THIRD YEAR", "FOURTH YEAR"];
const purposes = [
  "Enrollment/Evaluation Purposes Only",
  // "Work Purposes",
  // "Scholarship",
  "Personal Copy",
];

type AcademicOption = {
  academicYear: string;
  semester: string;
};

type Grade = {
  courseCode: string;
  courseTitle: string;
  creditUnit: number;
  grade: string;
  reExam: string | null;
  remarks: string;
  instructor: string;
  academicYear: string;
  semester: string;
};

type StudentData = {
  studentNumber: string;
  firstName: string;
  middleInit?: string;
  lastName: string;
  course: string;
  major: string;
  grades: Grade[];
};

export default function GenerateCOG() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [academicOptions, setAcademicOptions] = useState<AcademicOption[]>([]);
  const [academicYear, setAcademicYear] = useState<string>();
  const [semester, setSemester] = useState<string>();
  const [yearLevel, setYearLevel] = useState("FIRST YEAR");
  const [isLoading, setIsLoading] = useState(false);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [purpose, setPurpose] = useState(purposes[0]);

  useEffect(() => {
    const fetchOptions = async () => {
      const options = await getAvailableAcademicOptions();
      setAcademicOptions(
        options as { academicYear: string; semester: string }[]
      );
    };
    fetchOptions();
  }, []);

  const getFinalGradeToUse = (grade: Grade): number | null => {
    if (["INC", "DRP"].includes(grade.grade)) {
      if (
        grade.reExam === null ||
        ["INC", "DRP"].includes(grade.reExam || "")
      ) {
        return null;
      }
      return parseFloat(grade.reExam);
    }

    const originalGrade = !isNaN(parseFloat(grade.grade))
      ? parseFloat(grade.grade)
      : null;
    const reExamGrade =
      grade.reExam && !isNaN(parseFloat(grade.reExam))
        ? parseFloat(grade.reExam)
        : null;

    if (originalGrade === null && reExamGrade === null) {
      return null;
    }
    if (originalGrade === null) {
      return reExamGrade;
    }
    if (reExamGrade === null) {
      return originalGrade;
    }
    return Math.min(originalGrade, reExamGrade);
  };

  const handleGenerate = async () => {
    if (!academicYear || !semester) return;

    setIsLoading(true);
    try {
      const { student } = await getStudentGradesWithReExam();
      const data = student as StudentData;
      setStudentData({
        ...data,
        grades: data.grades.map((grade) => ({
          ...grade,
          remarks: grade.remarks || "",
        })),
        major: data.major || "",
        middleInit: data.middleInit || "",
      });
      const filteredGrades = data.grades.filter(
        (g: { academicYear: string; semester: string }) =>
          g.academicYear === academicYear && g.semester === semester
      );
      generatePDF(data as StudentData, filteredGrades as Grade[]);
      setIsDialogOpen(false);
    } catch (error) {
      // Log the full error for debugging
      console.error("COG Generation Error:", error);

      const err = error as { message: string };

      // Check for rate limit error (corrected message)
      if (
        err.message ===
        "Too many requests. Please try again in a minute."
      ) {
        toast.error(
          "You have reached the limit for generating this document. Please wait a minute and try again."
        );
      } else {
        // Show more detailed error message
        const errorMessage = err.message || "Unknown error occurred";
        toast.error(
          `Something went wrong while generating your COG: ${errorMessage}`
        );
        console.error("Detailed error:", errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDF = (student: StudentData, grades: Grade[]) => {
    const doc = new jsPDF("p", "mm", "a4");

    const logoWidth = 18;
    const logoHeight = 15;
    const logoX = 40;
    const logoY = 5;

    doc.addImage("/printlogo.png", "PNG", logoX, logoY, logoWidth, logoHeight);
    doc.setFontSize(9);
    doc.text("Republic of the Philippines", 105, 11, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("CAVITE STATE UNIVERSITY", 105, 16, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Bacoor City Campus", 105, 20, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("SHIV, Molino VI City of Bacoor", 105, 25, { align: "center" });
    doc.addImage("/phone.png", "PNG", 91, 28, 2, 2);
    doc.text("(046) 476-5029", 105, 30, { align: "center" });
    doc.text("cvsubacoor@cvsu.edu.ph", 105, 35, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text("OFFICE OF THE CAMPUS REGISTRAR", 105, 45, { align: "center" });
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 139);
    doc.text("CERTIFICATE OF GRADES", 105, 50, { align: "center" });
    doc.setTextColor(0, 0, 0);

    const fullName = `${student.firstName}, ${student.middleInit || ""} ${student.lastName
      }`;
    const studentNo = student.studentNumber;
    const course = student.course;
    const major = student.major !== "NONE" ? student.major : "";

    doc.setFontSize(7);
    doc.setTextColor(139, 0, 0);
    doc.text("Fullname:", 20, 60);
    doc.setTextColor(0, 0, 139);
    doc.setFont("helvetica", "italic");
    doc.text(fullName, 35, 60);
    const textWidth = doc.getTextWidth(fullName);
    doc.line(35, 61, 35 + textWidth, 61);
    doc.setTextColor(139, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("Student No.:", 120, 60);
    doc.setTextColor(0, 0, 139);
    doc.setFont("helvetica", "italic");
    doc.text(studentNo, 140, 60);
    const studentNoWidth = doc.getTextWidth(studentNo);
    doc.line(140, 61, 140 + studentNoWidth, 61);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(139, 0, 0);
    doc.text("Year Level:", 20, 65);
    doc.setTextColor(0, 0, 139);
    doc.setFont("helvetica", "italic");
    doc.text(yearLevel, 35, 65);
    doc.setTextColor(139, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("Academic Year:", 120, 65);
    doc.setTextColor(0, 0, 139);
    doc.setFont("helvetica", "italic");
    doc.text(academicYear ? academicYear.replace(/_/g, "-") : "", 140, 65);

    doc.setTextColor(139, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("Degree:", 20, 70);
    doc.setTextColor(0, 0, 139);
    doc.setFont("helvetica", "italic");
    doc.text(courseMap(course).toUpperCase(), 35, 70);

    doc.setTextColor(139, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("Major:", 20, 75);
    doc.text(formatMajor(major) || "", 35, 75);
    doc.setTextColor(139, 0, 0);
    doc.text("Date:", 120, 70);
    doc.setTextColor(0, 0, 139);
    doc.setFont("helvetica", "italic");
    doc.text(
      new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      130,
      70
    );

    autoTable(doc, {
      startY: 85,
      styles: { font: "helvetica", fontSize: 7, cellPadding: 1 },
      headStyles: {
        fillColor: [254, 240, 138],
        textColor: 0,
        halign: "center",
        lineWidth: 0.3,
        lineColor: 0,
      },
      bodyStyles: {
        lineWidth: 0.3,
        lineColor: 0,
        textColor: 0,
      },
      columnStyles: {
        2: { halign: "left", fontStyle: "italic" },
        0: { halign: "center" },
        1: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center" },
        5: { halign: "center" },
        6: { halign: "center" },
      },
      theme: "grid",
      head: [
        [
          "CODE",
          "UNITS",
          "COURSE TITLE",
          "GRADE",
          "RE-EXAM",
          "REMARKS",
          "FACULTY",
        ],
      ],
      body: grades.map((g) => [
        g.courseCode,
        g.creditUnit.toString(),
        g.courseTitle,
        ["DRP", "INC", "4.00", "5.00"].includes(g.grade)
          ? { content: g.grade || "-", styles: { textColor: [255, 0, 0] } }
          : { content: g.grade || "-", styles: { textColor: [0, 0, 0] } },
        g.reExam || "",
        ["FAILED", "CON. FAILURE", "LACK OF REQ", "DROPPED"].includes(g.remarks)
          ? { content: g.remarks || "", styles: { textColor: [255, 0, 0] } }
          : { content: g.remarks || "", styles: { textColor: [0, 0, 0] } },
        g.instructor || "",
      ]),
    });

    const totalSubjectsEnrolled = grades.length;
    const totalCreditsEnrolled = grades.reduce((acc, g) => {
      if (["NSTP 1", "CVSU 101", "NSTP 2"].includes(g.courseCode)) return acc;
      const final = getFinalGradeToUse(g);
      return final !== null ? acc + g.creditUnit : acc;
    }, 0);

    const totalCreditsEarned = grades.reduce((acc, g) => {
      if (["NSTP 1", "CVSU 101", "NSTP 2"].includes(g.courseCode)) return acc;
      const final = getFinalGradeToUse(g);
      return final !== null ? acc + g.creditUnit * final : acc;
    }, 0);

    const gpa =
      totalCreditsEnrolled > 0 && !isNaN(totalCreditsEarned)
        ? (totalCreditsEarned / totalCreditsEnrolled).toFixed(2)
        : "0.00";

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.text(
      `Total Subjects Enrolled: ${totalSubjectsEnrolled}`,
      20,
      (doc as any).lastAutoTable.finalY + 10
    );
    doc.text(
      `Total Credits Enrolled: ${totalCreditsEnrolled}`,
      150,
      (doc as any).lastAutoTable.finalY + 10
    );
    doc.text(
      `Total Credits Earned: ${totalCreditsEarned.toFixed(2)}`,
      20,
      (doc as any).lastAutoTable.finalY + 16
    );
    doc.text(
      `Grade Point Average: ${gpa}`,
      150,
      (doc as any).lastAutoTable.finalY + 16
    );

    doc.setFont("helvetica", "bold");
    doc.text(
      `PURPOSE: ${purpose.toUpperCase()}`,
      20,
      (doc as any).lastAutoTable.finalY + 38
    );

    doc.text(
      courseClerkshipMap(course),
      153,
      (doc as any).lastAutoTable.finalY + 38
    );
    const registrarWidth = doc.getTextWidth(courseClerkshipMap(course));
    doc.line(
      153,
      (doc as any).lastAutoTable.finalY + 39,
      153 + registrarWidth,
      (doc as any).lastAutoTable.finalY + 39
    );
    doc.text(
      coursePositionMap(course),
      158,
      (doc as any).lastAutoTable.finalY + 42
    );

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 55,
      styles: {
        font: "helvetica",
        fontSize: 7,
        halign: "center",
        lineWidth: 0.1,
        lineColor: 0,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: 0,
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: 0,
        lineWidth: 0.1,
        lineColor: 0,
      },
      theme: "striped",
      tableLineWidth: 0.1,
      tableLineColor: 0,
      body: [
        ["Grading System", "", "", "", "", ""],
        [
          "1.00",
          "Marked Excellent",
          "96.7 - 100",
          "2.75",
          "Fair",
          "73.4 - 76.6",
        ],
        ["1.25", "Excellent", "93.4 - 96.6", "3.00", "Passed", "70.0 - 73.3"],
        [
          "1.50",
          "Very Superior",
          "90.1 - 93.3",
          "4.00",
          "Conditional Failure",
          "50.0 - 69.9",
        ],
        ["1.75", "Superior", "86.7 - 90.0", "5.00", "Failed", "below 50"],
        ["2.00", "Very Good", "83.4 - 86.6", "INC", "Incomplete", ""],
        ["2.25", "Good", "80.1 - 83.3", "DRP", "Dropped Subject", ""],
        ["2.50", "Satisfactory", "76.7 - 80.0", "", "", ""],
      ],
    });

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(
      "Note: Not Valid without school dry seal.",
      20,
      (doc as any).lastAutoTable.finalY + 8
    );

    // === FOOTER ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("ELECTRONIC COPY", 20, (doc as any).lastAutoTable.finalY + 15);

    doc.save("Certificate-of-Grades.pdf");
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-700 hover:bg-blue-600">Generate COG</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Academic Info</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm">Academic Year</label>
            <Select onValueChange={setAcademicYear}>
              <SelectTrigger>
                <SelectValue placeholder="Select Academic Year" />
              </SelectTrigger>
              <SelectContent>
                {[...new Set(academicOptions.map((o) => o.academicYear))].map(
                  (year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm">Semester</label>
            <Select onValueChange={setSemester}>
              <SelectTrigger>
                <SelectValue placeholder="Select Semester" />
              </SelectTrigger>
              <SelectContent>
                {[...new Set(academicOptions.map((o) => o.semester))].map(
                  (sem) => (
                    <SelectItem key={sem} value={sem}>
                      {sem === "FIRST"
                        ? "First Semester"
                        : sem === "SECOND"
                          ? "Second Semester"
                          : sem === "MIDYEAR"
                            ? "Midyear"
                            : sem}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm">Year Level</label>
            <Select onValueChange={setYearLevel} defaultValue={yearLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Select Year Level" />
              </SelectTrigger>
              <SelectContent>
                {yearLevels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid w-full max-w-xl items-start gap-4 mt-2">
              <Alert className="border-orange-500 text-orange-700 bg-orange-50">
                <AlertCircleIcon className="h-4 w-4 !text-orange-700" />
                <AlertTitle>Note on Year Level</AlertTitle>
                <AlertDescription>
                  <p>
                    Year level is for year standing only. Your grades and academic progress are based on the academic year and semester.
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          </div>
          <div>
            <label className="text-sm">Purpose</label>
            <Select onValueChange={setPurpose} defaultValue={purposes[0]}>
              <SelectTrigger>
                <SelectValue placeholder="Select Purpose" />
              </SelectTrigger>
              <SelectContent>
                {purposes.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleGenerate}
            className="bg-blue-700 hover:bg-blue-900"
            disabled={isLoading || !academicYear || !semester}
          >
            {isLoading ? "Generating..." : "Generate PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
