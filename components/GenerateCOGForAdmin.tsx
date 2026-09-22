"use client";

import React, { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { getStudentGradesWithReExam } from "@/actions/student-grades/student-grades";
import { generateCOGAdminWithRateLimit } from "@/actions/document-generation";
import { generateCOGPdf, type CogGrade } from "@/lib/cog-pdf";
import toast from "react-hot-toast";
import { PrinterIcon, AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { semesterMap } from "@/lib/utils";

const yearLevels = ["FIRST YEAR", "SECOND YEAR", "THIRD YEAR", "FOURTH YEAR"];
const purposes = ["Enrollment/Evaluation Purposes Only", "Personal Copy"];

/**
 * Derives the selectable academic terms from a student's grade history,
 * preserving first-seen order and de-duplicating on (academicYear, semester).
 */
function buildAcademicOptions(grades: Grade[]): AcademicOption[] {
  const options = new Map<string, AcademicOption>();
  for (const g of grades) {
    const key = `${g.academicYear}-${g.semester}`;
    if (!options.has(key)) {
      options.set(key, {
        academicYear: g.academicYear,
        semester: g.semester,
      });
    }
  }
  return Array.from(options.values());
}

type AcademicOption = {
  academicYear: string;
  semester: string;
};

/**
 * Local alias for the shared grade shape. Kept as an alias (rather than a
 * second structural definition) so the component and the PDF builder cannot
 * drift apart.
 */
type Grade = CogGrade;

type StudentData = {
  studentNumber: string;
  firstName: string;
  middleInit?: string | null;
  lastName: string;
  course: string;
  major: string | null;
  grades: Grade[];
};

interface GenerateCOGAdminProps {
  studentId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function GenerateCOGAdmin({
  studentId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: GenerateCOGAdminProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isDialogOpen = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (open: boolean) => {
    if (isControlled && controlledOnOpenChange) {
      controlledOnOpenChange(open);
    } else {
      setInternalOpen(open);
    }
  };
  const [academicOptions, setAcademicOptions] = useState<AcademicOption[]>([]);
  const [academicYear, setAcademicYear] = useState<string>();
  const [semester, setSemester] = useState<string>();
  const [yearLevel, setYearLevel] = useState("FIRST YEAR");
  const [isLoading, setIsLoading] = useState(false);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [purpose, setPurpose] = useState("");
  const [includeStamp, setIncludeStamp] = useState(false);

  useEffect(() => {
    // Refetch whenever a *different* student is targeted. Keying only on
    // `!studentData` meant a stale grade set (and therefore stale academic-term
    // options) survived a change of studentId, which is how a COG could be
    // generated against the previous student's terms.
    if (!isDialogOpen) return;

    let cancelled = false;

    const fetchData = async () => {
      setStudentData(null);
      setAcademicOptions([]);
      try {
        const result = await getStudentGradesWithReExam(studentId);
        if (cancelled) return;
        if (!result.student) {
          throw new Error(result.error || "Student data not found");
        }
        const data = result.student as StudentData;
        const formattedData = {
          ...data,
          grades: data.grades.map((grade) => ({
            ...grade,
            remarks: grade.remarks || "",
          })),
          major: data.major || "",
          middleInit: data.middleInit || "",
        };
        setStudentData(formattedData);
        setAcademicOptions(buildAcademicOptions(formattedData.grades));
      } catch (error) {
        if (cancelled) return;
        toast.error("Failed to load student data.");
      }
    };
    fetchData();

    return () => {
      cancelled = true;
    };
  }, [isDialogOpen, studentId]);

  const handleGenerate = async () => {
    if (!academicYear || !semester || !purpose.trim()) {
      toast.error("Please fill in all fields before generating.");
      return;
    }

    setIsLoading(true);
    try {
      // Use the rate-limited action for admin COG generation
      const { student } = await generateCOGAdminWithRateLimit(
        studentId,
        academicYear,
        semester,
      );

      await generateCOGPdf({
        student: {
          studentNumber: student.studentNumber,
          firstName: student.firstName,
          middleInit: student.middleInit,
          lastName: student.lastName,
          course: student.course,
          major: student.major,
          grades: student.grades as CogGrade[],
        },
        grades: student.grades as CogGrade[],
        academicYear,
        semester,
        yearLevel,
        purpose,
        includeStamp,
        variant: "admin",
      });
      handleOpenChange(false);
    } catch (error) {
      console.error("PDF Generate Error:", error);
      const err = error as { message: string; code?: string };
      if (
        err?.message === "Too many requests. Please try again in a minute." ||
        err?.code === "RATE_LIMIT_EXCEEDED"
      ) {
        toast.error(
          "You have reached the limit for generating this document. Please wait a minute and try again.",
        );
      } else {
        toast.error(
          err?.message ||
            "Something went wrong while generating your COG. Please try again.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        handleOpenChange(open);
        if (!open) {
          // Clear every piece of per-student state so reopening for another
          // student cannot reuse the previous student's term selection.
          setStudentData(null);
          setAcademicOptions([]);
          setAcademicYear(undefined);
          setSemester(undefined);
          setPurpose("");
          setYearLevel("FIRST YEAR");
          setIncludeStamp(false);
        }
      }}
    >
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" className="border-none rounded-full">
            <PrinterIcon />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter Academic Info</DialogTitle>
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
                  ),
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
                {[
                  ...new Set(
                    academicOptions
                      .filter(
                        (o) => !academicYear || o.academicYear === academicYear,
                      )
                      .map((o) => o.semester),
                  ),
                ].map((sem) => (
                  <SelectItem key={sem} value={sem}>
                    {sem === "FIRST"
                      ? "First Semester"
                      : sem === "SECOND"
                        ? "Second Semester"
                        : sem === "MIDYEAR"
                          ? "Midyear"
                          : sem}
                  </SelectItem>
                ))}
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
                    Year level is for year standing only. Your grades and
                    academic progress are based on the academic year and
                    semester.
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          </div>
          <div>
            <label className="text-sm">Purpose</label>
            <Input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Type your purpose here (e.g., Board Exam, Scholarship)"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-stamp"
              checked={includeStamp}
              onCheckedChange={(checked) => setIncludeStamp(checked === true)}
            />
            <label
              htmlFor="include-stamp"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Include official stamp on PDF
            </label>
          </div>
          <Alert className="border-blue-500 text-blue-700 bg-blue-50">
            <AlertCircleIcon className="h-4 w-4 !text-blue-700" />
            <AlertTitle>Document Security</AlertTitle>
            <AlertDescription>
              <p>
                The generated PDF will be encrypted and tamper-protected.
                Recipients can print but cannot modify grades, add annotations,
                or copy content. A tamper-evident integrity hash is embedded.
              </p>
            </AlertDescription>
          </Alert>
          <Button
            onClick={handleGenerate}
            className="bg-blue-700 hover:bg-blue-900"
            disabled={
              isLoading || !academicYear || !semester || !purpose.trim()
            }
          >
            {isLoading ? "Generating..." : "Generate PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
