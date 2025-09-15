import { AlertCircle, Download } from "lucide-react";
import React from "react";
import { Button } from "../ui/button";
import * as XLSX from "xlsx";
import { templateData } from "@/lib/templateSample";

export default function UploadGradeNotice() {
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet 1");

    const colWidths = [
      { wch: 15 }, // studentNumber
      { wch: 15 }, // lastName
      { wch: 15 }, // firstName
      { wch: 15 }, // middleInit
      { wch: 12 }, // courseCode
      { wch: 30 }, // courseTitle
      { wch: 10 }, // creditUnit
      { wch: 8 }, // grade
      { wch: 15 }, // reExam
      { wch: 12 }, // remarks
      { wch: 20 }, // instructor
    ];
    ws["!cols"] = colWidths;

    // Generate and download file
    XLSX.writeFile(wb, "upload-grades-format.xlsx");
  };
  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="space-y-3 flex-1">
          <h3 className="font-medium text-amber-800">
            Important: Excel File Requirements
          </h3>
          <p className="text-amber-700 text-sm">
            Please ensure your Excel file contains the following columns with
            accurate data:
          </p>
          <ul className="text-amber-700 text-sm space-y-1 ml-4">
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 bg-amber-600 rounded-full"></span>
              <strong>Student Number</strong> - Must be correct and match
              student records
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 bg-amber-600 rounded-full"></span>
              <strong>Last Name</strong> - Student&apos;s last name (exact
              spelling)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 bg-amber-600 rounded-full"></span>
              <strong>First Name</strong> - Student&apos;s first name (exact
              spelling)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 bg-amber-600 rounded-full"></span>
              <strong>Course Code</strong> - Valid course code (e.g., CS101,
              MATH201)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 bg-amber-600 rounded-full"></span>
              <strong>Course Title</strong> - Full course title
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 bg-amber-600 rounded-full"></span>
              <strong>Credit Unit</strong> - Number of credit units (0-5)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 bg-amber-600 rounded-full"></span>
              <strong>Grade</strong> - Grade value (1.00-5.00, INC, DRP, S, US)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 bg-amber-600 rounded-full"></span>
              <strong>Re Exam</strong> - Re-exam details (optional)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 bg-amber-600 rounded-full"></span>
              <strong>Remarks</strong> - PASSED, FAILED, DROPPED, or LACK OF REQ
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 bg-amber-600 rounded-full"></span>
              <strong>Instructor</strong> - Instructor name
            </li>
          </ul>
          <div className="mt-3 p-3 bg-amber-100 rounded-md">
            <p className="text-amber-800 text-sm font-medium">
              ⚠️ Double-check all data before uploading. Incorrect information
              may cause processing errors or data inconsistencies.
            </p>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-amber-200">
            <p className="text-amber-700 text-sm font-medium">
              Need the correct format? Download our template:
            </p>
            <Button
              onClick={handleDownloadTemplate}
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
