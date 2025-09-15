"use client";

import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  OptionIcon,
} from "lucide-react";
import { Grade } from "@/lib/types";
import { useUser } from "@clerk/nextjs";
import { courseMap, formatMajor } from "@/lib/courses";

// Prisma-enum-aligned types (condensed to what's needed in the UI)
type UserSex = "MALE" | "FEMALE";
type Courses = "BSIT" | "BSCS" | "BSCRIM" | "BSP" | "BSHM" | "BSED" | "BSBA";
type Major =
  | "HUMAN_RESOURCE_MANAGEMENT"
  | "MARKETING_MANAGEMENT"
  | "ENGLISH"
  | "MATHEMATICS"
  | "NONE";
type Status =
  | "REGULAR"
  | "IRREGULAR"
  | "NOT_ANNOUNCED"
  | "TRANSFEREE"
  | "RETURNEE";
type Role = "admin" | "student" | "superuser" | "faculty" | "registrar";

// Mirrors Prisma Student (subset + UI extras)
type Student = {
  id: string;
  studentNumber: string;
  username: string;
  firstName: string;
  lastName: string;
  middleInit?: string | null;
  email?: string | null;
  phone?: string | null;
  address: string;
  sex: UserSex;
  course: Courses;
  major?: Major | null;
  status: Status;
  role: Role;
  createdAt: Date;
  grades: Grade[];
  isPasswordSet: boolean;
  isApproved: boolean;
  avatarUrl?: string;
};

function humanizeSex(s: UserSex) {
  return s === "MALE" ? "Male" : "Female";
}

function humanizeMajor(m?: Major | null) {
  switch (m) {
    case "HUMAN_RESOURCE_MANAGEMENT":
      return "Human Resource Management";
    case "MARKETING_MANAGEMENT":
      return "Marketing Management";
    case "ENGLISH":
      return "English";
    case "MATHEMATICS":
      return "Mathematics";
    case "NONE":
    default:
      return "None";
  }
}

function humanizeStatus(s: Status) {
  switch (s) {
    case "REGULAR":
      return "Regular";
    case "IRREGULAR":
      return "Irregular";
    case "NOT_ANNOUNCED":
      return "Not announced";
    case "TRANSFEREE":
      return "Transferee";
    case "RETURNEE":
      return "Returnee";
    default:
      return s;
  }
}

