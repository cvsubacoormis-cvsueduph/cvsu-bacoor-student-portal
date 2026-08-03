"use client";

import { useState, useMemo } from "react";
import { CalendarCheck2, Loader2, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import {
  getActiveUploadTerm,
  setActiveUploadTerm,
  clearActiveUploadTerm,
} from "@/actions/settings";

export interface ActiveUploadTermSelectorProps {
  availableTerms: Array<{
    academicYear: string;
    semester: "FIRST" | "SECOND" | "MIDYEAR";
  }>;
  currentActive: { academicYear: string; semester: "FIRST" | "SECOND" | "MIDYEAR" } | null;
  currentRole:
    | "admin"
    | "superuser"
    | "registrar"
    | "registrar_staff"
    | "faculty"
    | "student";
}

const SEMESTER_LABEL: Record<string, string> = {
  FIRST: "1st Semester",
  SECOND: "2nd Semester",
  MIDYEAR: "Midyear",
};

function formatAcademicYear(value: string): string {
  if (value.startsWith("AY_")) {
    const parts = value.slice(3).split("_");
    if (parts.length === 2) {
      return `AY ${parts[0]}-${parts[1]}`;
    }
  }
  return value;
}

function formatTermLabel(term: { academicYear: string; semester: string } | null): string {
  if (!term) return "(not assigned)";
  const ay = formatAcademicYear(term.academicYear);
  const sem = SEMESTER_LABEL[term.semester] ?? term.semester;
  return `${ay} · ${sem}`;
}

function isEditable(role: string): boolean {
  return role === "admin" || role === "superuser";
}

export default function ActiveUploadTermSelector({
  availableTerms,
  currentActive: initialActive,
  currentRole,
}: ActiveUploadTermSelectorProps) {
  const [activeTerm, setActiveTerm] = useState(initialActive);
  const [isLoading, setIsLoading] = useState(false);

  const termOptions = useMemo(
    () =>
      availableTerms.map((term) => ({
        value: `${term.academicYear}|${term.semester}`,
        label: formatTermLabel(term),
        term,
      })),
    [availableTerms],
  );

  const selectValue = activeTerm
    ? `${activeTerm.academicYear}|${activeTerm.semester}`
    : "";

  const handleSetTerm = async (value: string) => {
    if (!value) return;
    const match = termOptions.find((opt) => opt.value === value);
    if (!match) return;

    const confirmed = await Swal.fire({
      icon: "question",
      title: "Set assigned upload term?",
      text: `Faculty will only be able to upload grades for ${match.label}.`,
      showCancelButton: true,
      confirmButtonText: "Set Term",
      cancelButtonText: "Cancel",
    });

    if (!confirmed.isConfirmed) return;

    const previousTerm = activeTerm;
    setActiveTerm(match.term);
    setIsLoading(true);

    try {
      const result = await setActiveUploadTerm({
        academicYear: match.term.academicYear,
        semester: match.term.semester,
      });

      if (result.success) {
        toast.success(`Assigned upload term set to ${match.label}.`);
      } else {
        setActiveTerm(previousTerm);
        toast.error(result.message || "Failed to set assigned upload term.");
      }
    } catch (error) {
      setActiveTerm(previousTerm);
      toast.error("An unexpected error occurred while setting the term.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    const confirmed = await Swal.fire({
      icon: "warning",
      title: "Clear assigned upload term?",
      text: "Faculty will be able to upload grades for any term until a new one is assigned.",
      showCancelButton: true,
      confirmButtonText: "Clear",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#d33",
    });

    if (!confirmed.isConfirmed) return;

    const previousTerm = activeTerm;
    setActiveTerm(null);
    setIsLoading(true);

    try {
      const result = await clearActiveUploadTerm();
      if (result.success) {
        toast.success("Assigned upload term cleared.");
      } else {
        setActiveTerm(previousTerm);
        toast.error("Failed to clear assigned upload term.");
      }
    } catch (error) {
      setActiveTerm(previousTerm);
      toast.error("An unexpected error occurred while clearing the term.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-md min-h-[42px]">
      <CalendarCheck2 className="h-4 w-4 text-blue-600 shrink-0" />
      <Label className="text-sm font-medium cursor-default text-gray-700 shrink-0">
        Upload Term:
      </Label>

      {isEditable(currentRole) ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Select
            value={selectValue}
            onValueChange={handleSetTerm}
            disabled={isLoading || availableTerms.length === 0}
          >
            <SelectTrigger className="h-9 w-[230px] text-sm bg-white">
              <SelectValue
                placeholder={
                  availableTerms.length === 0
                    ? "No terms available"
                    : "Select assigned term"
                }
              >
                {activeTerm ? formatTermLabel(activeTerm) : "Select assigned term"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableTerms.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No academic terms have been created yet — ask the registrar to add
                  a term.
                </div>
              ) : (
                termOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {activeTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:text-red-600"
              onClick={handleClear}
              disabled={isLoading}
              aria-label="Clear assigned upload term"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          )}

          {isLoading && !activeTerm && (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          )}
        </div>
      ) : (
        <span
          className={`text-sm font-medium truncate ${
            activeTerm ? "text-gray-900" : "text-amber-600"
          }`}
          title={activeTerm ? formatTermLabel(activeTerm) : "No assigned upload term"}
        >
          {activeTerm ? formatTermLabel(activeTerm) : "(not assigned)"}
        </span>
      )}
    </div>
  );
}
