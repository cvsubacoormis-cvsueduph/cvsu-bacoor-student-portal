"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, ArrowRight, Loader2, MoveRight } from "lucide-react";
import { reassignFacultyGrades } from "@/actions/faculty-monitoring";
import type { AcademicYear, Semester } from "@prisma/client";
import { toast } from "sonner";

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Every AcademicYear enum value (AY_2014_2015 … AY_2039_2040) so uploads can
 * be moved to any term the database supports.
 */
function generateReassignYears(): AcademicYear[] {
  const years: string[] = [];
  for (let y = 2014; y <= 2039; y++) {
    years.push("AY_" + y + "_" + (y + 1));
  }
  return years as AcademicYear[];
}

function formatAcademicYear(ay: string): string {
  return ay.replace("AY_", "AY ").replace("_", "-");
}

function formatSemester(sem: string): string {
  switch (sem) {
    case "FIRST":
      return "First Semester";
    case "SECOND":
      return "Second Semester";
    case "MIDYEAR":
      return "Midyear";
    default:
      return sem;
  }
}

// ── Props ───────────────────────────────────────────────────────────────────

interface FacultyReassignDialogProps {
  facultyId: string;
  facultyName: string;
  /** Term the uploaded grades currently live in. */
  fromAcademicYear: AcademicYear;
  fromSemester: Semester;
  /** Number of Grade records attributed to this faculty in the source term. */
  gradeCount: number;
  disabled?: boolean;
  /** Called after a successful reassignment (e.g. to refresh the page). */
  onComplete?: () => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export function FacultyReassignDialog({
  facultyId,
  facultyName,
  fromAcademicYear,
  fromSemester,
  gradeCount,
  disabled = false,
  onComplete,
}: FacultyReassignDialogProps) {
  const [open, setOpen] = useState(false);
  const [toAcademicYear, setToAcademicYear] = useState<string>("");
  const [toSemester, setToSemester] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const years = useMemo(generateReassignYears, []);

  const isSameTerm =
    toAcademicYear === fromAcademicYear && toSemester === fromSemester;
  const canSubmit =
    toAcademicYear !== "" && toSemester !== "" && !isSameTerm && !isSubmitting;

  const reset = useCallback(function () {
    setToAcademicYear("");
    setToSemester("");
  }, []);

  const handleOpenChange = useCallback(
    function (nextOpen: boolean) {
      setOpen(nextOpen);
      if (!nextOpen) reset();
    },
    [reset],
  );

  const handleSubmit = useCallback(
    async function () {
      if (!canSubmit) return;

      setIsSubmitting(true);
      try {
        const result = await reassignFacultyGrades({
          facultyId,
          fromAcademicYear,
          fromSemester,
          toAcademicYear: toAcademicYear as AcademicYear,
          toSemester: toSemester as Semester,
        });

        const targetLabel =
          formatAcademicYear(toAcademicYear) +
          " — " +
          formatSemester(toSemester);

        if (result.movedCount > 0) {
          toast.success(
            `Reassigned ${result.movedCount} grade record${result.movedCount !== 1 ? "s" : ""} to ${targetLabel}.`,
          );
        } else {
          toast.info(`No grade records were moved to ${targetLabel}.`);
        }

        if (result.skippedCount > 0) {
          toast.warning(
            `${result.skippedCount} record${result.skippedCount !== 1 ? "s" : ""} skipped because a grade for the same student & course already exists in the target term.`,
          );
        }

        onComplete?.();
        setOpen(false);
        reset();
      } catch (err) {
        console.error("Reassign failed", err);
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to reassign grades. Please try again.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      canSubmit,
      facultyId,
      fromAcademicYear,
      fromSemester,
      toAcademicYear,
      toSemester,
      onComplete,
      reset,
    ],
  );

  const nothingToMove = gradeCount === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || nothingToMove}
          className="flex items-center gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
          title={
            nothingToMove
              ? "This faculty has no uploaded grades in the selected term."
              : "Move this faculty's uploaded grades to a different academic term"
          }
        >
          <MoveRight className="h-3.5 w-3.5" />
          Reassign Term
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MoveRight className="h-5 w-5 text-blue-600" />
            Reassign Uploaded Grades
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              Move{" "}
              <strong className="text-gray-800">{gradeCount}</strong> grade
              record{gradeCount !== 1 ? "s" : ""} uploaded by{" "}
              <strong className="text-gray-800">{facultyName}</strong> from{" "}
              <strong className="text-gray-800">
                {formatAcademicYear(fromAcademicYear)} /{" "}
                {formatSemester(fromSemester)}
              </strong>{" "}
              to a different academic term.
            </span>
            <span className="block">
              Records are <strong>moved</strong>, not copied — they will no
              longer appear under the source term.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
            <span className="font-medium">
              {formatAcademicYear(fromAcademicYear)} /{" "}
              {formatSemester(fromSemester)}
            </span>
            <ArrowRight className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="font-medium text-blue-700">
              {toAcademicYear && toSemester
                ? `${formatAcademicYear(toAcademicYear)} / ${formatSemester(toSemester)}`
                : "Select target term"}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reassign-academic-year">Target Academic Year</Label>
            <Select
              value={toAcademicYear}
              onValueChange={setToAcademicYear}
            >
              <SelectTrigger id="reassign-academic-year" className="h-10">
                <SelectValue placeholder="Select Academic Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map(function (year) {
                  return (
                    <SelectItem key={year} value={year}>
                      {formatAcademicYear(year)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reassign-semester">Target Semester</Label>
            <Select value={toSemester} onValueChange={setToSemester}>
              <SelectTrigger id="reassign-semester" className="h-10">
                <SelectValue placeholder="Select Semester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIRST">First Semester</SelectItem>
                <SelectItem value="SECOND">Second Semester</SelectItem>
                <SelectItem value="MIDYEAR">Midyear</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isSameTerm && (
            <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                The target term is the same as the source term. Choose a
                different academic year or semester.
              </span>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-blue-800 text-xs space-y-1">
            <p>
              <strong>Conflicts are skipped:</strong> records whose student &
              course already exist in the target term will be left in the
              source term and reported after the move.
            </p>
            <p>
              This action is recorded in the audit log and cannot be undone
              with a single click.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={function () {
              setOpen(false);
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-blue-600 hover:bg-blue-700 focus:ring-blue-600 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reassigning...
              </>
            ) : (
              <>
                <MoveRight className="mr-2 h-4 w-4" />
                Reassign {gradeCount} Record{gradeCount !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
