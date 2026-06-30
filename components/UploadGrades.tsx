"use client";

import React from "react";
import * as XLSX from "xlsx";
import { useState, useEffect, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  XCircle,
  RefreshCcw,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Swal from "sweetalert2";
import UploadGradeNotice from "./Notices/upload-grade-notice";
import GradeChangePolicyNotice from "./Notices/GradeChangePolicyNotice";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@clerk/nextjs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useUploadStatePersistence,
  type PersistedUploadState,
} from "@/hooks/use-upload-state-persistence";

// --- Validation Schema ---
const gradeRowSchema = z
  .object({
    studentNumber: z.union([z.string(), z.number()]).transform(String),
    courseCode: z.string().min(1),
    grade: z.union([z.string(), z.number()]),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  })
  .passthrough(); // Allow other fields

const BATCH_SIZE = 50;

interface UploadResult {
  studentNumber?: string;
  courseCode: string;
  status: string;
  studentName?: string;
  identifier?: string;
  matchQuality?: string; // "exact" | "fuzzy" | "warning" | "updated" | "error" | "unchanged"
}

type MatchQuality =
  | "exact"
  | "fuzzy"
  | "warning"
  | "updated"
  | "error"
  | "unchanged";

function getMatchQuality(result: UploadResult): MatchQuality {
  // Use explicit server-provided quality if available
  if (
    result.matchQuality &&
    ["exact", "fuzzy", "warning", "updated", "error", "unchanged"].includes(
      result.matchQuality,
    )
  ) {
    return result.matchQuality as MatchQuality;
  }
  // Fallback: derive from status string
  if (result.status.startsWith("❌")) return "error";
  if (
    result.status.includes("already exists") ||
    result.status.includes("no changes")
  )
    return "unchanged";
  if (result.status.startsWith("⚠️")) return "fuzzy";
  return "exact";
}

const QUALITY_CONFIG: Record<
  MatchQuality,
  { label: string; badgeClass: string; icon: typeof CheckCircle }
> = {
  exact: {
    label: "Saved",
    badgeClass:
      "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100",
    icon: CheckCircle,
  },
  fuzzy: {
    label: "Corrected",
    badgeClass:
      "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100",
    icon: AlertCircle,
  },
  warning: {
    label: "Needs Review",
    badgeClass:
      "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100",
    icon: AlertCircle,
  },
  updated: {
    label: "Updated",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100",
    icon: RefreshCcw,
  },
  error: {
    label: "Not Saved",
    badgeClass: "bg-red-100 text-red-800 border-red-200 hover:bg-red-100",
    icon: XCircle,
  },
  unchanged: {
    label: "Unchanged",
    badgeClass: "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100",
    icon: CheckCircle,
  },
};

interface LogEntry {
  type: "success" | "error" | "warning";
  message: string;
  timestamp: Date;
}

