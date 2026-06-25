"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CourseSearchCell } from "./CourseSearchCell";
import {
  GradeRecord,
  SubjectOption,
  GRADE_OPTIONS,
  formatGradeDisplay,
} from "@/lib/grade-utils";

interface GradeEditRowProps {
  /** True when this row is in edit mode */
  editing: boolean;
  /** The (possibly edited) grade data to show in the form */
  data: GradeRecord;
  subjects: SubjectOption[];
  onGradeChange: (field: keyof GradeRecord, value: string) => void;
  onCourseChange: (courseCode: string) => void;
}

export function GradeEditRow({
  editing,
  data,
  subjects,
  onGradeChange,
  onCourseChange,
}: GradeEditRowProps) {
  return (
    <>
      {/* Course Code */}
      <td>
        {editing ? (
          <CourseSearchCell
            subjects={subjects}
            selectedCode={data.courseCode}
            onSelect={onCourseChange}
          />
        ) : (
          data.courseCode
        )}
      </td>

      {/* Credit Unit */}
      <td>
        {editing ? (
          <Input
            type="number"
            value={data.creditUnit}
            onChange={(e) => onGradeChange("creditUnit", e.target.value)}
            className="border p-1 rounded w-20"
          />
        ) : (
          data.creditUnit
        )}
      </td>

      {/* Course Title */}
      <td>
        {editing ? (
          <Input
            type="text"
            value={data.courseTitle}
            onChange={(e) => onGradeChange("courseTitle", e.target.value)}
            className="border p-1 rounded"
            disabled
          />
        ) : (
          data.courseTitle
        )}
      </td>

      {/* Grade */}
      <td>
        {editing ? (
          <Select
            value={data.grade}
            onValueChange={(v) => onGradeChange("grade", v)}
          >
            <SelectTrigger className="w-[90px]">
              <SelectValue placeholder="Grade" />
            </SelectTrigger>
            <SelectContent>
              {GRADE_OPTIONS.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          data.grade
        )}
      </td>

      {/* Re-exam */}
      <td>
        {editing ? (
          <Input
            type="text"
            value={data.reExam ?? ""}
            onChange={(e) => onGradeChange("reExam", e.target.value)}
            className="border p-1 rounded w-20"
          />
        ) : (
          formatGradeDisplay(data.reExam)
        )}
      </td>

      {/* Remarks */}
      <td>
        {editing ? (
          <Input
            type="text"
            value={data.remarks ?? ""}
            onChange={(e) => onGradeChange("remarks", e.target.value)}
            className="border p-1 rounded"
          />
        ) : (
          data.remarks || "—"
        )}
      </td>

      {/* Instructor */}
      <td>
        {editing ? (
          <Input
            type="text"
            value={data.instructor}
            onChange={(e) => onGradeChange("instructor", e.target.value)}
            className="border p-1 rounded"
          />
        ) : (
          data.instructor
        )}
      </td>
    </>
  );
}
