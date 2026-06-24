"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  getFacultyUploadStatus,
  getFacultyHistory,
  type FacultyUploadStatus,
  type FacultyUploadHistory,
  type UploadSession,
} from "@/actions/faculty-monitoring";
import { FacultyGradesDetailPanel } from "@/components/FacultyGradesDetailPanel";
import type { AcademicYear, Semester } from "@prisma/client";

// ── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "uploaded", label: "Uploaded" },
  { value: "not-uploaded", label: "Not Uploaded" },
] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function generateAcademicYears(): AcademicYear[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentAyStartYear = now.getMonth() >= 6 ? currentYear : currentYear - 1;

  const startYear = 2018;
  const years: string[] = [];
  for (let y = startYear; y <= currentAyStartYear; y++) {
    years.push("AY_" + y + "_" + (y + 1));
  }
  return years.reverse() as AcademicYear[];
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

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeOnly(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Props ───────────────────────────────────────────────────────────────────

interface FacultyMonitoringClientProps {
  data: FacultyUploadStatus[];
  total: number;
  page: number;
  pageSize: number;
  isFacultyView?: boolean;
  currentFacultyId?: string | null;
  canRollback?: boolean;
}

// ── Sub-component: Faculty History Panel ────────────────────────────────────

function FacultyHistoryPanel({
  facultyId,
  facultyName,
  academicYear,
  semester,
  isFacultyView,
  canRollback,
}: {
  facultyId: string;
  facultyName: string;
  academicYear: AcademicYear;
  semester: Semester;
  isFacultyView: boolean;
  canRollback: boolean;
}) {
  const [history, setHistory] = useState<FacultyUploadHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(
    null,
  );

  useEffect(function fetchHistory() {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getFacultyHistory(facultyId, academicYear, semester)
      .then(function (result) {
        if (!cancelled) {
          setHistory(result);
          setIsLoading(false);
        }
      })
      .catch(function (err) {
        if (!cancelled) {
          console.error("Failed to load faculty history", err);
          setError("Failed to load upload history.");
          setIsLoading(false);
        }
      });

    return function cleanup() {
      cancelled = true;
    };
  }, [facultyId, academicYear, semester]);

  // Reset expanded session when history reloads
  useEffect(
    function resetExpandOnHistoryChange() {
      setExpandedSessionId(null);
    },
    [history],
  );

  const toggleSession = useCallback(
    function (sessionId: string) {
      setExpandedSessionId(function (prev) {
        return prev === sessionId ? null : sessionId;
      });
    },
    [],
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading upload history...
      </div>
    );
  }

  if (error || !history) {
    return (
      <div className="py-4 text-sm text-red-500">
        {error ?? "Unable to load history."}
      </div>
    );
  }

  if (history.sessions.length === 0) {
    return (
      <div className="py-4 text-sm text-gray-400">
        No upload history found for {facultyName}.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Aggregate stats */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-gray-600">
          {formatAcademicYear(academicYear)}, {formatSemester(semester)}:{" "}
          {history.currentRecordsCount > 0 && (
            <>
              <strong className="text-blue-700">
                {history.currentRecordsCount} records
              </strong>{" "}
              &bull;{" "}
            </>
          )}
          <strong className="text-green-700">
            {history.totalCreatedAllTime} created
          </strong>{" "}
          &bull;{" "}
          <strong className="text-amber-600">
            {history.totalUpdatedAllTime} updated
          </strong>{" "}
          &bull;{" "}
          <strong className="text-red-600">
            {history.totalFailuresAllTime} failed
          </strong>{" "}
          &bull;{" "}
          <strong
            className={
              history.successRate >= 80 ? "text-green-700" : "text-amber-600"
            }
          >
            {history.successRate}% success rate
          </strong>
        </span>
        <span className="text-gray-400 text-xs">
          Last upload: {formatDateTime(history.lastUploadAt)}
        </span>
      </div>

      {/* Session table */}
      <div className="rounded-md border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50/80">
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="w-40">Date</TableHead>
              <TableHead className="w-16 text-center">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Created
                </span>
              </TableHead>
              <TableHead className="w-16 text-center">
                <span className="inline-flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 text-amber-500" />
                  Updated
                </span>
              </TableHead>
              <TableHead className="w-16 text-center">
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  Failed
                </span>
              </TableHead>
              <TableHead className="w-14 text-center">Total</TableHead>
              <TableHead className="text-right">Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.sessions.map(function (session) {
              const sRate =
                session.totalCount > 0
                  ? Math.round(
                      (session.successCount / session.totalCount) * 100,
                    )
                  : 0;
              const isExpanded = expandedSessionId === session.id;
              return (
                <React.Fragment key={session.id}>
                  <TableRow
                    className={
                      "cursor-pointer transition-colors " +
                      (isExpanded
                        ? "bg-blue-50/50 hover:bg-blue-50"
                        : "hover:bg-gray-50")
                    }
                    onClick={function () {
                      toggleSession(session.id);
                    }}
                  >
                    <TableCell>
                      <ChevronDown
                        className={
                          "h-4 w-4 text-gray-400 transition-transform " +
                          (isExpanded ? "rotate-180" : "")
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-gray-400 shrink-0" />
                        <div>
                          <div className="text-xs font-medium">
                            {formatDateOnly(session.startedAt)}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {formatTimeOnly(session.startedAt)}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-green-700 font-medium text-xs">
                      {session.createdCount}
                    </TableCell>
                    <TableCell className="text-center text-amber-600 font-medium text-xs">
                      {session.updatedCount}
                    </TableCell>
                    <TableCell className="text-center text-red-600 font-medium text-xs">
                      {session.failureCount}
                    </TableCell>
                    <TableCell className="text-center text-xs font-medium">
                      {session.totalCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          "text-xs font-semibold px-1.5 py-0.5 rounded " +
                          (sRate >= 80
                            ? "bg-green-50 text-green-700"
                            : sRate >= 50
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-700")
                        }
                      >
                        {sRate}%
                      </span>
                    </TableCell>
                  </TableRow>

                  {/* Expanded grades detail row */}
                  {isExpanded && (
                    <TableRow className="bg-blue-50/30 hover:bg-blue-50/30">
                      <TableCell colSpan={7} className="p-4">
                        <div className="pl-6">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Uploaded Grades &mdash; {facultyName} &mdash;{" "}
                            {formatDateOnly(session.startedAt)}{" "}
                            {formatTimeOnly(session.startedAt)}
                          </p>
                          <FacultyGradesDetailPanel
                            facultyId={facultyId}
                            facultyName={facultyName}
                            academicYear={academicYear}
                            semester={semester}
                            session={session}
                            isFacultyView={isFacultyView}
                            canRollback={canRollback}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function FacultyMonitoringClient({
  data,
  total,
  page,
  pageSize,
  isFacultyView = false,
  currentFacultyId = null,
  canRollback = !isFacultyView,
}: FacultyMonitoringClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const academicYear = (searchParams.get("academicYear") ?? "") as string;
  const semester = (searchParams.get("semester") ?? "") as string;
  const searchQuery = searchParams.get("search") ?? "";
  const statusFilter = (searchParams.get("status") ?? "all") as
    | "all"
    | "uploaded"
    | "not-uploaded";

  const hasTermSelected = academicYear !== "" && semester !== "";
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [searchInput, setSearchInput] = useState(searchQuery);
  const prevSearchQuery = useRef(searchQuery);

  useEffect(
    function syncSearchFromURL() {
      if (searchQuery !== prevSearchQuery.current) {
        setSearchInput(searchQuery);
        prevSearchQuery.current = searchQuery;
      }
    },
    [searchQuery],
  );

  const [isExporting, setIsExporting] = useState(false);
  const [expandedFacultyId, setExpandedFacultyId] = useState<string | null>(
    null,
  );

  const academicYears = useMemo(() => generateAcademicYears(), []);

  const toggleExpand = useCallback(function (id: string) {
    setExpandedFacultyId(function (prev) {
      return prev === id ? null : id;
    });
  }, []);

  // Reset expanded row when data changes (filters/pagination)
  useEffect(
    function resetExpandOnDataChange() {
      setExpandedFacultyId(null);
    },
    [data],
  );

  const updateURL = useCallback(
    function (updates: Record<string, string | number | null>) {
      const params = new URLSearchParams(searchParams.toString());

      const entries = Object.entries(updates);
      for (let i = 0; i < entries.length; i++) {
        const key = entries[i][0];
        const value = entries[i][1];
        if (value === null || value === "" || value === "all") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      }

      startTransition(function () {
        router.push(pathname + "?" + params.toString());
      });
    },
    [pathname, router, searchParams],
  );

  const handleTermChange = useCallback(
    function (field: "academicYear" | "semester", value: string) {
      const patch: Record<string, string | number | null> = { page: 1 };
      patch[field] = value;
      updateURL(patch);
    },
    [updateURL],
  );

  const debouncedSearch = useDebouncedCallback(
    function (value: string) {
      updateURL({ search: value || null, page: 1 });
    },
    400,
  );

  const handleSearchInputChange = useCallback(
    function (e: React.ChangeEvent<HTMLInputElement>) {
      const value = e.target.value;
      setSearchInput(value);
      debouncedSearch(value);
    },
    [debouncedSearch],
  );

  const handleStatusChange = useCallback(
    function (value: string) {
      updateURL({ status: value, page: 1 });
    },
    [updateURL],
  );

  const handlePageChange = useCallback(
    function (newPage: number) {
      updateURL({ page: newPage });
    },
    [updateURL],
  );

  const handlePageSizeChange = useCallback(
    function (newPageSize: number) {
      updateURL({ pageSize: newPageSize, page: 1 });
    },
    [updateURL],
  );

  const handleExport = useCallback(
    async function () {
      if (!hasTermSelected || isExporting || total === 0) return;

      setIsExporting(true);
      try {
        const result = await getFacultyUploadStatus({
          academicYear: academicYear as AcademicYear,
          semester: semester as Semester,
          page: 1,
          pageSize: 0,
        });

        const exportData = result.data.map(function (faculty) {
          return {
            Name: faculty.name,
            Username: faculty.username,
            Status: faculty.hasUploaded ? "Uploaded" : "Not Uploaded",
            "Records Uploaded": faculty.gradesUploadedCount,
          };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Upload Status");
        XLSX.writeFile(
          wb,
          "Faculty_Upload_Status_" + academicYear + "_" + semester + ".xlsx",
        );
      } catch (error) {
        console.error("Export failed", error);
      } finally {
        setIsExporting(false);
      }
    },
    [academicYear, hasTermSelected, isExporting, semester, total],
  );

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="space-y-6">
      {/* Term Selection Card */}
      <Card className="border-t-4 border-t-amber-600 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Term Selection</CardTitle>
          <CardDescription>
            Select the academic term to view faculty upload statuses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="academic-year">Academic Year</Label>
              <Select
                value={academicYear}
                onValueChange={function (val) {
                  handleTermChange("academicYear", val);
                }}
              >
                <SelectTrigger id="academic-year" className="h-10">
                  <SelectValue placeholder="Select Academic Year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map(function (year) {
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
              <Label htmlFor="semester">Semester</Label>
              <Select
                value={semester}
                onValueChange={function (val) {
                  handleTermChange("semester", val);
                }}
              >
                <SelectTrigger id="semester" className="h-10">
                  <SelectValue placeholder="Select Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIRST">First Semester</SelectItem>
                  <SelectItem value="SECOND">Second Semester</SelectItem>
                  <SelectItem value="MIDYEAR">Midyear</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Area */}
      {hasTermSelected ? (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>
                {isFacultyView ? "My Upload Status" : "Faculty Status"}
              </CardTitle>
              <CardDescription>
                {isFacultyView
                  ? `Showing your data for ${formatAcademicYear(academicYear)}, ${formatSemester(semester)} Semester`
                  : `Showing data for ${formatAcademicYear(academicYear)}, ${formatSemester(semester)} Semester`}
              </CardDescription>
            </div>
            {!isFacultyView && (
              <Button
                onClick={handleExport}
                disabled={isPending || isExporting || data.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {isExporting ? "Exporting..." : "Export to XLSX"}
              </Button>
            )}
          </CardHeader>

          {/* Filters bar */}
          <CardContent className="pb-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
                {!isFacultyView && (
                  <>
                    <div className="relative w-full sm:max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search by name or username..."
                        value={searchInput}
                        onChange={handleSearchInputChange}
                        className="pl-9 h-10"
                      />
                    </div>

                    <Select
                      value={statusFilter}
                      onValueChange={handleStatusChange}
                    >
                      <SelectTrigger className="h-10 w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(function (opt) {
                          return (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </>
                )}

              {isPending && (
                <Loader2 className="h-4 w-4 animate-spin text-amber-600 ml-2" />
              )}
            </div>
          </CardContent>

          <CardContent>
            {isPending ? (
              <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>Loading faculty data...</p>
              </div>
            ) : data.length === 0 ? (
              <div className="text-center p-12 text-gray-500">
                {total === 0 && searchQuery
                  ? "No faculties match your search criteria."
                  : total === 0 && statusFilter !== "all"
                    ? "No faculties match the selected status filter."
                    : "No faculties found."}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border mt-4">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Faculty Name</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map(function (faculty) {
                        const isExpanded = expandedFacultyId === faculty.id;
                        return (
                          <React.Fragment key={faculty.id}>
                            <TableRow
                              className={
                                "cursor-pointer transition-colors " +
                                (isExpanded
                                  ? "bg-amber-50/50 hover:bg-amber-50"
                                  : "hover:bg-gray-50")
                              }
                              onClick={function () {
                                toggleExpand(faculty.id);
                              }}
                            >
                              <TableCell>
                                <ChevronDown
                                  className={
                                    "h-4 w-4 text-gray-400 transition-transform " +
                                    (isExpanded ? "rotate-180" : "")
                                  }
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {faculty.name}
                              </TableCell>
                              <TableCell className="text-gray-500 text-xs">
                                {faculty.username}
                              </TableCell>
                              <TableCell>
                                {faculty.hasUploaded ? (
                                  <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200 flex w-fit items-center gap-1 font-semibold">
                                    <CheckCircle2 className="w-3 h-3" />{" "}
                                    Uploaded
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-red-200 flex w-fit items-center gap-1 font-semibold">
                                    <XCircle className="w-3 h-3" /> Not Uploaded
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>

                            {/* Expanded history row */}
                            {isExpanded && (
                              <TableRow className="bg-gray-50/70 hover:bg-gray-50/70">
                                <TableCell colSpan={4} className="p-4">
                                  <div className="pl-6">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                      Upload History &mdash; {faculty.name}
                                    </p>
                                    <FacultyHistoryPanel
                                      facultyId={faculty.id}
                                      facultyName={faculty.name}
                                      academicYear={academicYear as AcademicYear}
                                      semester={semester as Semester}
                                      isFacultyView={isFacultyView}
                                      canRollback={canRollback}
                                    />
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <p className="text-sm text-gray-500">
                    {total > 0
                      ? "Showing " +
                        rangeStart +
                        " to " +
                        rangeEnd +
                        " of " +
                        total +
                        " entries"
                      : "No entries"}
                  </p>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={function () {
                        handlePageChange(page - 1);
                      }}
                      disabled={page <= 1 || isPending}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Prev
                    </Button>

                    <span className="text-sm px-3 text-gray-600">
                      Page{" "}
                      <strong>
                        {page} of {totalPages}
                      </strong>
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={function () {
                        handlePageChange(page + 1);
                      }}
                      disabled={page >= totalPages || isPending}
                      aria-label="Next page"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>

                    <Select
                      value={String(pageSize)}
                      onValueChange={function (val) {
                        handlePageSizeChange(Number(val));
                      }}
                    >
                      <SelectTrigger className="h-9 w-[110px] ml-3">
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
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="text-center p-12 border border-dashed rounded-xl bg-gray-50 text-gray-400">
          <p>
            Please select an Academic Year and Semester to view the upload
            statuses.
          </p>
        </div>
      )}
    </div>
  );
}
