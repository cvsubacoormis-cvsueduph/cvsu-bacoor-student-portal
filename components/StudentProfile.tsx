
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader as TableHeaderComp,
  TableRow,
} from "@/components/ui/table";
import {
  User2,
  BadgeIcon as IdCard,
  CheckCircle2,
  Shield,
  Mail,
  Phone,
  MapPin,
  CircleAlert,
  CheckCheck,
  CalendarClock,
  GraduationCap,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Grade, Student } from "@/lib/types";
import { useUser } from "@clerk/nextjs";
import { courseMap, formatMajor } from "@/lib/courses";
import { StudentCardSkeleton } from "./skeleton/StudentCardSkeleton";
import { humanizeMajor, humanizeSex, humanizeStatus } from "@/lib/student-utils";
import { useStudentPagination } from "@/hooks/use-student-pagination";

export default function StudentProfile({ data }: { data: Student }) {
  const { user } = useUser();

  const displayName = React.useMemo(() => {
    return [
      data.firstName.charAt(0).toUpperCase() +
      data.firstName.slice(1).toLowerCase(),
      data.middleInit?.charAt(0),
      data.lastName.charAt(0).toUpperCase() +
      data.lastName.slice(1).toLowerCase(),
    ]
      .filter(Boolean)
      .join(" ");
  }, [data.firstName, data.middleInit, data.lastName]);

  const initials = React.useMemo(
    () =>
      [data.firstName, data.lastName]
        .map((n) => (n ? n[0] : ""))
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [data.firstName, data.lastName]
  );

  if (!data) {
    return <StudentCardSkeleton />;
  }

  return (
    <section aria-label="Student profile">
      <Card className="overflow-hidden border-0 shadow-sm">
        <ProfileHeader
          student={data}
          displayName={displayName}
          initials={initials}
          userImageUrl={user?.imageUrl}
        />

        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div className="order-2 space-y-6 lg:order-1 lg:col-span-2">
            <GradesSection grades={data.grades} />
          </div>

          <div className="order-1 space-y-6 lg:order-2">
            <PersonalDetails student={data} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ProfileHeader({
  student,
  displayName,
  initials,
  userImageUrl,
}: {
  student: Student;
  displayName: string;
  initials: string;
  userImageUrl?: string;
}) {
  return (
    <CardHeader className="pb-4 sm:pb-5 md:pb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <Avatar className="size-20 border-2 border-background shadow-sm sm:size-24 md:size-28">
            <AvatarImage
              src={userImageUrl || ""}
              alt={`${displayName} profile photo`}
            />
            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-xl font-medium text-white">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-2.5 pt-1">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {displayName}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5 px-2.5 py-0.5 font-normal text-muted-foreground">
                  <IdCard className="size-3.5" />
                  <span className="tabular-nums">{student.studentNumber}</span>
                </Badge>
                {student.isApproved && (
                  <Badge variant="default" className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                    <CheckCheck className="size-3.5" />
                    Verified Student
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-4 text-primary/70" />
                <span className="font-medium text-foreground">{student.course}</span>
              </div>
              <div className="flex items-center gap-2">
                <BadgeCheck className="size-4 text-primary/70" />
                <span>{formatMajor(humanizeMajor(student.major))}</span>
              </div>
              <div className="">
                <Badge
                  variant="outline"
                  className={`gap-1.5 ${student.status === "REGULAR"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400"
                    }`}
                >
                  {humanizeStatus(student.status)}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-primary/70" />
                <span>Joined {student.createdAt.toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardHeader>
  );
}



function GradesSection({ grades }: { grades: Grade[] }) {
  const {
    pageIndex,
    setPageIndex,
    rowsPerPage,
    setRowsPerPage,
    totalGrades,
    totalPages,
    pagedGrades,
    start,
    end,
  } = useStudentPagination(grades);

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between p-4">
        <h3 className="font-medium text-base sm:text-lg">Recent grades</h3>
        <span className="text-xs sm:text-sm text-muted-foreground">
          {totalGrades} records
        </span>
      </div>
      <Separator />

      <MobileGradesList pagedGrades={pagedGrades} />
      <DesktopGradesTable pagedGrades={pagedGrades} start={start} />

      <PaginationControls
        pageIndex={pageIndex}
        setPageIndex={setPageIndex}
        rowsPerPage={rowsPerPage}
        setRowsPerPage={setRowsPerPage}
        totalGrades={totalGrades}
        totalPages={totalPages}
        start={start}
        end={end}
      />
    </div>
  );
}

function MobileGradesList({ pagedGrades }: { pagedGrades: Grade[] }) {
  return (
    <ul className="md:hidden divide-y">
      {pagedGrades.map((g) => (
        <li
          key={`${g.courseCode}-${g.academicYear}-${g.semester}`}
          className="p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">
                {g.courseCode} — {g.courseTitle}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{g.academicYear}</span>
                <span>
                  {g.semester === "FIRST" ? "First Semester" : "Second Semester"}
                </span>
                <span className="tabular-nums">
                  {g.creditUnit} unit{g.creditUnit === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold tabular-nums">
                {g.grade}
              </div>
              <div className="text-xs text-muted-foreground">
                {g.instructor}
              </div>
            </div>
          </div>
        </li>
      ))}
      {pagedGrades.length === 0 && (
        <li className="p-4 text-center text-muted-foreground">
          No grades to display
        </li>
      )}
    </ul>
  );
}

function DesktopGradesTable({
  pagedGrades,
  start,
}: {
  pagedGrades: Grade[];
  start: number;
}) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <Table>
        <TableHeaderComp>
          <TableRow>
            <TableHead className="min-w-[120px]">Course Code</TableHead>
            <TableHead>Course Title</TableHead>
            <TableHead className="min-w-[120px]">Academic Year</TableHead>
            <TableHead className="min-w-[100px]">Semester</TableHead>
            <TableHead className="text-right">Credit Unit</TableHead>
            <TableHead className="text-right">Grade</TableHead>
            <TableHead className="">Re-Exam</TableHead>
            <TableHead className="text-right">Instructor</TableHead>
          </TableRow>
        </TableHeaderComp>
        <TableBody>
          {pagedGrades.map((g, idx) => (
            <TableRow key={`${g.courseCode}-${start + idx}`}>
              <TableCell className="font-medium">{g.courseCode}</TableCell>
              <TableCell>{g.courseTitle}</TableCell>
              <TableCell>{g.academicYear}</TableCell>
              <TableCell>
                {g.semester === "FIRST" ? "First Semester" : "Second Semester"}
              </TableCell>
              <TableCell className="text-right">{g.creditUnit}</TableCell>
              <TableCell className="text-right">{g.grade}</TableCell>
              <TableCell className="text-right">{g.reExam}</TableCell>
              <TableCell className="text-right">{g.instructor}</TableCell>
            </TableRow>
          ))}
          {pagedGrades.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={8}
                className="text-center text-muted-foreground"
              >
                No grades to display
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function PaginationControls({
  pageIndex,
  setPageIndex,
  rowsPerPage,
  setRowsPerPage,
  totalGrades,
  totalPages,
  start,
  end,
}: {
  pageIndex: number;
  setPageIndex: React.Dispatch<React.SetStateAction<number>>;
  rowsPerPage: number;
  setRowsPerPage: React.Dispatch<React.SetStateAction<number>>;
  totalGrades: number;
  totalPages: number;
  start: number;
  end: number;
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 p-4 text-sm md:flex-row">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Rows per page</span>
        <select
          value={rowsPerPage}
          onChange={(e) => {
            const next = Number(e.target.value);
            setRowsPerPage(next);
            setPageIndex(0);
          }}
          aria-label="Rows per page"
          className="h-9 rounded-md border border-input bg-background px-2"
        >
          {[5, 10, 20, 50].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground">
          Showing {totalGrades === 0 ? 0 : start + 1}-{end} of {totalGrades}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">
          Page {totalGrades === 0 ? 0 : pageIndex + 1} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-transparent"
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={pageIndex === 0 || totalGrades === 0}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-transparent"
            onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
            disabled={pageIndex >= totalPages - 1 || totalGrades === 0}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function PersonalDetails({ student }: { student: Student }) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="p-6">
        <h3 className="flex items-center gap-2 font-semibold leading-none tracking-tight">
          <User2 className="size-4 text-blue-600" />
          Personal Account
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground">Manage your personal information.</p>
      </div>
      <Separator />
      <div className="p-6">
        <ul className="space-y-4 text-sm">
          <ContactItem
            icon={<User2 className="mt-0.5 size-4 text-muted-foreground" />}
            label="Username"
            value={student.username}
          />
          <ContactItem
            icon={<Shield className="mt-0.5 size-4 text-muted-foreground" />}
            label="Sex"
            value={humanizeSex(student.sex)}
          />
          <ContactItem
            icon={<Mail className="mt-0.5 size-4 text-muted-foreground" />}
            label="Email"
            value={student.email}
            isEmail
          />
          <ContactItem
            icon={<Phone className="mt-0.5 size-4 text-muted-foreground" />}
            label="Phone"
            value={student.phone}
          />
          <ContactItem
            icon={<MapPin className="mt-0.5 size-4 text-muted-foreground" />}
            label="Address"
            value={student.address}
          />
        </ul>
      </div>
    </div>
  );
}

function ContactItem({
  icon,
  label,
  value,
  isEmail = false,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  isEmail?: boolean;
}) {
  return (
    <li className="flex items-start gap-2">
      {icon}
      <div className="min-w-0">
        <div className="text-muted-foreground">{label}</div>
        {value ? (
          <span className={`font-medium ${isEmail ? "break-all" : "break-words"}`}>
            {value}
          </span>
        ) : (
          <span className="font-medium">Not provided</span>
        )}
      </div>
    </li>
  );
}
