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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@clerk/nextjs";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// --- Validation Schema ---
const gradeRowSchema = z.object({
  studentNumber: z.union([z.string(), z.number()]).transform(String),
  courseCode: z.string().min(1),
  grade: z.union([z.string(), z.number()]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
}).passthrough(); // Allow other fields

const BATCH_SIZE = 50;

interface UploadResult {
  studentNumber?: string;
  courseCode: string;
  status: string;
  studentName?: string;
  identifier?: string;
}

interface LogEntry {
  type: 'success' | 'error' | 'warning';
  message: string;
  timestamp: Date;
}

export function UploadGrades() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const canUseLegacyMode = ["admin", "superuser", "registrar"].includes(role || "");

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // Legacy Mode State
  const [allowLegacy, setAllowLegacy] = useState(false);

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

  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Computed
  const totalPages = previewData ? Math.ceil(previewData.length / recordsPerPage) : 0;
  const paginatedData = previewData?.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  const totalResultPages = Math.ceil(uploadResults.length / recordsPerPage);

  const resetState = () => {
    setFile(null);
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
    } finally {
      setIsParsing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const addLog = (type: 'success' | 'error' | 'warning', message: string) => {
    setLogs(prev => [{ type, message, timestamp: new Date() }, ...prev]);
  };

  const handleDownloadLogs = () => {
    if (uploadResults.length === 0) return;

    const dataToExport = uploadResults.map(r => ({
      "Student Number": r.studentNumber || "",
      "Student Name": r.studentName || r.identifier || "",
      "Course Code": r.courseCode,
      "Status": r.status
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Upload Logs");
    XLSX.writeFile(wb, `Upload_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
    if (!file || !academicYear || !semester || !previewData) return;

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
        title: 'Validation Issues',
        text: `Found ${validationErrors} records with missing required fields (Student Number, Course Code, or Grade). These will likely fail. Continue?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, proceed',
        cancelButtonText: 'No, cancel'
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
        }));

        try {
          const res = await fetch("/api/upload-grades", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              grades: payload,
              validateOnly: isDryRun
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const errorText = await res.text();
            addLog("error", `Batch ${i + 1} Failed: ${res.statusText}`);
            // Push placeholder errors for this chunk
            setUploadResults(prev => [
              ...prev,
              ...chunk.map((item: any) => ({
                studentNumber: item.studentNumber,
                courseCode: item.courseCode,
                status: "❌ Batch Upload Failed",
                studentName: "Unknown"
              }))
            ]);
          } else {
            const result = await res.json();
            if (result.results) {
              setUploadResults((prev) => [...prev, ...result.results]);
              // Check for warnings/errors in the success response
              const failures = result.results.filter((r: any) => r.status.includes("❌"));
              const warnings = result.results.filter((r: any) => r.status.includes("⚠️"));
              const successes = result.results.filter((r: any) => r.status.includes("✅"));

              const parts = [];
              if (successes.length > 0) parts.push(`${successes.length} success`);
              if (warnings.length > 0) parts.push(`${warnings.length} warnings`);
              if (failures.length > 0) parts.push(`${failures.length} errors`);

              const message = `Batch ${i + 1}: ${parts.join(", ")}`;

              if (failures.length > 0) addLog("error", message);
              else if (warnings.length > 0) addLog("warning", message);
              else addLog("success", message);
            }
          }
        } catch (err: any) {
          if (err.name === 'AbortError') throw err;
          console.error(err);
          addLog("error", `Batch ${i + 1} Network Error`);
        }

        completed += chunk.length;
        setProcessedCount(completed);
        setProgress(Math.round((completed / totalRecords) * 100));
      }

      if (!controller.signal.aborted) {
        if (isDryRun) {
          setHasValidated(true);
          await Swal.fire({
            icon: "info",
            title: "Validation Complete",
            text: `checked ${totalRecords} records. Check the results tab for errors/warnings. No changes were made.`,
          });
        } else {
          await Swal.fire({
            icon: "success",
            title: "Processing Complete",
            text: `Processed ${totalRecords} records. Check the logs for details.`,
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

    const isAdminOrRegistrar = ["admin", "registrar"].includes(role || "");
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
    if (role === 'faculty') {
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

  return (
    <div className="space-y-6 mx-auto">
      {/* Configuration Card */}
      <Card className="border-t-4 border-t-blue-600 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            Upload Configuration
          </CardTitle>
          <CardDescription>Select the academic term for these grades before uploading.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="academic-year">Academic Year <span className="text-red-500">*</span></Label>
              <Select value={academicYear} onValueChange={setAcademicYear} disabled={isUploading}>
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
              <Label htmlFor="semester">Semester <span className="text-red-500">*</span></Label>
              <Select value={semester} onValueChange={setSemester} disabled={isUploading}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIRST" disabled>First Semester</SelectItem>
                  <SelectItem value="SECOND">Second Semester</SelectItem>
                  <SelectItem value="MIDYEAR" disabled>Midyear</SelectItem>
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
                onCheckedChange={(checked) => setAllowLegacy(checked as boolean)}
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
                  If checked, grades for subjects NOT in the current curriculum will be accepted (without curriculum linking). Use with caution.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <UploadGradeNotice />

      {/* Upload Area */}
      {(!file || isParsing) && (
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${!academicYear || !semester
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
                  Please select an Academic Year and Semester above to proceed with upload.
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
                  Excel files (.xlsx, .xls) only
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* File Preview & Action Area */}
      {file && previewData && (
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
                    <p className="font-medium truncate" title={file.name}>{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB • {totalRecords} Records</p>
                  </div>
                </div>

                {isUploading || isValidating ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>{isValidating ? "Validating..." : "Uploading..."}</span>

                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-center text-gray-500">
                      Processed {processedCount} of {totalRecords} rows
                    </p>
                    <Button variant="destructive" className="w-full" onClick={cancelUpload}>
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

                    <Button variant="outline" className="w-full" onClick={resetState}>
                      <RefreshCcw className="w-4 h-4 mr-2" /> Reset / New File
                    </Button>

                    {uploadResults.length > 0 && (
                      <Button variant="secondary" className="w-full" onClick={handleDownloadLogs}>
                        <FileSpreadsheet className="w-4 h-4 mr-2" /> Download Logs
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
                        <div key={i} className={`flex gap-2 ${log.type === 'error' ? 'text-red-600' :
                          log.type === 'warning' ? 'text-amber-600' : 'text-green-600'
                          }`}>
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
                  {isUploading || uploadResults.length > 0 ? "Upload Results" : "Data Preview"}
                </CardTitle>
                <CardDescription>
                  {isUploading || uploadResults.length > 0
                    ? "Real-time results of the upload process."
                    : `Previewing first ${Math.min(previewData.length, 50)} records of ${previewData.length}.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-[400px]">
                {isUploading || uploadResults.length > 0 ? (
                  // Results Tabs
                  <div className="flex flex-col">
                    <div className="bg-blue-50/50 p-2 mb-2 rounded text-xs text-center border border-blue-100 text-blue-800">
                      {hasValidated && !isUploading ? "Validation Mode: No changes were made to the database." : "Displaying latest results."}
                    </div>
                    <Tabs defaultValue="all" className="flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <TabsList>
                          <TabsTrigger value="all">All ({uploadResults.length})</TabsTrigger>
                          <TabsTrigger value="success">Success ({uploadResults.filter(r => !r.status.includes("❌")).length})</TabsTrigger>
                          <TabsTrigger value="failed" className="text-red-600 data-[state=active]:text-red-700">Failed ({uploadResults.filter(r => r.status.includes("❌")).length})</TabsTrigger>
                        </TabsList>
                      </div>

                      {["all", "success", "failed"].map((tabInfo) => {
                        const filtered = uploadResults.filter(r => {
                          if (tabInfo === "success") return !r.status.includes("❌");
                          if (tabInfo === "failed") return r.status.includes("❌");
                          return true;
                        });

                        // Calculate pagination for this specific tab
                        const totalPages = Math.ceil(filtered.length / recordsPerPage);
                        // Ensure current page is valid for this tab
                        const effectivePage = Math.min(Math.max(1, currentPage), totalPages || 1);

                        const currentTabRes = filtered.slice((effectivePage - 1) * recordsPerPage, effectivePage * recordsPerPage);

                        return (
                          <TabsContent key={tabInfo} value={tabInfo} className="flex flex-col mt-0">
                            <div className="border rounded-md flex-1 relative">
                              <Table>
                                <TableHeader className="bg-gray-50 sticky top-0">
                                  <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Course</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {currentTabRes.map((res, i) => (
                                    <TableRow key={i}>
                                      <TableCell className="text-xs font-semibold">
                                        {res.studentName || res.identifier || res.studentNumber || "Unknown"}
                                        <div className="text-xs text-gray-500">{res.studentNumber || "No Student #"}</div>
                                      </TableCell>
                                      <TableCell className="text-xs font-semibold">{res.courseCode}</TableCell>
                                      <TableCell className="text-xs font-semibold">
                                        {res.status.includes("✅") ? (
                                          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Success</Badge>
                                        ) : res.status.includes("⚠️") ? (
                                          <div className="flex items-center text-yellow-700 gap-1 text-xs font-medium">
                                            <AlertCircle className="w-4 h-4" />
                                            {res.status.replace("⚠️", "").trim()}
                                          </div>
                                        ) : (
                                          <div className="flex items-center text-red-600 gap-1 text-xs font-medium">
                                            <AlertCircle className="w-4 h-4" />
                                            {res.status.replace("❌", "").trim()}
                                          </div>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {filtered.length === 0 && (
                                    <TableRow>
                                      <TableCell colSpan={3} className="text-center py-8 text-gray-500">
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
                                    <ChevronLeft className="w-3 h-3" />
                                    <span className="sr-only">First</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={effectivePage === 1}
                                  >
                                    <ChevronLeft className="w-3 h-3" />
                                    <span className="sr-only">Previous</span>
                                  </Button>

                                  {/* Numbered Pages */
                                    (() => {
                                      let start = Math.max(1, effectivePage - 2);
                                      let end = Math.min(totalPages, start + 4);

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
                                          variant={effectivePage === p ? "default" : "outline"}
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
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
                                    <ChevronRight className="w-3 h-3" />
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
                            {previewData.length > 0 && Object.keys(previewData[0]).map(header => (
                              <TableHead key={header} className="text-xs px-2 py-1 h-8 whitespace-nowrap font-semibold">{header}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedData?.map((row, i) => (
                            <TableRow key={i} className="hover:bg-gray-50">
                              {Object.values(row).map((val: any, j) => (
                                <TableCell key={j} className="text-xs px-2 py-1 whitespace-nowrap">{val}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex justify-between items-center bg-gray-50 px-2 py-2 border-b">
                      <span className="text-xs text-gray-500">
                        Total Rows: {previewData.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="w-3 h-3" />
                          <span className="sr-only">First</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="w-3 h-3" />
                          <span className="sr-only">Previous</span>
                        </Button>

                        {/* Numbered Pages */
                          (() => {
                            let start = Math.max(1, currentPage - 2);
                            let end = Math.min(totalPages, start + 4);

                            // If close to end, adjust start to show up to 5 items
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
                                variant={currentPage === p ? "default" : "outline"}
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
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="w-3 h-3" />
                          <span className="sr-only">Next</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="w-3 h-3" />
                          <span className="sr-only">Last</span>
                        </Button>
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
