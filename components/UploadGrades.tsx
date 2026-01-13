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

  const resetState = () => {
    setFile(null);
    setPreviewData(null);
    setUploadResults([]);
    setLogs([]);
    setProgress(0);
    setProcessedCount(0);
    setTotalRecords(0);
    setIsUploading(false);
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

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsUploading(false);
      addLog("warning", "Upload cancelled by user.");
    }
  };

  const handleUpload = async () => {
    if (!file || !academicYear || !semester || !previewData) return;

    setIsUploading(true);
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
            body: JSON.stringify(payload),
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

              if (failures.length > 0) addLog("error", `Batch ${i + 1}: ${failures.length} errors`);
              else if (warnings.length > 0) addLog("warning", `Batch ${i + 1}: ${warnings.length} warnings`);
              else addLog("success", `Batch ${i + 1} uploaded successfully`);
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
        Swal.fire({
          icon: "success",
          title: "Processing Complete",
          text: `Processed ${totalRecords} records. Check the logs for details.`,
        });
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
    if (!allowLegacy) {
      // If legacy is NOT allowed, ONLY show current academic year
      const ayEnd = currentAyStartYear + 1;
      return [`AY_${currentAyStartYear}_${ayEnd}`];
    }

    // If legacy IS allowed, show from 2014 up to current
    const startYear = 2014;
    const years = [];
    for (let y = startYear; y <= currentAyStartYear; y++) {
      years.push(`AY_${y}_${y + 1}`);
    }
    return years.reverse(); // Show newest first usually looks better
  }, [allowLegacy, currentAyStartYear]);

  // Reset selection if it becomes invalid
  useEffect(() => {
    if (academicYear && !academicYears.includes(academicYear)) {
      setAcademicYear("");
    }
  }, [allowLegacy, academicYears, academicYear]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
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
                  <SelectValue placeholder="Select Year" />
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
                  <SelectItem value="FIRST">First Semester</SelectItem>
                  <SelectItem value="SECOND">Second Semester</SelectItem>
                  <SelectItem value="MIDYEAR">Midyear</SelectItem>
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
      {!file && (
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
                  Please select an Academic Year and Semester above to unlock upload.
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
          {/* Left Column: File Info & Actions */}
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

                {isUploading ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
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
                    <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleUpload}>
                      <Upload className="w-4 h-4 mr-2" /> Start Upload
                    </Button>
                    <Button variant="outline" className="w-full" onClick={resetState}>
                      <RefreshCcw className="w-4 h-4 mr-2" /> Reset / New File
                    </Button>
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
            <Card className="h-full flex flex-col">
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
              <CardContent className="flex-1 overflow-hidden min-h-[400px]">
                {isUploading || uploadResults.length > 0 ? (
                  // Results Table
                  <div className="h-full flex flex-col">
                    <div className="overflow-auto border rounded-md flex-1 relative">
                      <Table>
                        <TableHeader className="bg-gray-50 sticky top-0">
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Course</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {uploadResults.slice().reverse().map((res, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">
                                {res.studentName || res.identifier || res.studentNumber || "Unknown"}
                                <div className="text-xs text-gray-500">{res.studentNumber || "No Student #"}</div>
                              </TableCell>
                              <TableCell>{res.courseCode}</TableCell>
                              <TableCell>
                                {res.status.includes("✅") ? (
                                  <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Success</Badge>
                                ) : res.status.includes("⚠️") ? (
                                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200">Warning</Badge>
                                ) : (
                                  <div className="flex items-center text-red-600 gap-1 text-sm font-medium">
                                    <AlertCircle className="w-4 h-4" />
                                    {res.status.replace("❌", "").trim()}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          {uploadResults.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                                Waiting for results...
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  // Preview Table
                  <div className="h-full flex flex-col">
                    <div className="overflow-auto border rounded-md flex-1">
                      <Table>
                        <TableHeader className="bg-gray-50">
                          <TableRow>
                            {previewData.length > 0 && Object.keys(previewData[0]).slice(0, 5).map(header => (
                              <TableHead key={header}>{header}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedData?.map((row, i) => (
                            <TableRow key={i}>
                              {Object.values(row).slice(0, 5).map((val: any, j) => (
                                <TableCell key={j}>{val}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between pt-4">
                      <span className="text-sm text-gray-500">
                        Page {currentPage} of {totalPages}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        >
                          <ChevronRight className="w-4 h-4" />
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
