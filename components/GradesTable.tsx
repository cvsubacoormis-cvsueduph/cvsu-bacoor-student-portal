"use client";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import GenerateCOG from "@/components/GenerateCOG";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";

interface Grade {
  id: string;
  courseCode: string;
  creditUnit: number;
  courseTitle: string;
  grade: string;
  reExam: string | null;
  remarks: string;
  instructor: string;
  academicYear: string;
  semester: string;
}

interface GradesProps {
  grades: Grade[];
  availableYears: string[];
  availableSemesters: string[];
  year: string;
  semester: string;
  handleFilterSubmit: (e: React.FormEvent) => void;
}

export default function Grades({
  grades,
  availableYears,
  availableSemesters,
  year,
  semester,
  handleFilterSubmit,
}: GradesProps) {
  const getFinalGradeToUse = (grade: Grade): number | null => {
    const originalGrade = parseFloat(grade.grade);
    const reExamGrade = grade.reExam !== null ? parseFloat(grade.reExam) : null;

    if (["INC", "DRP"].includes(grade.grade)) {
      if (reExamGrade === null || ["INC", "DRP"].includes(grade.reExam || "")) {
        return null;
      }
      return reExamGrade;
    }

    if (reExamGrade === null) return originalGrade;

    return reExamGrade < originalGrade ? reExamGrade : originalGrade;
  };

  const effectiveYear =
    year && year !== "all"
      ? year
      : availableYears.length > 0
        ? availableYears[0]
        : "";
  const effectiveSemester =
    semester && semester !== "all" ? semester : "FIRST";

  const [selectedYear, setSelectedYear] = useState(effectiveYear);
  const [selectedSemester, setSelectedSemester] = useState(effectiveSemester);

  useEffect(() => {
    setSelectedYear(effectiveYear);
    setSelectedSemester(effectiveSemester);
  }, [effectiveYear, effectiveSemester]);

  const filteredGrades = grades.filter((g) => {
    return (
      g.academicYear === effectiveYear &&
      g.semester === effectiveSemester
    );
  });

  const totalSubjectsEnrolled = filteredGrades.length;

  // Total units enrolled - includes ALL courses (even with S, P, etc.)
  const totalUnitsEnrolled = filteredGrades.reduce((acc, cur) => {
    return acc + cur.creditUnit;
  }, 0);

  // For GPA calculation - only courses with numeric grades
  const totalCreditsEnrolled = filteredGrades.reduce((acc, cur) => {
    // 1. Strict Exclusion Rule: INC, DRP, 4.00, 5.00 are ALWAYS 0 units.
    const gradeStr = String(cur.grade);
    if (["DRP", "INC", "FAILED", "4.00", "5.00"].includes(gradeStr)) return acc;

    // 2. CVSU 101 Rule: Included in total ONLY if grade is "S".
    if (cur.courseCode === "CVSU 101") {
      return cur.grade === "S" ? acc + cur.creditUnit : acc;
    }

    const finalGrade = getFinalGradeToUse(cur);
    if (finalGrade !== null && !isNaN(finalGrade)) return acc + cur.creditUnit;
    return acc;
  }, 0);

  // Separate calculation for GPA Denominator (only items that contribute to GPA)
  const totalGPAUnits = filteredGrades.reduce((acc, cur) => {
    const gradeStr = String(cur.grade);
    if (["DRP", "INC", "FAILED", "4.00", "5.00"].includes(gradeStr)) return acc;

    // Include CVSU 101 "S" in the GPA denominator
    if (cur.courseCode === "CVSU 101" && cur.grade === "S") {
      return acc + cur.creditUnit;
    }

    const finalGrade = getFinalGradeToUse(cur);
    if (finalGrade === null || isNaN(finalGrade)) return acc;

    return acc + cur.creditUnit;
  }, 0);

  const totalCreditsEarned = filteredGrades.reduce((acc, cur) => {
    // Earned points for GPA Numerator
    const gradeStr = String(cur.grade);
    if (["DRP", "INC", "FAILED", "4.00", "5.00"].includes(gradeStr)) return acc;
    if (cur.courseCode === "CVSU 101") return acc; // "S" has no numeric value for multiplication

    const finalGrade = getFinalGradeToUse(cur);
    if (finalGrade === null || isNaN(finalGrade)) return acc;
    return acc + cur.creditUnit * finalGrade;
  }, 0);

  const gpa =
    totalGPAUnits > 0 && !isNaN(totalCreditsEarned)
      ? (totalCreditsEarned / totalGPAUnits).toFixed(2)
      : "N/A";

  return (
    <div className="p-4 w-full">
      <Card className="w-full border-none shadow-none">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-semibold text-primary">
                Student Grades
              </CardTitle>
              <CardDescription className="text-xs">
                View and manage your academic performance
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <GenerateCOG />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6 bg-blue-50 border-blue-200">
            <TriangleAlert className="h-4 w-4" color="blue" />
            <AlertTitle className="text-blue-800">Notice</AlertTitle>
            <AlertDescription className="text-blue-700">
              <p>
                Due to some data inconsistencies encountered during the grade
                upload process, some grades may not have been fully uploaded or
                reflected correctly.
              </p>
              <p className="mt-2">
                Please rest assured that these can still be updated and corrected.
                If you believe your grade is missing or incorrect, kindly contact
                the MIS Coordinator or email us at{" "}
                <a
                  href="mailto:cvsubacoor.mis@cvsu.edu.ph"
                  className="font-medium text-blue-700 underline break-all sm:break-normal"
                >
                  cvsubacoor.mis@cvsu.edu.ph
                </a>{" "}
                for assistance.
              </p>
              <p className="mt-2">Thank you for your understanding.</p>
            </AlertDescription>
          </Alert>
          <Alert variant="destructive" className="mb-6">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              Any attempt to modify or tamper with the grades displayed on this
              portal is strictly prohibited. Unauthorized changes may result in
              severe disciplinary actions or other consequences.
            </AlertDescription>
          </Alert>
          <form
            onSubmit={handleFilterSubmit}
            className="mb-6 bg-muted/30 p-4 rounded-lg border flex flex-col sm:flex-row gap-4 items-end sm:items-center"
          >
            <div className="grid gap-2 w-full sm:w-auto">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Academic Year
              </label>
              <Select
                name="year"
                value={selectedYear}
                onValueChange={setSelectedYear}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {/* <SelectItem value="all">All Years</SelectItem> */}
                  {availableYears.map((yr) => (
                    <SelectItem key={yr} value={yr}>
                      {yr.replace("_", "-")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 w-full sm:w-auto">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Semester
              </label>
              <Select
                name="semester"
                value={selectedSemester}
                onValueChange={setSelectedSemester}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Select Semester" />
                </SelectTrigger>
                <SelectContent>
                  {/* <SelectItem value="all">All Semesters</SelectItem> */}
                  {availableSemesters.map((sem) => (
                    <SelectItem key={sem} value={sem}>
                      {sem === "FIRST"
                        ? "First Semester"
                        : sem === "SECOND"
                          ? "Second Semester"
                          : "Midyear"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full sm:w-auto mt-auto bg-blue-700 hover:bg-blue-600">
              Apply Filters
            </Button>
          </form>

          {/* Grades Table */}
          {filteredGrades.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">No grades found</p>
              <p className="text-sm">
                Try adjusting the filters or check back later.
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold">Course Code</TableHead>
                    <TableHead className="font-bold">Title</TableHead>
                    <TableHead className="text-center font-bold">
                      Units
                    </TableHead>
                    <TableHead className="text-center font-bold">
                      Grade
                    </TableHead>
                    <TableHead className="text-center font-bold">
                      Re-Exam
                    </TableHead>
                    <TableHead className="text-center font-bold">
                      Remarks
                    </TableHead>
                    <TableHead className="font-bold">Instructor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGrades.map((grade) => {
                    const displayGrade = !isNaN(parseFloat(grade.grade))
                      ? parseFloat(grade.grade).toFixed(2)
                      : grade.grade;

                    const isFailing = [
                      "INC",
                      "DRP",
                      "FAILED",
                      "4.00",
                      "5.00",
                    ].includes(grade.grade);

                    return (
                      <TableRow key={grade.id} className="hover:bg-muted/5">
                        <TableCell className="font-medium">
                          {grade.courseCode}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-semibold" title={grade.courseTitle}>
                          {grade.courseTitle}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {grade.creditUnit}
                        </TableCell>
                        <TableCell
                          className={`text-center font-bold ${isFailing ? "text-destructive" : "text-primary"
                            }`}
                        >
                          {displayGrade}
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {grade.reExam !== null &&
                            !isNaN(parseFloat(grade.reExam))
                            ? parseFloat(grade.reExam).toFixed(2)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              grade.remarks === "PASSED"
                                ? "default"
                                : "destructive"
                            }
                            className={
                              grade.remarks === "PASSED" ? "bg-green-600 hover:bg-green-700" : ""
                            }
                          >
                            {grade.remarks}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-semibold">
                          {grade.instructor}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter className="bg-muted/50 font-medium">
                  <TableRow>
                    <TableCell colSpan={2}>Totals</TableCell>
                    <TableCell className="text-center">
                      {totalUnitsEnrolled}
                    </TableCell>
                    <TableCell colSpan={4} className="text-right">
                      GPA: <span className="text-lg font-bold">{gpa}</span>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="bg-muted/30 p-4 rounded-lg border text-center">
              <p className="text-sm text-muted-foreground">Subjects Enrolled</p>
              <p className="text-2xl font-bold">{totalSubjectsEnrolled}</p>
            </div>
            <div className="bg-muted/30 p-4 rounded-lg border text-center">
              <p className="text-sm text-muted-foreground">Total Credits Enrolled</p>
              <p className="text-2xl font-bold">{totalUnitsEnrolled}</p>
            </div>
            <div className="bg-muted/30 p-4 rounded-lg border text-center">
              <p className="text-sm text-muted-foreground">Total Credits Earned</p>
              <p className="text-2xl font-bold">{totalCreditsEarned.toFixed(2)}</p>
            </div>
            <div className="bg-muted/30 p-4 rounded-lg border text-center">
              <p className="text-sm text-muted-foreground">GPA</p>
              <p className="text-2xl font-bold text-primary">{gpa}</p>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
