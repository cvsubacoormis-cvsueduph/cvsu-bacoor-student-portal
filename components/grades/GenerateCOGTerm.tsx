"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircleIcon, Loader2, PrinterIcon } from "lucide-react";
import toast from "react-hot-toast";
import { generateCOGAdminWithRateLimit } from "@/actions/document-generation";
import { generateCOGPdf, type CogGrade } from "@/lib/cog-pdf";
import { COG_GENERATION_ROLES } from "@/lib/cog-roles";
import { formatAcademicYear } from "@/lib/grade-utils";
import { semesterMap } from "@/lib/utils";

const YEAR_LEVELS = ["FIRST YEAR", "SECOND YEAR", "THIRD YEAR", "FOURTH YEAR"];

interface GenerateCOGTermProps {
  /** Student the COG is for. */
  studentId: string;
  /**
   * The term currently selected in the View Grades screen. Narrowing the COG to
   * the visible term is the whole point of this control — the dialog never
   * offers a different term, so what you see is what gets printed.
   */
  academicYear: string;
  semester: string;
  /** Defaults to the academic year derived from the term. */
  yearLevel?: string;
}

/**
 * "Generate COG" control for the View Grades screen.
 *
 * Unlike the list-row generator, this is scoped to the academic year and
 * semester already selected on the page, so no term picker is shown. Only the
 * document's *presentation* fields (year level, purpose, stamp) are collected.
 */
export function GenerateCOGTerm({
  studentId,
  academicYear,
  semester,
  yearLevel: initialYearLevel = "FIRST YEAR",
}: GenerateCOGTermProps) {
  const { user, isLoaded } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;

  const [open, setOpen] = useState(false);
  const [yearLevel, setYearLevel] = useState(initialYearLevel);
  const [purpose, setPurpose] = useState("");
  const [includeStamp, setIncludeStamp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Reset per-open state so a second generation never reuses the first
  // document's purpose or stamp choice.
  useEffect(() => {
    if (open) return;
    setPurpose("");
    setIncludeStamp(false);
    setYearLevel(initialYearLevel);
  }, [open, initialYearLevel]);

  const handleGenerate = async () => {
    if (!academicYear || !semester) {
      toast.error("Please select an academic year and semester first.");
      return;
    }
    if (!purpose.trim()) {
      toast.error("Please enter a purpose before generating.");
      return;
    }

    setIsLoading(true);
    try {
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

      setOpen(false);
    } catch (error) {
      console.error("PDF Generate Error:", error);
      const err = error as { message?: string; code?: string };
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
            "Something went wrong while generating the COG. Please try again.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Only admin/registrar may generate; the server action re-checks this.
  const canGenerate =
    isLoaded && !!role && COG_GENERATION_ROLES.includes(role as never);

  // No usable term selected yet — nothing meaningful to print.
  if (!canGenerate || !academicYear || !semester) {
    return null;
  }

  const termLabel = `${formatAcademicYear(academicYear)} — ${
    semesterMap(semester) || semester
  }`;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="bg-blue-700 hover:bg-blue-600"
      >
        <PrinterIcon className="w-4 h-4 mr-2" />
        Generate COG
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PrinterIcon className="h-5 w-5" />
              Generate Certificate of Grades
            </DialogTitle>
            <DialogDescription>
              The document will contain only the grades for{" "}
              <span className="font-medium text-foreground">{termLabel}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="cog-year-level" className="text-sm">
                Year Level
              </Label>
              <select
                id="cog-year-level"
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {YEAR_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              <div className="mt-2">
                <Alert className="border-orange-500 text-orange-700 bg-orange-50">
                  <AlertCircleIcon className="h-4 w-4 !text-orange-700" />
                  <AlertTitle>Note on Year Level</AlertTitle>
                  <AlertDescription>
                    <p>
                      Year level is for year standing only. Grades and academic
                      progress are based on the academic year and semester.
                    </p>
                  </AlertDescription>
                </Alert>
              </div>
            </div>

            <div>
              <Label htmlFor="cog-purpose" className="text-sm">
                Purpose
              </Label>
              <Input
                id="cog-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Type the purpose (e.g., Board Exam, Scholarship)"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="cog-include-stamp"
                checked={includeStamp}
                onCheckedChange={(checked) => setIncludeStamp(checked === true)}
              />
              <label
                htmlFor="cog-include-stamp"
                className="text-sm font-medium leading-none cursor-pointer"
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
                  Recipients can print but cannot modify grades, add
                  annotations, or copy content. A tamper-evident integrity hash
                  is embedded.
                </p>
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={isLoading || !purpose.trim()}
                className="bg-blue-700 hover:bg-blue-900"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate PDF"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
