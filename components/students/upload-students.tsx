"use client";

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { mutate } from "swr";
import { useState } from "react";
import type { Student } from "@prisma/client";
import { UploadCloudIcon, FileSpreadsheetIcon, EyeIcon, DownloadIcon } from "lucide-react";
import type { CreateStudentSchema } from "@/lib/formValidationSchemas";
import axios from "axios";

export default function UploadStudents() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [jsonData, setJsonData] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [duplicateStudents, setDuplicateStudents] = useState<
    CreateStudentSchema[]
  >([]);
  const [progress, setProgress] = useState(0);

  function resetUploadState() {
    setFile(null);
    setJsonData("");
  }

  const studentTemplateData = [
    {
      studentNumber: "202310001",
      firstName: "Juan",
      lastName: "Dela Cruz",
      middleInit: "S",
      email: "juan.delacruz@email.com",
      phone: "09123456789",
      address: "123 Rizal St, Manila",
      sex: "MALE",
      course: "BSIT",
      major: "NONE",
      status: "REGULAR",
    },
    {
      studentNumber: "202310002",
      firstName: "Maria",
      lastName: "Santos",
      middleInit: "L",
      email: "maria.santos@email.com",
      phone: "09987654321",
      address: "456 Bonifacio Ave, Quezon City",
      sex: "FEMALE",
      course: "BSBA",
      major: "MARKETING_MANAGEMENT",
      status: "REGULAR",
    },
  ];

  function handleDownloadTemplate() {
    const ws = XLSX.utils.json_to_sheet(studentTemplateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");

    const colWidths = [
      { wch: 15 }, // studentNumber
      { wch: 15 }, // firstName
      { wch: 15 }, // lastName
      { wch: 12 }, // middleInit
      { wch: 30 }, // email
      { wch: 14 }, // phone
      { wch: 35 }, // address
      { wch: 8 },  // sex
      { wch: 10 }, // course
      { wch: 28 }, // major
      { wch: 16 }, // status
    ];
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, "bulk-create-students-template.xlsx");
  }

  function previewData() {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        if (data) {
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const workSheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(workSheet, {
            raw: false,
            dateNF: "mmmm d, yyyy",
          });
          setJsonData(JSON.stringify(json, null, 2));
          console.error(JSON.stringify(json, null, 2));
        }
      };
      reader.readAsBinaryString(file);
    }
  }

  async function saveData() {
    if (!file) return;

    setLoading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },

        // ⭐ UPLOAD PROGRESS HERE
        onUploadProgress: (p) => {
          const percent = Math.round((p.loaded * 100) / (p.total || 1));
          setProgress(percent);
        },
      });

      const data = res.data;

      setLoading(false);
      setDialogOpen(false);
      toast.success("Data saved successfully");
      resetUploadState();

      if (data.duplicates && data.duplicates.length > 0) {
        setDuplicateStudents(data.duplicates);
        setAlertDialogOpen(true);
      }

      mutate("/api/students");

      // Auto download file if duplicates exist
      if (data.duplicates?.length > 0) {
        const blob = new Blob([data.file], { type: data.fileType });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "duplicates.xlsx";
        link.click();
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save data");
      resetUploadState();
      setLoading(false);
    }
  }

  return (
    <div className="sm:max-w-3xl lg:max-w-5xl">
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button className="bg-blue-700 hover:bg-blue-900">
            <UploadCloudIcon className="w-4 h-4 mr-2" />
            Upload Students
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Upload Student Data
            </DialogTitle>
            <DialogDescription>
              Upload multiple student information from an Excel file (.xls,
              .xlsx, .xlsm)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Template Download Notice */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-blue-700 text-sm">
                  Need the correct format? Download the template with sample
                  data and required columns.
                </p>
                <Button
                  onClick={handleDownloadTemplate}
                  variant="outline"
                  size="sm"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100 whitespace-nowrap"
                >
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </div>

            {/* File Upload Section */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <Label htmlFor="file-upload" className="text-sm font-medium">
                    Select Excel File
                  </Label>
                  <div className="flex items-center space-x-4">
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".xls,.xlsx,.xlsm"
                      onChange={(e) =>
                        setFile(e.target.files ? e.target.files[0] : null)
                      }
                      className="flex-1"
                    />
                    {file && (
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        <FileSpreadsheetIcon className="w-3 h-3" />
                        {file.name}
                      </Badge>
                    )}
                  </div>
                  {file && (
                    <Button
                      onClick={previewData}
                      variant="outline"
                      className="w-full bg-transparent"
                    >
                      <EyeIcon className="w-4 h-4 mr-2" />
                      Preview Data
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Data Preview Section */}
            {jsonData && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">Data Preview</Label>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="max-h-96 overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student Number</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Course</TableHead>
                              <TableHead>Major</TableHead>
                              <TableHead>Phone</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Birthday</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {JSON.parse(jsonData).map(
                              (student: Student, index: number) => (
                                <TableRow key={student.studentNumber || index}>
                                  <TableCell className="font-medium">
                                    {student.studentNumber}
                                  </TableCell>
                                  <TableCell>
                                    {student.firstName} {student?.middleInit}{" "}
                                    {student.lastName}
                                  </TableCell>
                                  <TableCell>{student.course}</TableCell>
                                  <TableCell>{student?.major || "—"}</TableCell>
                                  <TableCell>{student.phone}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        student.status === "REGULAR"
                                          ? "default"
                                          : "secondary"
                                      }
                                    >
                                      {student.status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              )
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loading State */}
            {loading && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">
                        Uploading file...
                      </Label>
                      <Badge variant="outline">{progress}%</Badge>
                    </div>

                    <Progress value={progress} />

                    <p className="text-sm text-muted-foreground text-center">
                      {progress < 100
                        ? `Uploading... ${progress}%`
                        : "Processing uploaded file..."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={saveData}
                disabled={loading || !file}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? "Saving..." : "Save Data"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog for Duplicates */}
      <AlertDialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Students Found</AlertDialogTitle>
            <AlertDialogDescription>
              The following students already exist in the system and were not
              added:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-60 overflow-y-auto">
            <div className="space-y-2">
              {duplicateStudents.map((student, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Student #: {student.studentNumber}
                    </p>
                  </div>
                  <Badge variant="destructive">Duplicate</Badge>
                </div>
              ))}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlertDialogOpen(false)}>
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