export default function StudentProfile({ data }: { data: Student }) {
  const [student, setStudent] = React.useState(data);
  const [openEdit, setOpenEdit] = React.useState(false);
  const { user } = useUser();

  const displayName = [
    student.firstName.charAt(0).toUpperCase() +
      student.firstName.slice(1).toLowerCase(),
    student.middleInit?.charAt(0),
    student.lastName.charAt(0).toUpperCase() +
      student.lastName.slice(1).toLowerCase(),
  ]
    .filter(Boolean)
    .join(" ");
  const initials = React.useMemo(
    () =>
      [student.firstName, student.lastName]
        .map((n) => (n ? n[0] : ""))
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [student.firstName, student.lastName]
  );

  // Client-side pagination for grades
  const [pageIndex, setPageIndex] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(5);
  const totalGrades = student.grades.length;
  const totalPages = Math.max(1, Math.ceil(totalGrades / rowsPerPage));
  const start = pageIndex * rowsPerPage;
  const end = Math.min(start + rowsPerPage, totalGrades);
  const pagedGrades = student.grades.slice(start, end);

  React.useEffect(() => {
    const nextTotalPages = Math.max(1, Math.ceil(totalGrades / rowsPerPage));
    if (pageIndex > nextTotalPages - 1) setPageIndex(nextTotalPages - 1);
  }, [totalGrades, rowsPerPage, pageIndex]);

  return (
    <section aria-label="Student profile">
      <Card className="overflow-hidden border-0 shadow-sm">
        {/* Header */}
        <CardHeader className="pb-4 sm:pb-5 md:pb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3 sm:gap-4">
              <Avatar className="size-16 sm:size-20 md:size-24">
                <AvatarImage
                  src={user?.imageUrl || ""}
                  alt={`${displayName} profile photo`}
                />
                <AvatarFallback className="bg-blue-600 text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                    {displayName}
                  </h1>
                  <Badge variant="secondary" className="gap-1">
                    <IdCard className="size-3.5" />
                    <span className="tabular-nums">
                      {student.studentNumber}
                    </span>
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <User2 className="size-3.5" />
                    {student.username}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className="gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
                    aria-label={`Status: ${humanizeStatus(student.status)}`}
                  >
                    <BadgeCheck className="size-3.5" />
                    {humanizeStatus(student.status)}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Shield className="size-3.5" />
                    {student.role.charAt(0).toUpperCase() +
                      student.role.slice(1)}
                  </Badge>
                  {student.isApproved ? (
                    <Badge className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">
                      <CheckCheck className="size-3.5" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge className="gap-1 bg-blue-700 hover:bg-blue-500 text-white">
                      <CircleAlert className="size-3.5" />
                      Not verified
                    </Badge>
                  )}
                  {student.isPasswordSet ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="size-3.5" />
                      Password set
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <CircleAlert className="size-3.5" />
                      Password pending
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <GraduationCap className="size-4 text-blue-600" />
                    {courseMap(student.course)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <BadgeCheck className="size-4 text-blue-600" />
                    {formatMajor(humanizeMajor(student.major))}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-4 text-blue-600" />
                    Joined {student.createdAt.toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-6 lg:grid-cols-5">
          {/* Overview and Grades */}
          <div className="space-y-6 lg:col-span-3">
            {/* Academic overview (no GPA) */}
            <div className="rounded-lg border p-4 sm:p-5">
              <h3 className="mb-3 text-base sm:text-lg font-medium">
                Academic overview
              </h3>
              <dl className="grid grid-cols-2 gap-4 text-sm sm:text-base md:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Sex</dt>
                  <dd className="mt-1 font-medium">
                    {humanizeSex(student.sex)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="mt-1 font-medium">
                    {student.createdAt.toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Course</dt>
                  <dd className="mt-1 font-medium">{student.course}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Major</dt>
                  <dd className="mt-1 font-medium">
                    {humanizeMajor(student.major)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="mt-1 font-medium">
                    {humanizeStatus(student.status)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Grades: mobile cards + desktop table, with pagination */}
            <div className="rounded-lg border">
              <div className="flex items-center justify-between p-4">
                <h3 className="font-medium text-base sm:text-lg">
                  Recent grades
                </h3>
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {totalGrades} records
                </span>
              </div>
              <Separator />

              {/* Mobile list (md:hidden) */}
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
                            {g.semester === "FIRST"
                              ? "First Semester"
                              : "Second Semester"}
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

              {/* Desktop table (hidden on mobile) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeaderComp>
                    <TableRow>
                      <TableHead className="min-w-[120px]">
                        Course Code
                      </TableHead>
                      <TableHead>Course Title</TableHead>
                      <TableHead className="min-w-[120px]">
                        Academic Year
                      </TableHead>
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
                        <TableCell className="font-medium">
                          {g.courseCode}
                        </TableCell>
                        <TableCell>{g.courseTitle}</TableCell>
                        <TableCell>{g.academicYear}</TableCell>
                        <TableCell>
                          {g.semester === "FIRST"
                            ? "First Semester"
                            : "Second Semester"}
                        </TableCell>
                        <TableCell className="text-right">
                          {g.creditUnit}
                        </TableCell>
                        <TableCell className="text-right">{g.grade}</TableCell>
                        <TableCell className="text-right">{g.reExam}</TableCell>
                        <TableCell className="text-right">
                          {g.instructor}
                        </TableCell>
                      </TableRow>
                    ))}
                    {pagedGrades.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          No grades to display
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination controls */}
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
                    Showing {totalGrades === 0 ? 0 : start + 1}-{end} of{" "}
                    {totalGrades}
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
                      onClick={() =>
                        setPageIndex((p) => Math.min(totalPages - 1, p + 1))
                      }
                      disabled={
                        pageIndex >= totalPages - 1 || totalGrades === 0
                      }
                      aria-label="Next page"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-lg border p-4 sm:p-5">
              <h3 className="mb-3 font-medium text-base sm:text-lg">Contact</h3>
              <ul className="space-y-3 text-sm sm:text-base">
                <li className="flex items-start gap-2">
                  <Mail className="mt-0.5 size-4 text-blue-600" />
                  <div className="min-w-0">
                    <div className="text-muted-foreground">Email</div>
                    {student.email ? (
                      <span className="font-medium break-all">
                        {student.email}
                      </span>
                    ) : (
                      <span className="font-medium">Not provided</span>
                    )}
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <Phone className="mt-0.5 size-4 text-blue-600" />
                  <div>
                    <div className="text-muted-foreground">Phone</div>
                    {student.phone ? (
                      <span className="font-medium">{student.phone}</span>
                    ) : (
                      <span className="font-medium">Not provided</span>
                    )}
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 text-blue-600" />
                  <div className="min-w-0">
                    <div className="text-muted-foreground">Address</div>
                    <div className="font-medium break-words">
                      {student.address}
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
