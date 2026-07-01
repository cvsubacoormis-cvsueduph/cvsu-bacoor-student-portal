"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  getFacultyUploadedGrades,
  rollbackFacultyGrades,
  type UploadSession,
  type UploadedGradeRecord,
} from "@/actions/faculty-monitoring";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AcademicYear, Semester } from "@prisma/client";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

// ── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Props ───────────────────────────────────────────────────────────────────

interface FacultyGradesDetailPanelProps {
  facultyId: string;
  facultyName: string;
  academicYear: AcademicYear;
  semester: Semester;
  session: UploadSession;
  isFacultyView?: boolean;
  canRollback?: boolean;
}

// ── Component ───────────────────────────────────────────────────────────────

export function FacultyGradesDetailPanel({
  facultyId,
  facultyName,
  academicYear,
  semester,
  session,
  isFacultyView = false,
  canRollback = !isFacultyView,
}: FacultyGradesDetailPanelProps) {
  // ── Data state ────────────────────────────────────────────────────────
  const [grades, setGrades] = useState<UploadedGradeRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [availableCourseCodes, setAvailableCourseCodes] = useState<string[]>(
    [],
  );
  const [availableCourseTitles, setAvailableCourseTitles] = useState<string[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Filter state ──────────────────────────────────────────────────────
  const [courseCodeFilter, setCourseCodeFilter] = useState("all");
  const [courseTitleFilter, setCourseTitleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const prevSearch = useRef(search);

  // ── Pagination state ──────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── Rollback state ────────────────────────────────────────────────────
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [rollbackInput, setRollbackInput] = useState("");
  const [isSelectiveRollback, setIsSelectiveRollback] = useState(false);

  // ── Checkbox selection state ──────────────────────────────────────────
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

  // ── Fetch grades ──────────────────────────────────────────────────────
  const fetchGrades = useCallback(
    async function () {
      setIsLoading(true);
      setError(null);

      try {
        const params: Parameters<typeof getFacultyUploadedGrades>[0] = {
          facultyId,
          academicYear,
          semester,
          sessionStartedAt: session.startedAt,
          sessionEndedAt: session.endedAt,
          page,
          pageSize,
        };

        if (courseCodeFilter !== "all") {
          params.courseCode = courseCodeFilter;
        }
        if (courseTitleFilter !== "all") {
          params.courseTitle = courseTitleFilter;
        }

        if (search) {
          params.search = search;
        }

        const result = await getFacultyUploadedGrades(params);
        setGrades(result.data);
        setTotal(result.total);
        setAvailableCourseCodes(result.availableCourseCodes);
        setAvailableCourseTitles(result.availableCourseTitles);
      } catch (err) {
        console.error("Failed to fetch grades", err);
        setError(
          err instanceof Error ? err.message : "Failed to load grades.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      facultyId,
      academicYear,
      semester,
      session.startedAt,
      session.endedAt,
      page,
      pageSize,
      courseCodeFilter,
      courseTitleFilter,
      search,
    ],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchGrades is stable via useCallback
  useEffect(
    function () {
      fetchGrades();
    },
    [fetchGrades],
  );

  // Clear checkbox selections when grades data changes (pagination, filters, etc.)
  useEffect(
    function () {
      setSelectedEntries(new Set());
    },
    [grades],
  );

  // Reset page when filters change
  const handleCourseCodeChange = useCallback(function (value: string) {
    setCourseCodeFilter(value);
    setPage(1);
    // Clear course title filter if switching to "all" so stale title filter
    // doesn't conflict with the new code set
    if (value === "all") {
      setCourseTitleFilter("all");
    }
  }, []);

  const handleCourseTitleChange = useCallback(function (value: string) {
    setCourseTitleFilter(value);
    setPage(1);
  }, []);

  const debouncedSearch = useDebouncedCallback(
    function (value: string) {
      setSearch(value);
      setPage(1);
    },
    400,
  );

  const handleSearchChange = useCallback(
    function (e: React.ChangeEvent<HTMLInputElement>) {
      const value = e.target.value;
      setSearchInput(value);
      debouncedSearch(value);
    },
    [debouncedSearch],
  );

  // Sync searchInput from external changes (e.g. when session changes)
  useEffect(
    function () {
      if (search !== prevSearch.current) {
        setSearchInput(search);
        prevSearch.current = search;
      }
    },
    [search],
  );

  // ── Checkbox selection handlers ───────────────────────────────────────
  const entryKey = useCallback(
    function (g: UploadedGradeRecord) {
      return `${g.studentNumber}::${g.courseCode}`;
    },
    [],
  );

  const allCurrentSelected =
    grades.length > 0 &&
    grades.every(function (g) {
      return selectedEntries.has(entryKey(g));
    });

  const handleSelectAll = useCallback(
    function () {
      if (allCurrentSelected) {
        setSelectedEntries(new Set());
      } else {
        const next = new Set<string>();
        for (const g of grades) {
          next.add(entryKey(g));
        }
        setSelectedEntries(next);
      }
    },
    [allCurrentSelected, grades, entryKey],
  );

  const handleSelectRow = useCallback(
    function (g: UploadedGradeRecord) {
      const key = entryKey(g);
      setSelectedEntries(function (prev) {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    [entryKey],
  );

  // ── Rollback handler ──────────────────────────────────────────────────
  const isFilteredRollback = courseCodeFilter !== "all" || courseTitleFilter !== "all";

  const handleRollback = useCallback(
    async function () {
      if (rollbackInput !== "DELETE") return;

      setIsRollingBack(true);
      try {
        const rollbackParams: Parameters<typeof rollbackFacultyGrades>[0] = {
          facultyId,
          academicYear,
          semester,
          sessionStartedAt: session.startedAt,
          sessionEndedAt: session.endedAt,
        };

        if (isSelectiveRollback) {
          // Convert Set of "studentNumber::courseCode" keys to entries array
          rollbackParams.entries = Array.from(selectedEntries).map(function (key) {
            const [studentNumber, courseCode] = key.split("::");
            return { studentNumber, courseCode };
          });
        } else if (courseCodeFilter !== "all") {
          rollbackParams.courseCode = courseCodeFilter;
        }
        if (!isSelectiveRollback && courseTitleFilter !== "all") {
          rollbackParams.courseTitle = courseTitleFilter;
        }

        const result = await rollbackFacultyGrades(rollbackParams);

        const scope = isSelectiveRollback
          ? "selected"
          : isFilteredRollback
            ? "filtered"
            : "";
        toast.success(
          `Rollback complete: ${result.deletedCount} ${scope} grade(s) deleted successfully.`,
        );
        setRollbackConfirmOpen(false);
        setRollbackInput("");
        setSelectedEntries(new Set());
        setIsSelectiveRollback(false);
        // Refresh the list
        setPage(1);
        fetchGrades();
      } catch (err) {
        console.error("Rollback failed", err);
        toast.error(
          err instanceof Error ? err.message : "Rollback failed. Please try again.",
        );
      } finally {
        setIsRollingBack(false);
      }
    },
    [
      rollbackInput,
      isSelectiveRollback,
      isFilteredRollback,
      selectedEntries,
      facultyId,
      academicYear,
      semester,
      session.startedAt,
      session.endedAt,
      courseCodeFilter,
      courseTitleFilter,
      fetchGrades,
    ],
  );

  // ── Pagination helpers ────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  // ── Render ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading uploaded grades...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6 text-sm text-red-500 flex items-center gap-2">
        <XCircle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header bar with stats & rollback button ─────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">
            <strong className="text-gray-800">{total}</strong> grade record
            {total !== 1 ? "s" : ""} in this session
          </span>
          <span className="text-gray-300">|</span>
          <span className="inline-flex items-center gap-1 text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {session.createdCount} created
          </span>
          <span className="inline-flex items-center gap-1 text-amber-600">
            <RefreshCw className="h-3.5 w-3.5" />
            {session.updatedCount} updated
          </span>
          <span className="inline-flex items-center gap-1 text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {session.failureCount} failed
          </span>
        </div>

        {/* Rollback button — admin/registrar/superuser only */}
        {canRollback && (
          <AlertDialog
            open={rollbackConfirmOpen}
            onOpenChange={function (open) {
              if (!open) {
                setRollbackInput("");
                setIsSelectiveRollback(false);
              }
              setRollbackConfirmOpen(open);
            }}
          >
            <AlertDialogTrigger asChild>
              {selectedEntries.size > 0 ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isRollingBack}
                  className="flex items-center gap-1.5"
                  title="Rollback only the selected student grades"
                  onClick={function () {
                    setIsSelectiveRollback(true);
                  }}
                >
                  {isRollingBack ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  {isRollingBack
                    ? "Rolling back..."
                    : `Rollback Selected (${selectedEntries.size})`}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={total === 0 || isRollingBack}
                  className="flex items-center gap-1.5"
                  title={
                    isFilteredRollback
                      ? "Rollback only the currently filtered grades"
                      : "Rollback all grades in this session"
                  }
                  onClick={function () {
                    setIsSelectiveRollback(false);
                  }}
                >
                  {isRollingBack ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  {isRollingBack
                    ? "Rolling back..."
                    : isFilteredRollback
                      ? "Rollback Filtered"
                      : "Rollback Upload"}
                </Button>
              )}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Confirm Rollback
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    You are about to <strong>permanently delete</strong>{" "}
                    {isSelectiveRollback ? (
                      <>
                        the <strong className="text-gray-800">selected</strong>{" "}
                        grade records ({selectedEntries.size})
                      </>
                    ) : isFilteredRollback ? (
                      <>
                        the <strong className="text-gray-800">filtered</strong>{" "}
                        grade records
                      </>
                    ) : (
                      <>
                        all grade records
                      </>
                    )}{" "}
                    uploaded by{" "}
                    <strong className="text-gray-800">{facultyName}</strong>{" "}
                    during this session.
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-800 text-xs space-y-1">
                    <p>
                      <strong>Session:</strong>{" "}
                      {formatDateTime(session.startedAt)}
                    </p>
                    <p>
                      <strong>Records to delete:</strong>{" "}
                      {isSelectiveRollback ? selectedEntries.size : total}
                    </p>
                    <p>
                      <strong>Term:</strong>{" "}
                      {academicYear.replace("AY_", "AY ").replace("_", "-")} /{" "}
                      {semester}
                    </p>
                    {isFilteredRollback && !isSelectiveRollback && (
                      <p>
                        <strong>Active filters:</strong>{" "}
                        {[
                          courseCodeFilter !== "all"
                            ? `Code: ${courseCodeFilter}`
                            : "",
                          courseTitleFilter !== "all"
                            ? `Title: ${courseTitleFilter}`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                    {isSelectiveRollback && (
                      <p>
                        <strong>Selected students/courses:</strong>{" "}
                        {selectedEntries.size} record
                        {selectedEntries.size !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  <p className="text-red-600 font-semibold">
                    This action cannot be undone.
                  </p>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="rollback-confirm-input"
                      className="text-xs font-medium"
                    >
                      Type{" "}
                      <code className="bg-gray-200 px-1 rounded">DELETE</code>{" "}
                      to confirm:
                    </Label>
                    <Input
                      id="rollback-confirm-input"
                      value={rollbackInput}
                      onChange={function (e) {
                        setRollbackInput(e.target.value);
                      }}
                      placeholder="Type DELETE to confirm"
                      className="h-9 text-sm"
                    />
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={function () {
                    setRollbackInput("");
                    setIsSelectiveRollback(false);
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                <Button
                  onClick={handleRollback}
                  disabled={rollbackInput !== "DELETE" || isRollingBack}
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white"
                >
                  {isRollingBack ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : isSelectiveRollback ? (
                    `Yes, Delete ${selectedEntries.size} Selected Record${selectedEntries.size !== 1 ? "s" : ""}`
                  ) : isFilteredRollback ? (
                    "Yes, Delete Filtered Records"
                  ) : (
                    "Yes, Delete All Records"
                  )}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* ── Filters bar ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Student search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search student name or number..."
            value={searchInput}
            onChange={handleSearchChange}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Course Code filter */}
        <div className="space-y-1 w-full sm:w-[200px]">
          <Label className="text-[11px] text-gray-500 uppercase tracking-wider">
            Course Code
          </Label>
          <Select
            value={courseCodeFilter}
            onValueChange={handleCourseCodeChange}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All Codes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Codes</SelectItem>
              {availableCourseCodes.map(function (code) {
                return (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Course Title filter */}
        <div className="space-y-1 w-full sm:w-[280px]">
          <Label className="text-[11px] text-gray-500 uppercase tracking-wider">
            Course Title
          </Label>
          <Select
            value={courseTitleFilter}
            onValueChange={handleCourseTitleChange}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All Titles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Titles</SelectItem>
              {availableCourseTitles.map(function (title) {
                return (
                  <SelectItem key={title} value={title}>
                    {title}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-amber-600 mt-5" />
        )}
      </div>

      {/* ── Grades Table ───────────────────────────────────────────────── */}
      {grades.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400 border border-dashed rounded-lg">
          <BookOpen className="h-5 w-5 mx-auto mb-2 text-gray-300" />
          No grade records found for this session.
          {courseCodeFilter !== "all" ||
          courseTitleFilter !== "all" ||
          search
            ? " Try adjusting your filters."
            : ""}
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50/80">
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allCurrentSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="w-[100px]">Student #</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead className="w-[100px]">Course Code</TableHead>
                  <TableHead>Course Title</TableHead>
                  <TableHead className="w-[72px] text-center">
                    Credits
                  </TableHead>
                  <TableHead className="w-[72px] text-center">Grade</TableHead>
                  <TableHead className="w-[120px]">Remarks</TableHead>
                  <TableHead className="w-[90px] text-center">Action</TableHead>
                  <TableHead className="w-[140px]">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map(function (g) {
                  const isSelected = selectedEntries.has(entryKey(g));
                  return (
                    <TableRow key={g.id} className="hover:bg-gray-50">
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={function () {
                            handleSelectRow(g);
                          }}
                          aria-label={`Select ${g.studentNumber} - ${g.studentName}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {g.studentNumber}
                      </TableCell>
                      <TableCell className="text-xs font-medium max-w-[160px] truncate">
                        {g.studentName}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-medium">
                        {g.courseCode}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {g.courseTitle}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {g.creditUnit}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={
                            "text-xs font-semibold px-1.5 py-0 " +
                            (g.grade === "INC" || g.grade === "DRP"
                              ? "bg-amber-100 text-amber-800 border-amber-200"
                              : g.grade === "5.00" ||
                                  g.grade === "FAILED" ||
                                  g.grade === "FDA"
                                ? "bg-red-100 text-red-800 border-red-200"
                                : "bg-green-100 text-green-800 border-green-200")
                          }
                        >
                          {g.grade}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 max-w-[120px] truncate">
                        {g.remarks ?? "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {g.action === "FAILED" ? (
                          <Badge className="bg-red-100 text-red-800 border-red-200 text-xs font-semibold px-1.5 py-0 flex items-center gap-1 w-fit mx-auto">
                            <AlertTriangle className="h-3 w-3" /> Failed
                          </Badge>
                        ) : g.action === "UPDATED" ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs font-semibold px-1.5 py-0 flex items-center gap-1 w-fit mx-auto">
                            <RefreshCw className="h-3 w-3" /> Updated
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs font-semibold px-1.5 py-0 flex items-center gap-1 w-fit mx-auto">
                            <CheckCircle2 className="h-3 w-3" /> Created
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-[11px] text-gray-400">
                        {formatDateTime(g.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* ── Pagination ────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <p className="text-xs text-gray-500">
              {total > 0
                ? `Showing ${rangeStart} to ${rangeEnd} of ${total} records`
                : "No records"}
            </p>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={function () {
                  setPage(function (p) {
                    return p - 1;
                  });
                }}
                disabled={page <= 1 || isLoading}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Prev
              </Button>

              <span className="text-xs px-2 text-gray-600">
                Page{" "}
                <strong>
                  {page} of {totalPages}
                </strong>
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={function () {
                  setPage(function (p) {
                    return p + 1;
                  });
                }}
                disabled={page >= totalPages || isLoading}
                aria-label="Next page"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>

              <Select
                value={String(pageSize)}
                onValueChange={function (val) {
                  setPageSize(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[100px] ml-2 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(function (size) {
                    return (
                      <SelectItem key={size} value={String(size)}>
                        Show {size}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
