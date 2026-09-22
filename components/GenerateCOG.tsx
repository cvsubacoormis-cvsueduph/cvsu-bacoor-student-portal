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
import { getAvailableAcademicOptions } from "@/actions/student-grades/student-grades";
import { generateCOGWithRateLimit } from "@/actions/document-generation";
import { generateCOGPdf, type CogGrade } from "@/lib/cog-pdf";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import {
  AlertCircleIcon,
  Bold,
  CheckCircle2Icon,
  PopcornIcon,
} from "lucide-react";
import { semesterMap } from "@/lib/utils";
import { toast } from "sonner";

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
        options as { academicYear: string; semester: string }[],
      );
    };
    fetchOptions();
  }, []);

  const handleGenerate = async () => {
    if (!academicYear || !semester) {
      toast.error("Please select both academic year and semester.");
      return;
    }

    setIsLoading(true);
    setStudentData(null);
    
    try {
      // Use the rate-limited action for COG generation
      const result = await generateCOGWithRateLimit(academicYear, semester);
      
      if (!result || !result.student) {
        throw new Error("No data returned from server");
      }
      
      const { student } = result;
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
      await generateCOGPdf({
        student: {
          studentNumber: data.studentNumber,
          firstName: data.firstName,
          middleInit: data.middleInit,
          lastName: data.lastName,
          course: data.course,
          major: data.major,
          grades: data.grades as CogGrade[],
        },
        grades: data.grades as CogGrade[],
        academicYear: academicYear || "",
        semester: semester || "",
        yearLevel,
        purpose,
        // Students never receive the official stamp.
        includeStamp: false,
        variant: "student",
      });
      setIsDialogOpen(false);
} catch (error) {
      console.error("========== COG Generation Error ==========");
      console.error("Full error object:", error);
      console.error("Error type:", typeof error);
      console.error("Is Error:", error instanceof Error);
      
      let errMsg = "Unknown error";
      let errCode: string | undefined;
      let errDigest: string | undefined;
      
      if (error instanceof Error) {
        errMsg = error.message;
        errCode = (error as any).code;
        errDigest = (error as any).digest;
        console.error("Error message:", errMsg);
        console.error("Error code:", errCode);
        console.error("Error digest:", errDigest);
        console.error("Error stack:", error.stack);
      } else if (error && typeof error === "object") {
        // Handle cases where error might be a plain object
        errMsg = (error as any).message || JSON.stringify(error);
        errCode = (error as any).code;
        errDigest = (error as any).digest;
        console.error("Error object:", error);
      }
      
      const err = { message: errMsg, code: errCode, digest: errDigest };
      
      // Map technical errors to user-friendly messages
      const getUserFriendlyMessage = (errorMsg: string): string => {
        const lowerMsg = errorMsg.toLowerCase();
        
        console.log("Processing error message:", lowerMsg);
        
        // Rate limit
        if (lowerMsg.includes("rate limit") || lowerMsg.includes("too many request")) {
          return "You've reached the maximum number of documents you can generate. Please wait a moment and try again.";
        }

        // Grades hidden by faculty (upload in progress)
        if (lowerMsg.includes("grades_hidden")) {
          return "Your grades are currently being processed by the faculty. Please check back shortly.";
        }
        
        // No grades for selected term
        if (lowerMsg.includes("no grades found") || lowerMsg.includes("no grades") || lowerMsg.includes("no grades found for this academic term")) {
          return "No grades found for the selected academic year and semester. Please select a different term or contact the registrar.";
        }
        
        // Student not found / Unauthorized
        if (lowerMsg.includes("unauthorized") || lowerMsg.includes("forbidden")) {
          return "Unable to access your grades. Please make sure you're logged in correctly and try again.";
        }
        
        // Student not found
        if (lowerMsg.includes("student not found")) {
          return "Your student record was not found. Please contact the registrar to verify your enrollment.";
        }
        
        // Database / server errors
        if (lowerMsg.includes("database") || lowerMsg.includes("prisma") || lowerMsg.includes("server error") || lowerMsg.includes("connection")) {
          return "We're having trouble loading your grades. Please try again in a few minutes.";
        }
        
        // Redis / connection errors
        if (lowerMsg.includes("redis")) {
          return "Unable to generate document right now. Please try again.";
        }
        
        // Default - return original for debugging
        return errorMsg;
      };
      
      // Check if we have a mapped message or return default
      let displayMessage = getUserFriendlyMessage(err.message);
      
      // If the message returned is the same as input (no mapping), use default with hint
      if (displayMessage === err.message && !err.message.includes("rate limit") && !err.message.includes("no grades")) {
        console.log("Unmapped error - using default. Original:", err.message);
        displayMessage = "Unable to generate your document right now. Please try again or select a different academic term.";
      }
      
      toast.error(displayMessage);
    } finally {
      setIsLoading(false);
    }
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
                      {year.replace("_", "-")}
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
                  ),
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
          <Alert className="border-blue-500 text-blue-700 bg-blue-50">
            <CheckCircle2Icon className="h-4 w-4 !text-blue-700" />
            <AlertTitle>Document Security</AlertTitle>
            <AlertDescription>
              <p>
                The generated PDF will be encrypted and tamper-protected.
                Modifications are disabled — grades cannot be altered.
                Printing is permitted.
              </p>
            </AlertDescription>
          </Alert>
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