export function UploadGrades() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const canUseLegacyMode = ["admin", "superuser", "registrar", "registrar_staff"].includes(
    role || "",
  );

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // Legacy Mode State
  const [allowLegacy, setAllowLegacy] = useState(false);

  // Grade Change Reason — required for faculty when updating existing grades
  const [changeReason, setChangeReason] = useState("");
  const [reasonRequired, setReasonRequired] = useState(false);
  // Tracks whether any rows in the uploaded file would update existing grades
  const [hasUpdates, setHasUpdates] = useState(false);

  // Progress State
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);

  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [academicYear, setAcademicYear] = useState<string>("");
  const [semester, setSemester] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );

  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Persisted file metadata (file object can't be serialized)
  const [fileMeta, setFileMeta] = useState<{
    name: string;
    size: number;
  } | null>(null);

  // ── Upload State Persistence ────────────────────────────────────────────
  const {
    recoveredState,
    showRecoveryBanner,
    persistState,
    clearPersistedState,
    dismissRecovery,
    confirmRecovery,
  } = useUploadStatePersistence();

  // Computed
  const totalPages = previewData
    ? Math.ceil(previewData.length / recordsPerPage)
    : 0;
  const paginatedData = previewData?.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage,
  );

  const totalResultPages = Math.ceil(uploadResults.length / recordsPerPage);

  const resetState = () => {
    setFile(null);
    setFileMeta(null);
    setPreviewData(null);
    setUploadResults([]);
    setLogs([]);
    setProgress(0);
    setProcessedCount(0);
    setTotalRecords(0);
    setIsUploading(false);
    setIsValidating(false);
    setHasValidated(false);
    setAllowLegacy(false);
    setChangeReason("");
    setReasonRequired(false);
    setHasUpdates(false);
    clearPersistedState();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await processFile(selectedFile);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    await processFile(droppedFile);
  };

  const processFile = async (selectedFile: File) => {
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

    if (selectedFile.size > MAX_FILE_SIZE) {
      Swal.fire({
        icon: "error",
        title: "File Too Large",
        text: "Please upload a file smaller than 2MB.",
      });
      setFile(null);
      return;
    }

    const validTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel.sheet.macroEnabled.12",
    ];

    if (!validTypes.includes(selectedFile.type)) {
      Swal.fire({
        icon: "error",
        title: "Invalid File",
        text: "Please select a valid Excel file (.xls or .xlsx)",
      });
      return;
    }

    setFile(selectedFile);
    setFileMeta({ name: selectedFile.name, size: selectedFile.size });
    setIsParsing(true);
    setUploadResults([]);
    setLogs([]);
    setHasValidated(false);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      // Basic Validation of headers (optional, relying on row schema later)
      if (jsonData.length === 0) {
        throw new Error("File is empty");
      }

      setPreviewData(jsonData);
      setTotalRecords(jsonData.length);
    } catch (error) {
      console.error("Error parsing Excel file:", error);
      Swal.fire({
        icon: "error",
        title: "Parse Error",
        text: "Failed to parse Excel file. Please check the format.",
      });
      setFile(null);
      setFileMeta(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const addLog = (type: "success" | "error" | "warning", message: string) => {
    setLogs((prev) => [{ type, message, timestamp: new Date() }, ...prev]);
  };

  const handleDownloadLogs = () => {
    if (uploadResults.length === 0) return;

    const dataToExport = uploadResults.map((r) => ({
      "Student Number": r.studentNumber || "",
      "Student Name": r.studentName || r.identifier || "",
      "Course Code": r.courseCode,
      Status: r.status,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Upload Logs");
    XLSX.writeFile(
      wb,
      `Upload_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current.abort();
      setIsUploading(false);
      setIsValidating(false);
      addLog("warning", "Upload cancelled by user.");
    }
  };

  const handleUpload = async (isDryRun = false) => {
    if (!academicYear || !semester || !previewData || previewData.length === 0)
      return;

    // Validate change reason for faculty (required only when updating existing grades)
    if (role === "faculty" && !isDryRun && hasUpdates) {
      if (!changeReason.trim()) {
        setReasonRequired(true);
        Swal.fire({
          icon: "warning",
          title: "Reason Required",
          text: "Some rows in this file would update existing grades. As a faculty member, you must provide a reason for the grade changes. Please fill in the reason field below.",
        });
        return;
      }
      setReasonRequired(false);
    }

    if (isDryRun) {
      setIsValidating(true);
      setHasValidated(false); // Reset until done
    } else {
      setIsUploading(true);
    }

    setProgress(0);
    setProcessedCount(0);
    setUploadResults([]);
    setLogs([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Chunking Logic
    const chunks = [];
    for (let i = 0; i < previewData.length; i += BATCH_SIZE) {
      chunks.push(previewData.slice(i, i + BATCH_SIZE));
    }

    let completed = 0;
    let rateLimitExceeded = false;

    // Validate first
    // We can do client-side validation for all rows quickly before starting
    let validationErrors = 0;
    previewData.forEach((row, idx) => {
      const result = gradeRowSchema.safeParse(row);
      if (!result.success) {
        validationErrors++;
        // We could log specific errors but might be too noisy for large files
      }
    });

    if (validationErrors > 0) {
      const proceed = await Swal.fire({
        title: "Missing Information Detected",
        text: `${validationErrors} out of ${previewData.length} rows are missing a student number, course code, or grade. These rows will be skipped during upload.\n\nDo you want to continue with the remaining rows?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Continue Anyway",
        cancelButtonText: "Cancel",
      });

      if (!proceed.isConfirmed) {
        setIsUploading(false);
        setIsValidating(false);
        return;
      }
    }

    try {
      for (let i = 0; i < chunks.length; i++) {
        if (controller.signal.aborted) break;

        const chunk = chunks[i];
        const payload = chunk.map((item: any) => ({
          ...item,
          academicYear,
          semester,
          allowLegacy: canUseLegacyMode ? allowLegacy : false, // Security: only send true if authorized
          changeReason: hasUpdates ? (changeReason.trim() || undefined) : undefined,
        }));

        try {
          const res = await fetch("/api/upload-grades", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              grades: payload,
              validateOnly: isDryRun,
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            if (res.status === 429) {
              const errorData = await res.json().catch(() => ({}));
              Swal.fire({
                icon: "warning",
                title: "Too Many Uploads",
                text:
                  errorData.error ||
                  "You've reached the upload limit. Please wait about 15 minutes before trying again.",
              });
              addLog(
                "error",
                "Upload stopped — too many attempts. Please wait 15 minutes before trying again.",
              );
              rateLimitExceeded = true;
              break; // Abort remaining chunks
            }
            const errorText = await res.text();
            addLog("error", `Batch ${i + 1} Failed: ${res.statusText}`);
            // Push placeholder errors for this chunk
            setUploadResults((prev) => [
              ...prev,
              ...chunk.map((item: any) => ({
                studentNumber: item.studentNumber,
                courseCode: item.courseCode,
                status: "❌ Batch Upload Failed",
                studentName: "Unknown",
              })),
            ]);
          } else {
            const result = await res.json();
            if (result.results) {
              setUploadResults((prev) => [...prev, ...result.results]);
              // Check for warnings/errors in the success response
              const failures = result.results.filter((r: any) =>
                r.status.includes("❌"),
              );
              const warnings = result.results.filter((r: any) =>
                r.status.includes("⚠️"),
              );
              const successes = result.results.filter((r: any) =>
                r.status.includes("✅"),
              );

              const parts = [];
              if (successes.length > 0)
                parts.push(`${successes.length} saved`);
              if (warnings.length > 0)
                parts.push(`${warnings.length} with warnings`);
              if (failures.length > 0)
                parts.push(`${failures.length} failed`);

              const message = `Batch ${i + 1}: ${parts.join(" · ")}`;

              if (failures.length > 0) addLog("error", message);
              else if (warnings.length > 0) addLog("warning", message);
              else addLog("success", message);
            }
          }
        } catch (err: any) {
          if (err.name === "AbortError") throw err;
          console.error(err);
          addLog("error", `Batch ${i + 1}: Connection issue — please check your network and try again`);
        }

        completed += chunk.length;
        setProcessedCount(completed);
        setProgress(Math.round((completed / totalRecords) * 100));
      }

      if (!controller.signal.aborted && !rateLimitExceeded) {
        if (isDryRun) {
          setHasValidated(true);
          clearPersistedState(); // validation complete — clean up

          // Detect if any rows would update existing grades
          const updatedRows = uploadResults.filter(
            (r: UploadResult) =>
              r.matchQuality === "updated" ||
              r.status.includes("⏳ Pending approval")
          ).length;
          setHasUpdates(updatedRows > 0);

          const successes = uploadResults.filter((r: any) =>
            r.status.includes("✅"),
          ).length;
          const warnings = uploadResults.filter((r: any) =>
            r.status.includes("⚠️"),
          ).length;
          const failures = uploadResults.filter((r: any) =>
            r.status.includes("❌"),
          ).length;

          const summaryParts = [`${totalRecords} records checked.`];
          if (successes > 0)
            summaryParts.push(`${successes} would be saved without issues.`);
          if (warnings > 0)
            summaryParts.push(`${warnings} would be saved with corrections.`);
          if (failures > 0)
            summaryParts.push(`${failures} could not be processed.`);
          if (updatedRows > 0)
            summaryParts.push(`${updatedRows} would update existing grades and require a reason.`);
          summaryParts.push("No changes have been made to the database.");

          await Swal.fire({
            icon: "info",
            title: "Validation Complete",
            text: summaryParts.join(" "),
          });
        } else {
          clearPersistedState(); // upload complete — clean up

          const successes = uploadResults.filter((r: any) =>
            r.status.includes("✅"),
          ).length;
          const warnings = uploadResults.filter((r: any) =>
            r.status.includes("⚠️"),
          ).length;
          const failures = uploadResults.filter((r: any) =>
            r.status.includes("❌"),
          ).length;

          const summaryParts = [`${totalRecords} records processed.`];
          if (successes > 0)
            summaryParts.push(`${successes} saved successfully.`);
          if (warnings > 0)
            summaryParts.push(`${warnings} saved with corrections.`);
          if (failures > 0) summaryParts.push(`${failures} could not be saved.`);
          summaryParts.push(
            "Check the Results tab below for a detailed breakdown.",
          );

          await Swal.fire({
            icon: "success",
            title: "Upload Complete",
            text: summaryParts.join(" "),
          });
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        // Handled
      } else {
        console.error("Upload process failed:", error);
        Swal.fire({
          icon: "error",
          title: "System Error",
          text: "An unexpected error occurred during the upload process.",
        });
      }
    } finally {
      setIsUploading(false);
      setIsValidating(false);
      abortControllerRef.current = null;
    }
  };

  // Calculate Current Academic Year
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth(); // 0-11
  const currentYear = currentDate.getFullYear();
  // If Month is Jan-June (0-5), we are in the 2nd semester of previous year start
  // e.g., Jan 2026 is part of AY 2025-2026
  const currentAyStartYear = currentMonth >= 6 ? currentYear : currentYear - 1;

  const academicYears = React.useMemo(() => {
    // New curriculum starts in 2018 => Changed to 2025 for standard users per request
    // Admin/Registrar get 2014

    const isAdminOrRegistrar = ["admin", "superuser", "registrar", "registrar_staff"].includes(role || "");
    const standardStart = 2025;
    const adminStart = 2014;

    const baseStart = isAdminOrRegistrar ? adminStart : standardStart;

    // Legacy support (old curriculum) - adjust start year as needed, e.g., 2005
    const legacyStart = 2005;

    const startYear = allowLegacy ? legacyStart : baseStart;

    const years = [];
    for (let y = startYear; y <= currentAyStartYear; y++) {
      years.push(`AY_${y}_${y + 1}`);
    }

    // Faculty Restriction: Only Current Academic Year
    if (role === "faculty") {
      const currentAyString = `AY_${currentAyStartYear}_${currentAyStartYear + 1}`;
      return [currentAyString];
    }

    return years.reverse(); // Show newest first
  }, [allowLegacy, currentAyStartYear, role]);

  // Reset selection if it becomes invalid
  useEffect(() => {
    if (academicYear && !academicYears.includes(academicYear)) {
      setAcademicYear("");
    }
  }, [allowLegacy, academicYears, academicYear]);

  // ── Restore persisted state on mount ───────────────────────────────────
  useEffect(() => {
    if (!recoveredState) return;
    // Restore all serializable state
    setFileMeta({
      name: recoveredState.fileName,
      size: recoveredState.fileSize,
    });
    setPreviewData(recoveredState.previewData);
    setAcademicYear(recoveredState.academicYear);
    setSemester(recoveredState.semester);
    setAllowLegacy(recoveredState.allowLegacy);
    setUploadResults(recoveredState.uploadResults);
    setLogs(
      recoveredState.logs.map((l) => ({
        ...l,
        timestamp: new Date(l.timestamp),
      })),
    );
    setHasValidated(recoveredState.hasValidated);
    setProgress(recoveredState.progress);
    setProcessedCount(recoveredState.processedCount);
    setTotalRecords(recoveredState.totalRecords);
  }, [recoveredState]);

  // ── Persist state on meaningful changes ───────────────────────────────
  useEffect(() => {
    if (!previewData || previewData.length === 0) return;

    const snapshot: Partial<PersistedUploadState> = {
      previewData,
      academicYear,
      semester,
      allowLegacy,
      uploadResults,
      logs: logs.map((l) => ({
        type: l.type,
        message: l.message,
        timestamp: l.timestamp.toISOString(),
      })),
      hasValidated,
      progress,
      processedCount,
      totalRecords,
    };

    if (fileMeta) {
      snapshot.fileName = fileMeta.name;
      snapshot.fileSize = fileMeta.size;
    }

    persistState(snapshot);
  }, [
    previewData,
    academicYear,
    semester,
    allowLegacy,
    uploadResults,
    logs,
    hasValidated,
    progress,
    processedCount,
    totalRecords,
    fileMeta,
    persistState,
  ]);

  // ── Track window width reactively for responsive pagination ─────────
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Warn before leaving during active upload ───────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isUploading || isValidating) {
        e.preventDefault();
        // Modern browsers show a generic message regardless
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isUploading, isValidating]);

  return (
    <div className="space-y-6 mx-auto">
      {/* Configuration Card */}
      <Card className="border-t-4 border-t-blue-600 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            Upload Configuration
          </CardTitle>
          <CardDescription>
            Select the academic term for these grades before uploading.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="academic-year">
                Academic Year <span className="text-red-500">*</span>
              </Label>
              <Select
                value={academicYear}
                onValueChange={setAcademicYear}
                disabled={isUploading}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select Academic Year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((year: string) => (
                    <SelectItem key={year} value={year}>
                      {year.replace("AY_", "AY ").replace("_", "-")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="semester">
                Semester <span className="text-red-500">*</span>
              </Label>
              <Select
                value={semester}
                onValueChange={setSemester}
                disabled={isUploading}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIRST" disabled={role === "faculty"}>
                    First Semester
                  </SelectItem>
                  <SelectItem value="SECOND">Second Semester</SelectItem>
                  <SelectItem value="MIDYEAR" disabled>
                    Midyear
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Legacy Mode Checkbox - Only for authorized roles */}
          {canUseLegacyMode && (
            <div className="mt-4 flex items-center space-x-2 p-4 bg-amber-50 border border-amber-200 rounded-md">
              <Checkbox
                id="legacy-mode"
                checked={allowLegacy}
                onCheckedChange={(checked) =>
                  setAllowLegacy(checked as boolean)
                }
                disabled={isUploading}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="legacy-mode"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-amber-900"
                >
                  Allow Legacy / Unmatched Subjects
                </label>
                <p className="text-xs text-amber-700">
                  If checked, grades for subjects NOT in the current curriculum
                  will be accepted (without curriculum linking). Use with
                  caution.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <UploadGradeNotice />

      {/* Grade Change Policy Notice — for faculty before uploading */}
      {role === "faculty" && <GradeChangePolicyNotice variant="upload" />}

      {/* Recovery Banner — shown when previous upload state is detected */}
      {showRecoveryBanner && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900">
            Previous session recovered
          </AlertTitle>
          <AlertDescription className="text-amber-700">
            <p className="mb-2">
              We found an unsaved upload session from{" "}
              {recoveredState?.timestamp
                ? new Date(recoveredState.timestamp).toLocaleString()
                : "earlier"}
              . Your file, settings, and results have been restored.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-900 hover:bg-amber-100"
                onClick={confirmRecovery}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Keep Session
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-900 hover:bg-amber-100"
                onClick={dismissRecovery}
              >
                Dismiss
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={resetState}
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Start Fresh
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Area */}
      {((!file && !fileMeta) || isParsing) && (
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
            !academicYear || !semester
              ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
              : "border-blue-200 bg-blue-50/50 hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
          }`}
          onDrop={!academicYear || !semester ? undefined : handleDrop}
          onDragOver={!academicYear || !semester ? undefined : handleDragOver}
          onClick={
            !academicYear || !semester
              ? undefined
              : () => document.getElementById("file-input")?.click()
          }
        >
          <input
            id="file-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            disabled={!academicYear || !semester}
          />

          {!academicYear || !semester ? (
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-gray-100">
                <Upload className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-600">
                  Configuration Required
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Please select an Academic Year and Semester above to proceed
                  with upload.
                </p>
              </div>
            </div>
          ) : isParsing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
              <p className="font-medium text-blue-600">Parsing Excel File...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-blue-100 shadow-sm">
                <Upload className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-700">
                  Click to Upload or Drag & Drop
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Excel files (.xlsx, .xls) up to 2MB
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* File Preview & Action Area */}
      {(file || fileMeta) && previewData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* File Info & Actions */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>File Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <div className="overflow-hidden">
                    <p
                      className="font-medium truncate"
                      title={file?.name ?? fileMeta?.name}
                    >
                      {file?.name ?? fileMeta?.name ?? "Unknown"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {((file?.size ?? fileMeta?.size ?? 0) / 1024).toFixed(1)}{" "}
                      KB • {totalRecords} Records
                    </p>
                  </div>
                </div>

                {/* Change Reason — only shown when faculty is updating existing grades */}
                {role === "faculty" && hasUpdates && (
                  <div className="space-y-2">
                    <Label htmlFor="change-reason" className="text-sm font-medium">
                      Reason for Grade Change{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="change-reason"
                      placeholder="Explain why the grades need to be changed (e.g., correction of encoding error, late submission, re-evaluation result, etc.)"
                      value={changeReason}
                      onChange={(e) => {
                        setChangeReason(e.target.value);
                        if (e.target.value.trim()) setReasonRequired(false);
                      }}
                      rows={3}
                      disabled={isUploading || isValidating}
                      className={
                        reasonRequired && !changeReason.trim()
                          ? "border-red-400 focus-visible:ring-red-400"
                          : ""
                      }
                    />
                    {reasonRequired && !changeReason.trim() && (
                      <p className="text-xs text-red-500">
                        A reason is required when updating existing grades.
                      </p>
                    )}
                  </div>
                )}

                {isUploading || isValidating ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>
                        {isValidating ? "Validating..." : "Uploading..."}
                      </span>

                      <span className="font-medium text-green-600">
                        {progress}%
                      </span>
                    </div>
                    <Progress
                      value={progress}
                      className="h-2 [&>span]:bg-green-600"
                    />
                    <p className="text-xs text-center text-gray-500">
                      Processed {processedCount} of {totalRecords} rows
                    </p>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={cancelUpload}
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                        onClick={() => handleUpload(true)}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" /> Validate
                      </Button>
                      <Button
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleUpload(false)}
                        disabled={!hasValidated}
                      >
                        <Upload className="w-4 h-4 mr-2" /> Upload
                      </Button>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={resetState}
                    >
                      <RefreshCcw className="w-4 h-4 mr-2" /> Reset / New File
                    </Button>

                    {uploadResults.length > 0 && (
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={handleDownloadLogs}
                      >
                        <FileSpreadsheet className="w-4 h-4 mr-2" /> Download
                        Logs
                      </Button>
                    )}
                  </div>
                )}

                {/* Mini Logs */}
                {logs.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-medium mb-2">Activity Log</h4>
                    <div className="max-h-[200px] overflow-y-auto text-xs space-y-1 bg-gray-50 p-2 rounded border">
                      {logs.map((log, i) => (
                        <div
                          key={i}
                          className={`flex gap-2 ${
                            log.type === "error"
                              ? "text-red-600"
                              : log.type === "warning"
                                ? "text-amber-600"
                                : "text-green-600"
                          }`}
                        >
                          <span>•</span>
                          <span>{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Data Preview / Results */}
          <div className="lg:col-span-2">
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>
                  {isUploading || uploadResults.length > 0
                    ? "Upload Results"
                    : "Data Preview"}
                </CardTitle>
                <CardDescription>
                  {isUploading || uploadResults.length > 0
                    ? "Detailed results from the upload process — use the tabs to filter by status."
                    : `Previewing first ${Math.min(previewData.length, 50)} records of ${previewData.length}.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-[400px]">
                {isUploading || uploadResults.length > 0 ? (
                  // Results Tabs
                  <div className="flex flex-col">
                    <div className="bg-blue-50/50 p-2 mb-2 rounded text-xs text-center border border-blue-100 text-blue-800">
                      {hasValidated && !isUploading
                        ? "Validation mode — no changes were saved to the database. Review results below, then click Upload to save."
                        : "Results are updated in real time as each batch is processed."}
                    </div>

                    {/* Summary Bar */}
                    <div className="flex flex-wrap gap-2 mb-3 p-2 bg-gray-50 rounded border">
                      {(
                        [
                          "exact",
                          "fuzzy",
                          "warning",
                          "updated",
                          "error",
                          "unchanged",
                        ] as MatchQuality[]
                      ).map((q) => {
                        const count = uploadResults.filter(
                          (r) => getMatchQuality(r) === q,
                        ).length;
                        if (count === 0) return null;
                        const config = QUALITY_CONFIG[q];
                        const Icon = config.icon;
                        return (
                          <Badge
                            key={q}
                            variant="outline"
                            className={`text-xs gap-1 ${config.badgeClass}`}
                          >
                            <Icon className="w-3 h-3" />
                            {config.label}: {count}
                          </Badge>
                        );
                      })}
                    </div>

                    <Tabs defaultValue="all" className="flex flex-col">
                      <div className="flex items-center justify-between mb-4 overflow-x-auto">
                        <TabsList className="flex-wrap h-auto gap-0.5 p-0.5">
                          <TabsTrigger
                            value="all"
                            className="text-xs px-2 py-1"
                          >
                            All ({uploadResults.length})
                          </TabsTrigger>
                          <TabsTrigger
                            value="exact"
                            className="text-xs px-2 py-1"
                          >
                            Saved (
                            {
                              uploadResults.filter(
                                (r) => getMatchQuality(r) === "exact",
                              ).length
                            }
                            )
                          </TabsTrigger>
                          <TabsTrigger
                            value="fuzzy"
                            className="text-xs px-2 py-1"
                          >
                            Corrected (
                            {
                              uploadResults.filter(
                                (r) => getMatchQuality(r) === "fuzzy",
                              ).length
                            }
                            )
                          </TabsTrigger>
                          <TabsTrigger
                            value="warning"
                            className="text-xs px-2 py-1"
                          >
                            Needs Review (
                            {
                              uploadResults.filter(
                                (r) => getMatchQuality(r) === "warning",
                              ).length
                            }
                            )
                          </TabsTrigger>
                          <TabsTrigger
                            value="updated"
                            className="text-xs px-2 py-1"
                          >
                            Updated (
                            {
                              uploadResults.filter(
                                (r) => getMatchQuality(r) === "updated",
                              ).length
                            }
                            )
                          </TabsTrigger>
                          <TabsTrigger
                            value="error"
                            className="text-xs px-2 py-1 text-red-600 data-[state=active]:text-red-700"
                          >
                            Not Saved (
                            {
                              uploadResults.filter(
                                (r) => getMatchQuality(r) === "error",
                              ).length
                            }
                            )
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      {(
                        [
                          "all",
                          "exact",
                          "fuzzy",
                          "warning",
                          "updated",
                          "error",
                        ] as const
                      ).map((tabInfo) => {
                        const filtered = uploadResults.filter((r) => {
                          if (tabInfo === "all") return true;
                          return getMatchQuality(r) === tabInfo;
                        });

                        // Calculate pagination for this specific tab
                        const totalPages = Math.ceil(
                          filtered.length / recordsPerPage,
                        );
                        // Ensure current page is valid for this tab
                        const effectivePage = Math.min(
                          Math.max(1, currentPage),
                          totalPages || 1,
                        );

                        const currentTabRes = filtered.slice(
                          (effectivePage - 1) * recordsPerPage,
                          effectivePage * recordsPerPage,
                        );

                        return (
                          <TabsContent
                            key={tabInfo}
                            value={tabInfo}
                            className="flex flex-col mt-0"
                          >
                            <div className="border rounded-md flex-1 relative">
                              <Table>
                                <TableHeader className="bg-gray-50 sticky top-0">
                                  <TableRow>
                                    <TableHead className="text-xs">
                                      Quality
                                    </TableHead>
                                    <TableHead className="text-xs">
                                      Student
                                    </TableHead>
                                    <TableHead className="text-xs">
                                      Course
                                    </TableHead>
                                    <TableHead className="text-xs">
                                      Status
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {currentTabRes.map((res, i) => {
                                    const quality = getMatchQuality(res);
                                    const config = QUALITY_CONFIG[quality];
                                    const Icon = config.icon;
                                    return (
                                      <TableRow key={i}>
                                        <TableCell>
                                          <Badge
                                            variant="outline"
                                            className={`text-[10px] gap-0.5 px-1.5 py-0 ${config.badgeClass}`}
                                          >
                                            <Icon className="w-2.5 h-2.5" />
                                            {config.label}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs font-semibold">
                                          {res.studentName ||
                                            res.identifier ||
                                            res.studentNumber ||
                                            "Unknown"}
                                          <div className="text-[10px] text-gray-500">
                                            {res.studentNumber ||
                                              "No Student #"}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-xs font-semibold">
                                          {res.courseCode}
                                        </TableCell>
                                        <TableCell className="text-[11px] leading-tight max-w-[220px]">
                                          {res.status
                                            .replace(/^[✅⚠️❌]\s*/, "")
                                            .trim()}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                  {filtered.length === 0 && (
                                    <TableRow>
                                      <TableCell
                                        colSpan={4}
                                        className="text-center py-8 text-gray-500"
                                      >
                                        No results in this category.
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>

                            {/* Pagination for this tab */}
                            {filtered.length > 0 && (
                              <div className="flex justify-between items-center bg-gray-50 px-2 py-2 border-t">
                                <span className="text-xs text-gray-500">
                                  Total: {filtered.length}
                                </span>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => setCurrentPage(1)}
                                    disabled={effectivePage === 1}
                                  >
                                    <ChevronsLeft className="w-3 h-3" />
                                    <span className="sr-only">First</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() =>
                                      setCurrentPage((p) => Math.max(1, p - 1))
                                    }
                                    disabled={effectivePage === 1}
                                  >
                                    <ChevronLeft className="w-3 h-3" />
                                    <span className="sr-only">Previous</span>
                                  </Button>

                                  {/* Numbered Pages */}
                                  {(() => {
                                    let start = Math.max(1, effectivePage - 2);
                                    const end = Math.min(totalPages, start + 4);

                                    if (end - start < 4) {
                                      start = Math.max(1, end - 4);
                                    }

                                    const pages = [];
                                    for (let i = start; i <= end; i++) {
                                      pages.push(i);
                                    }

                                    return pages.map((p) => (
                                      <Button
                                        key={p}
                                        variant={
                                          effectivePage === p
                                            ? "default"
                                            : "outline"
                                        }
                                        size="sm"
                                        className="h-7 w-7 p-0 text-xs"
                                        onClick={() => setCurrentPage(p)}
                                      >
                                        {p}
                                      </Button>
                                    ));
                                  })()}

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() =>
                                      setCurrentPage((p) =>
                                        Math.min(totalPages, p + 1),
                                      )
                                    }
                                    disabled={effectivePage === totalPages}
                                  >
                                    <ChevronRight className="w-3 h-3" />
                                    <span className="sr-only">Next</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={effectivePage === totalPages}
                                  >
                                    <ChevronsRight className="w-3 h-3" />
                                    <span className="sr-only">Last</span>
                                  </Button>
                                </div>
                              </div>
                            )}
                          </TabsContent>
                        );
                      })}
                    </Tabs>
                  </div>
                ) : (
                  // Preview Table
                  <div className="flex flex-col">
                    <div className="border rounded-md flex-1">
                      <Table>
                        <TableHeader className="bg-gray-50">
                          <TableRow>
                            {previewData.length > 0 &&
                              Object.keys(previewData[0]).map((header) => (
                                <TableHead
                                  key={header}
                                  className="text-xs px-2 py-1 h-8 whitespace-nowrap font-semibold"
                                >
                                  {header}
                                </TableHead>
                              ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedData?.map((row, i) => (
                            <TableRow key={i} className="hover:bg-gray-50">
                              {Object.values(row).map((val: any, j) => (
                                <TableCell
                                  key={j}
                                  className="text-xs px-2 py-1 whitespace-nowrap"
                                >
                                  {val}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 bg-gray-50 px-2 py-2 border-b">
                      {/* Total Rows */}
                      <span className="text-xs text-gray-500 text-center sm:text-left">
                        Total Rows: {previewData.length}
                      </span>

                      {/* Pagination Controls */}
                      <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                        {/* Nav Buttons */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 sm:h-7 sm:w-7 p-0"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                          >
                            <ChevronsLeft className="w-4 h-4 sm:w-3 sm:h-3" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 sm:h-7 sm:w-7 p-0"
                            onClick={() =>
                              setCurrentPage((p) => Math.max(1, p - 1))
                            }
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="w-4 h-4 sm:w-3 sm:h-3" />
                          </Button>
                        </div>

                        {/* Page Numbers */}
                        <div className="flex flex-wrap justify-center gap-1 max-w-full">
                          {(() => {
                            let start = Math.max(1, currentPage - 1);
                            const maxVisible = windowWidth < 640 ? 2 : 4;
                            const end = Math.min(
                              totalPages,
                              start + maxVisible,
                            );

                            if (end - start < maxVisible) {
                              start = Math.max(1, end - maxVisible);
                            }

                            const pages = [];
                            for (let i = start; i <= end; i++) {
                              pages.push(i);
                            }

                            return pages.map((p) => (
                              <Button
                                key={p}
                                variant={
                                  currentPage === p ? "default" : "outline"
                                }
                                size="sm"
                                className="h-8 min-w-[32px] sm:h-7 sm:min-w-[28px] px-1 text-xs"
                                onClick={() => setCurrentPage(p)}
                              >
                                {p}
                              </Button>
                            ));
                          })()}
                        </div>

                        {/* Nav Buttons */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 sm:h-7 sm:w-7 p-0"
                            onClick={() =>
                              setCurrentPage((p) => Math.min(totalPages, p + 1))
                            }
                            disabled={currentPage === totalPages}
                          >
                            <ChevronRight className="w-4 h-4 sm:w-3 sm:h-3" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 sm:h-7 sm:w-7 p-0"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                          >
                            <ChevronsRight className="w-4 h-4 sm:w-3 sm:h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
