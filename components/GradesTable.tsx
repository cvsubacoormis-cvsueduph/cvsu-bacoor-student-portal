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
  // --- helpers ---
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

  const filteredGrades = grades.filter((g) => {
    return (
      (!year || g.academicYear === year) &&
      (!semester || g.semester === semester)
    );
  });

  // Totals
  const totalSubjectsEnrolled = filteredGrades.length;
  const totalCreditsEnrolled = filteredGrades.reduce((acc, cur) => {
    const finalGrade = getFinalGradeToUse(cur);
    if (finalGrade === null || isNaN(finalGrade)) return acc;
    return acc + cur.creditUnit;
  }, 0);
  const totalCreditsEarned = filteredGrades.reduce((acc, cur) => {
    const finalGrade = getFinalGradeToUse(cur);
    if (finalGrade === null || isNaN(finalGrade)) return acc;
    return acc + cur.creditUnit * finalGrade;
  }, 0);
  const gpa =
    totalCreditsEnrolled > 0 && !isNaN(totalCreditsEarned)
      ? (totalCreditsEarned / totalCreditsEnrolled).toFixed(2)
      : "N/A";

  return (
    <div className="p-4 w-full">
      <Card className="w-full shadow-md">
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
          {/* Filters */}
          <form
            onSubmit={handleFilterSubmit}
            className="mb-6 bg-muted/30 p-4 rounded-lg border flex flex-col sm:flex-row gap-4 items-end sm:items-center"
          >
            <div className="grid gap-2 w-full sm:w-auto">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Academic Year
              </label>
              <Select name="year" defaultValue={year}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
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
              <Select name="semester" defaultValue={semester}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Select Semester" />
                </SelectTrigger>
                <SelectContent>
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

            <Button type="submit" className="w-full sm:w-auto mt-auto bg-blue-700 hover:bg-blue-900">
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
                    const displayGrade = ["INC", "DRP"].includes(grade.grade)
                      ? grade.grade
                      : !isNaN(parseFloat(grade.grade))
                        ? parseFloat(grade.grade).toFixed(2)
                        : "";

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
                        <TableCell className="max-w-[200px] truncate" title={grade.courseTitle}>
                          {grade.courseTitle}
                        </TableCell>
                        <TableCell className="text-center">
                          {grade.creditUnit}
                        </TableCell>
                        <TableCell
                          className={`text-center font-bold ${isFailing ? "text-destructive" : "text-primary"
                            }`}
                        >
                          {displayGrade}
                        </TableCell>
                        <TableCell className="text-center">
                          {grade.reExam !== null &&
                            !isNaN(parseFloat(grade.reExam))
                            ? parseFloat(grade.reExam).toFixed(2)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              grade.remarks === "PASSED"
                                ? "default" // or "success" if you have it, usually default is black/primary
                                : "destructive"
                            }
                            className={
                              grade.remarks === "PASSED" ? "bg-green-600 hover:bg-green-700" : ""
                            }
                          >
                            {grade.remarks}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
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
                      {totalCreditsEnrolled}
                    </TableCell>
                    <TableCell colSpan={4} className="text-right">
                      GPA: <span className="text-lg font-bold">{gpa}</span>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}

          {/* Summary Cards for Mobile/Desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-muted/30 p-4 rounded-lg border text-center">
              <p className="text-sm text-muted-foreground">Subjects Enrolled</p>
              <p className="text-2xl font-bold">{totalSubjectsEnrolled}</p>
            </div>
            <div className="bg-muted/30 p-4 rounded-lg border text-center">
              <p className="text-sm text-muted-foreground">Credits Earned</p>
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
