
"use client";

import { useMemo, useState } from "react";
import { CheckCircle, Clock, XCircle, BookOpen, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { semesterMap, yearLevelMap } from "@/lib/utils";
import { courseMap, formatMajor } from "@/lib/courses";
import GenerateChecklistPDF from "./GenerateChecklistsPDF";
import { CurriculumChecklistSkeleton } from "./skeleton/CurriculumChecklistSkeleton";
import { useCurriculumData, CurriculumData } from "@/hooks/use-curriculum-data";
import { Subject } from "@/lib/types";
import {
  getBetterGrade,
  getGradeColor,
  getStatusColor,
} from "@/lib/checklist-utils";

export function CurriculumChecklist() {
  const { data, loading, error } = useCurriculumData();
  const [selectedYear, setSelectedYear] = useState<string>("all");

  const groupedCurriculum = useMemo(() => {
    if (!data) return {};
    return data.curriculum.reduce(
      (acc: Record<string, Record<string, Subject[]>>, subject) => {
        const yearKey = subject.yearLevel;
        const semesterKey = subject.semester;

        if (!acc[yearKey]) acc[yearKey] = {};
        if (!acc[yearKey][semesterKey]) acc[yearKey][semesterKey] = [];

        acc[yearKey][semesterKey].push(subject);
        return acc;
      },
      {}
    );
  }, [data]);

  const filteredCurriculum = useMemo(() => {
    if (!groupedCurriculum) return [];
    return selectedYear === "all"
      ? Object.entries(groupedCurriculum)
      : Object.entries(groupedCurriculum).filter(
        ([year]) => yearLevelMap(year) === selectedYear
      );
  }, [groupedCurriculum, selectedYear]);

  if (loading) return <CurriculumChecklistSkeleton />;
  if (error || !data) return <ErrorState />;

  return (
    <div className="space-y-6">
      <ChecklistHeader
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        data={data}
      />

      <ProgressSummary data={data} />

      <div className="space-y-6">
        {filteredCurriculum.map(([year, semesters]) => (
          <YearLevelSection key={year} year={year} semesters={semesters} />
        ))}
      </div>

      <Legend />
      <PrintFooter studentInfo={data.studentInfo} />
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-4 p-6 border border-red-200 bg-red-50 rounded-md shadow-md max-w-md">
        <div className="text-2xl font-bold text-red-600">
          Failed to Load Data
        </div>
        <p className="text-gray-700">
          We couldn’t load the curriculum data. This might be due to too many
          requests or a temporary issue.
        </p>
        <Button
          onClick={() => location.reload()}
          className="bg-blue-600 hover:bg-blue-800 text-white"
        >
          Try Again
        </Button>
      </div>
    </div>
  );
}

function ChecklistHeader({
  selectedYear,
  onYearChange,
  data,
}: {
  selectedYear: string;
  onYearChange: (val: string) => void;
  data: CurriculumData;
}) {
  return (
    <div className="print:border-b print:border-gray-300 print:pb-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 print:flex-row">
        <div className="flex gap-2 print:hidden">
          <Select value={selectedYear} onValueChange={onYearChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              <SelectItem value="First Year">First Year</SelectItem>
              <SelectItem value="Second Year">Second Year</SelectItem>
              <SelectItem value="Third Year">Third Year</SelectItem>
              <SelectItem value="Fourth Year">Fourth Year</SelectItem>
            </SelectContent>
          </Select>
          <GenerateChecklistPDF data={data} />
        </div>
      </div>
    </div>
  );
}

function ProgressSummary({ data }: { data: CurriculumData }) {
  return (
    <Card className="print:shadow-none print:border print:border-gray-300">
      <CardHeader className="p-4 sm:p-6 print:pb-2">
        <CardTitle className="flex flex-row items-start gap-2 text-base sm:items-center sm:text-lg print:text-lg">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground sm:mt-0 print:h-4 print:w-4" />
          <span className="leading-tight">
            Academic Progress - {courseMap(data.studentInfo.course)}
            {data.studentInfo.major !== "NONE" &&
              ` ${data.studentInfo.major
                ? formatMajor(data.studentInfo.major)
                : ""
              }`}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="print:pt-0">
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-2">
          <ProgressMetric
            value={data.progress.creditsCompleted}
            label="Credits Completed"
            bgColor="bg-blue-50"
            textColor="text-blue-600"
            subTextColor="text-blue-700"
          />
          <ProgressMetric
            value={data.progress.totalCreditsRequired}
            label="Total Required"
            bgColor="bg-gray-50"
            textColor="text-gray-600"
            subTextColor="text-gray-700"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mt-4 print:grid-cols-2 print:gap-2 print:mt-2">
          <ProgressMetric
            value={data.progress.subjectsCompleted}
            label="Subjects Completed"
            bgColor="bg-amber-50"
            textColor="text-amber-600"
            subTextColor="text-amber-700"
          />
          <ProgressMetric
            value={data.progress.subjectsRemaining}
            label="Subjects Remaining"
            bgColor="bg-red-50"
            textColor="text-red-600"
            subTextColor="text-red-700"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressMetric({
  value,
  label,
  bgColor,
  textColor,
  subTextColor,
}: {
  value: number | string;
  label: string;
  bgColor: string;
  textColor: string;
  subTextColor: string;
}) {
  return (
    <div
      className={`text-center p-4 rounded-lg print:p-2 ${bgColor} print:bg-opacity-50`}
    >
      <div className={`text-2xl font-bold print:text-lg ${textColor}`}>
        {value}
      </div>
      <div className={`text-sm print:text-xs ${subTextColor}`}>{label}</div>
    </div>
  );
}

function YearLevelSection({
  year,
  semesters,
}: {
  year: string;
  semesters: Record<string, Subject[]>;
}) {
  return (
    <Card className="print:shadow-none print:border print:border-gray-300 print:break-inside-avoid">
      <CardHeader className="print:pb-2">
        <CardTitle className="flex items-center gap-2 print:text-lg">
          <Calendar className="h-5 w-5 print:h-4 print:w-4" />
          {yearLevelMap(year)}
        </CardTitle>
      </CardHeader>
      <CardContent className="print:pt-0">
        <div className="space-y-6 print:space-y-4">
          {Object.entries(semesters).map(([semester, subjects]) => (
            <div key={semester}>
              <h4 className="font-medium text-gray-900 mb-3 print:text-sm print:mb-2">
                {semesterMap(semester)}
              </h4>
              <SemesterTable subjects={subjects} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SemesterTable({ subjects }: { subjects: Subject[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm print:text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-2 font-medium text-gray-700 print:py-1">
              Status
            </th>
            <th className="text-left py-2 px-2 font-medium text-gray-700 print:py-1">
              Course Code
            </th>
            <th className="text-left py-2 px-2 font-medium text-gray-700 print:py-1">
              Course Title
            </th>
            <th className="text-center py-2 px-2 font-medium text-gray-700 print:py-1">
              Lec
            </th>
            <th className="text-center py-2 px-2 font-medium text-gray-700 print:py-1">
              Lab
            </th>
            <th className="text-center py-2 px-2 font-medium text-gray-700 print:py-1">
              Grade
            </th>
            <th className="text-center py-2 px-2 font-medium text-gray-700 print:py-1">
              Re-Exam
            </th>
            <th className="text-center py-2 px-2 font-medium text-gray-700 print:py-1">
              AY/Semester Taken
            </th>
            <th className="text-left py-2 px-2 font-medium text-gray-700 print:py-1 hidden md:table-cell print:table-cell">
              Prerequisites
            </th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject) => (
            <SubjectRow key={subject.id} subject={subject} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubjectRow({ subject }: { subject: Subject }) {
  const latestReExam =
    subject.allAttempts?.[subject.allAttempts.length - 1]?.reExam;

  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 px-2 print:py-1">
        <div className="flex items-center gap-2">
          <StatusIcon status={subject.completion} />
          <Badge
            variant="outline"
            className={`text-xs px-2 py-1 print:px-1 print:py-0 print:text-xs ${getStatusColor(
              subject.completion
            )}`}
          >
            {subject.completion}
          </Badge>
        </div>
      </td>
      <td className="py-2 px-2 font-medium print:py-1">{subject.courseCode}</td>
      <td className="py-2 px-2 print:py-1">{subject.courseTitle}</td>
      <td className="py-2 px-2 text-center print:py-1">
        {subject.creditUnit.lec}
      </td>
      <td className="py-2 px-2 text-center print:py-1">
        {subject.creditUnit.lab}
      </td>
      <td className="py-2 px-2 text-center print:py-1">
        <span className={`font-medium ${getGradeColor(subject.grade)}`}>
          {subject.grade || "-"}
        </span>
      </td>
      <td
        className={`py-2 px-2 text-center font-semibold print:py-1 ${getGradeColor(
          latestReExam
        )}`}
      >
        {latestReExam || "-"}
      </td>
      <td className="py-2 px-2 text-center print:py-1">
        {subject.allAttempts.length > 0 ? (
          <div className="flex flex-col gap-1">
            {subject.allAttempts.map((attempt, idx) => (
              <AttemptRow key={idx} attempt={attempt} />
            ))}
          </div>
        ) : (
          "-"
        )}
      </td>
      <td className="py-2 px-2 text-xs text-gray-600 hidden md:table-cell print:table-cell print:py-1">
        {subject.preRequisite || "-"}
      </td>
    </tr>
  );
}

function AttemptRow({ attempt }: { attempt: any }) {
  const betterGrade = getBetterGrade(attempt.grade, attempt.reExam);

  const aySem = attempt.retakenAYSem ||
    `AY ${attempt.academicYear.split("_").slice(1).join("-")} / ${attempt.semester === "FIRST"
      ? "1st"
      : attempt.semester === "SECOND"
        ? "2nd"
        : "Midyear"
    } Sem (Attempt ${attempt.attemptNumber})`;

  return (
    <div className="text-xs">
      {aySem} -
      {(attempt.grade || attempt.reExam) && (
        <span
          className={`ml-2 font-medium ${getGradeColor(betterGrade)}`}
        >
          {betterGrade}
        </span>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "Completed":
    case "Passed":
    case "Satisfactory":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "Enrolled":
      return <Clock className="h-4 w-4 text-blue-600" />;
    case "Failed":
    case "Unsatisfactory":
      return <XCircle className="h-4 w-4 text-red-600" />;
    case "Dropped":
    case "Con. Failure":
    case "Lack of Req.":
    case "Incomplete":
      return <XCircle className="h-4 w-4 text-orange-600" />;
    default:
      return (
        <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
      );
  }
}

function Legend() {
  return (
    <Card className="w-full border-gray-200 print:border print:border-gray-300 print:shadow-none">
      {/* Reduced padding on mobile (p-4) to maximize space */}
      <CardContent className="p-4 sm:p-6 print:pt-2">

        {/* Adjusted header size and margin for mobile */}
        <h4 className="mb-3 text-base font-medium text-gray-900 sm:text-lg print:mb-2 print:text-sm">
          Legend
        </h4>

        {/* Responsive Grid:
           - Mobile: 1 column, tighter vertical gap (gap-y-3)
           - Tablet (sm): 2 columns
           - Desktop (md): 4 columns
        */}
        <div className="grid grid-cols-1 gap-y-3 gap-x-4 sm:grid-cols-2 md:grid-cols-4 print:grid-cols-4 print:gap-2 print:text-xs">

          <LegendItem
            icon={<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600 print:mt-0 print:h-3 print:w-3" />}
            label="Completed/Passed/S"
          />

          <LegendItem
            icon={<XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 print:mt-0 print:h-3 print:w-3" />}
            label="Failed/Unsatisfactory"
          />

          <LegendItem
            icon={<XCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600 print:mt-0 print:h-3 print:w-3" />}
            label="Conditional Failure/Dropped/Lack of Requirements"
          />

          <LegendItem
            icon={<div className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-gray-300 print:mt-0 print:h-3 print:w-3" />}
            label="Not Taken"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function LegendItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-gray-600 print:text-xs">
      {icon}
      <span className="leading-tight">{label}</span>
    </div>
  );
}

function PrintFooter({
  studentInfo,
}: {
  studentInfo: { fullName: string; studentNumber: string };
}) {
  return (
    <div className="hidden print:block text-center text-xs text-gray-500 mt-8 pt-4 border-t border-gray-300">
      <p>
        Generated on {new Date().toLocaleDateString()} | Curriculum Checklist
      </p>
      <p>
        Student: {studentInfo.fullName} ({studentInfo.studentNumber})
      </p>
    </div>
  );
}
