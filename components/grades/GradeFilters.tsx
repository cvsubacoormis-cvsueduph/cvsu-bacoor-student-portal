"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { formatAcademicYear } from "@/lib/grade-utils";

interface GradeFiltersProps {
  uniqueAcademicYears: string[];
  semesterOptions: string[];
  academicYear: string;
  semester: string;
  onAcademicYearChange: (v: string) => void;
  onSemesterChange: (v: string) => void;
  canEditGrades: boolean;
  hasGrades: boolean;
  onAddRow: () => void;
  onSaveAll: () => void;
}

export function GradeFilters({
  uniqueAcademicYears,
  semesterOptions,
  academicYear,
  semester,
  onAcademicYearChange,
  onSemesterChange,
  canEditGrades,
  hasGrades,
  onAddRow,
  onSaveAll,
}: GradeFiltersProps) {
  return (
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center gap-3">
        <Select onValueChange={onAcademicYearChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Academic Year" />
          </SelectTrigger>
          <SelectContent>
            {uniqueAcademicYears.map((y) => (
              <SelectItem key={y} value={y}>
                {formatAcademicYear(y)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={semester}
          onValueChange={onSemesterChange}
          disabled={!academicYear}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Semester" />
          </SelectTrigger>
          <SelectContent>
            {semesterOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        {canEditGrades && academicYear && semester && (
          <Button
            onClick={onAddRow}
            size="sm"
            className="bg-blue-700 hover:bg-blue-600"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Grade
          </Button>
        )}
        {canEditGrades && hasGrades && (
          <Button
            onClick={onSaveAll}
            size="sm"
            className="bg-blue-600 hover:bg-blue-500"
          >
            Save All Changes
          </Button>
        )}
      </div>
    </div>
  );
}
