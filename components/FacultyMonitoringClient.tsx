"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Loader2, CheckCircle2, XCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { getFacultyUploadStatus, FacultyUploadStatus } from "@/actions/faculty-monitoring";
import { AcademicYear, Semester } from "@prisma/client";

export function FacultyMonitoringClient() {
  const [academicYear, setAcademicYear] = useState<AcademicYear | "">("");
  const [semester, setSemester] = useState<Semester | "">("");
  const [data, setData] = useState<FacultyUploadStatus[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Calculate Academic Years
  const academicYears = useMemo(() => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const currentAyStartYear = currentMonth >= 6 ? currentYear : currentYear - 1;

    const startYear = 2018; // Admin start mapping
    const years: string[] = [];
    for (let y = startYear; y <= currentAyStartYear; y++) {
      years.push(`AY_${y}_${y + 1}`);
    }
    return years.reverse() as AcademicYear[];
  }, []);

  const fetchData = async () => {
    if (!academicYear || !semester) return;

    setIsLoading(true);
    try {
      const result = await getFacultyUploadStatus(academicYear, semester, currentPage, itemsPerPage);
      setData(result.data);
      setTotalRecords(result.total);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to page 1 when term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [academicYear, semester]);

  useEffect(() => {
    fetchData();
  }, [academicYear, semester, currentPage]);

  const handleExport = async () => {
    if (totalRecords === 0) return;
    setIsExporting(true);

    try {
      const fullResult = await getFacultyUploadStatus(
        academicYear as AcademicYear,
        semester as Semester,
        1,
        0
      );

      const exportData = fullResult.data.map(faculty => ({
        "Name": faculty.name,
        "Username": faculty.username,
        "Status": faculty.hasUploaded ? "Uploaded" : "Not Uploaded",
        "Records Uploaded": faculty.gradesUploadedCount
      }));

      const termLabel = `${academicYear.replace("AY_", "").replace("_", "-")} - ${semester}`;
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Upload Status");
      XLSX.writeFile(wb, `Faculty_Upload_Status_${academicYear}_${semester}.xlsx`);
    } catch (error) {
      console.error("Export failed", error);
    } finally {
      setIsExporting(false);
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(totalRecords / itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card className="border-t-4 border-t-amber-600 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Term Selection</CardTitle>
          <CardDescription>Select the academic term to view faculty upload statuses.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="academic-year">Academic Year</Label>
              <Select value={academicYear} onValueChange={(val) => setAcademicYear(val as AcademicYear)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select Academic Year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year.replace("AY_", "AY ").replace("_", "-")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="semester">Semester</Label>
              <Select value={semester} onValueChange={(val) => setSemester(val as Semester)}>
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
        </CardContent>
      </Card>

      {/* Results Area */}
      {academicYear && semester && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Faculty Status</CardTitle>
              <CardDescription>
                Showing data for {academicYear.replace("AY_", "AY ").replace("_", "-")}, {semester} Semester
              </CardDescription>
            </div>
            <Button onClick={handleExport} disabled={isLoading || isExporting || data.length === 0} className="bg-green-600 hover:bg-green-700 text-white">
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isExporting ? "Exporting..." : "Export to XLSX"}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>Loading faculty data...</p>
              </div>
            ) : data.length === 0 ? (
              <div className="text-center p-12 text-gray-500">
                No faculties found.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border mt-4">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead>Faculty Name</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Records Uploaded</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((faculty) => (
                        <TableRow key={faculty.id}>
                          <TableCell className="font-medium">{faculty.name}</TableCell>
                          <TableCell className="text-gray-500 text-xs">{faculty.username}</TableCell>
                          <TableCell>
                            {faculty.hasUploaded ? (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200 flex w-fit items-center gap-1 font-semibold">
                                <CheckCircle2 className="w-3 h-3" /> Uploaded
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-red-200 flex w-fit items-center gap-1 font-semibold">
                                <XCircle className="w-3 h-3" /> Not Uploaded
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {faculty.gradesUploadedCount > 0 ? faculty.gradesUploadedCount : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalRecords)} of {totalRecords} entries
                    </p>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }).map((_, i) => (
                          <Button
                            key={i}
                            variant={currentPage === i + 1 ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(i + 1)}
                          >
                            {i + 1}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(!academicYear || !semester) && (
        <div className="text-center p-12 border border-dashed rounded-xl bg-gray-50 text-gray-400">
          <p>Please select an Academic Year and Semester to view the upload statuses.</p>
        </div>
      )}
    </div>
  );
}
