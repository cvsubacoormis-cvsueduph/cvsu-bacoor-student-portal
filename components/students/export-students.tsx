"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { allCourses } from "@/lib/utils";

interface ExportStudentsProps {
  query?: string;
  course?: string;
  status?: string;
}

export default function ExportStudents({
  query = "",
  course = "ALL",
  status = "ALL",
}: ExportStudentsProps) {
  const [open, setOpen] = useState(false);
  const [exportCourse, setExportCourse] = useState(course);
  const [exportStatus, setExportStatus] = useState(status);
  const [exportApproval, setExportApproval] = useState("ALL");
  const [isExporting, setIsExporting] = useState(false);

  // Reset filters to page defaults when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setExportCourse(course);
      setExportStatus(status);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append("query", query);
      if (exportCourse && exportCourse !== "ALL")
        params.append("course", exportCourse);
      if (exportStatus && exportStatus !== "ALL")
        params.append("status", exportStatus);
      if (exportApproval === "true") params.append("isApproved", "true");
      if (exportApproval === "false") params.append("isApproved", "false");

      const response = await fetch(
        `/api/students/export?${params.toString()}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || `Request failed with status ${response.status}`
        );
      }

      const { data, total, truncated, warning } = await response.json();

      if (!data || data.length === 0) {
        toast.error("No students found matching the selected filters.");
        return;
      }

      // Warn if results were capped by server limit
      if (truncated && warning) {
        toast(warning, {
          icon: "⚠️",
          duration: 6000,
        });
      }

      const exportData = data.map(
        (student: Record<string, unknown>) => ({
          "Student Number": student.studentNumber || "",
          "First Name": student.firstName || "",
          "Last Name": student.lastName || "",
          "Middle Initial": student.middleInit || "",
          Course: student.course || "",
          Major: student.major || "NONE",
          Status: student.status || "",
          Sex: student.sex || "",
          Email: student.email || "",
          Phone: student.phone || "",
          Address: student.address || "",
          Approved: student.isApproved ? "Yes" : "No",
          "Password Set": student.isPasswordSet ? "Yes" : "No",
          "Created At": student.createdAt
            ? new Date(student.createdAt as string).toLocaleDateString()
            : "",
        })
      );

      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for better readability
      const colWidths = [
        { wch: 15 }, // Student Number
        { wch: 15 }, // First Name
        { wch: 15 }, // Last Name
        { wch: 8 },  // Middle Initial
        { wch: 10 }, // Course
        { wch: 12 }, // Major
        { wch: 14 }, // Status
        { wch: 6 },  // Sex
        { wch: 25 }, // Email
        { wch: 15 }, // Phone
        { wch: 30 }, // Address
        { wch: 10 }, // Approved
        { wch: 12 }, // Password Set
        { wch: 12 }, // Created At
      ];
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Students");

      const courseLabel = exportCourse !== "ALL" ? exportCourse : "AllCourses";
      const approvalLabel =
        exportApproval === "true"
          ? "Approved"
          : exportApproval === "false"
          ? "Pending"
          : "AllApproval";
      const dateStr = new Date().toISOString().split("T")[0];
      const fileName = `Students_${courseLabel}_${approvalLabel}_${dateStr}.xlsx`;

      XLSX.writeFile(wb, fileName);
      toast.success(`${total} student(s) exported successfully.`);
      setOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to export students."
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-green-600 text-green-700 hover:bg-green-50 hover:text-green-800"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Students
          </DialogTitle>
          <DialogDescription>
            Select filters to export student data as an Excel file.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="export-course">Program / Course</Label>
            <Select value={exportCourse} onValueChange={setExportCourse}>
              <SelectTrigger id="export-course">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Courses</SelectItem>
                {allCourses.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="export-approval">Approval Status</Label>
            <Select value={exportApproval} onValueChange={setExportApproval}>
              <SelectTrigger id="export-approval">
                <SelectValue placeholder="Select approval status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="true">Activated (Approved)</SelectItem>
                <SelectItem value="false">Not Activated (Pending)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="export-status">Enrollment Status</Label>
            <Select value={exportStatus} onValueChange={setExportStatus}>
              <SelectTrigger id="export-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="REGULAR">Regular</SelectItem>
                <SelectItem value="IRREGULAR">Irregular</SelectItem>
                <SelectItem value="TRANSFEREE">Transferee</SelectItem>
                <SelectItem value="RETURNEE">Returnee</SelectItem>
                <SelectItem value="NOT_ANNOUNCED">Not Announced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export to Excel
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
