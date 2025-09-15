"use client";

import { AlertCircle } from "lucide-react";

export default function ManualEntryGradeNotice() {
  return (
    <div className="w-full px-2 sm:px-0">
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 w-full">
          {/* Icon */}
          <div className="flex justify-center sm:justify-start">
            <AlertCircle className="h-6 w-6 sm:h-7 sm:w-7 text-amber-600 flex-shrink-0" />
          </div>

          {/* Content */}
          <div className="space-y-3 sm:space-y-4 flex-1 min-w-0">
            <h3 className="font-semibold text-amber-800 text-lg sm:text-xl md:text-2xl text-center sm:text-left leading-tight">
              Important: Excel File Requirements
            </h3>
            <p className="text-amber-700 text-sm sm:text-base md:text-lg text-center sm:text-left leading-relaxed">
              Please ensure your Excel file contains the following columns with
              accurate data:
            </p>

            {/* Bullet list */}
            <ul className="text-amber-700 text-sm sm:text-base md:text-lg space-y-3 sm:space-y-2 ml-0 sm:ml-4 list-none">
              {[
                {
                  title: "Student Number",
                  desc: "Must be correct and match student records",
                },
                {
                  title: "Last Name",
                  desc: "Student's last name (exact spelling)",
                },
                {
                  title: "First Name",
                  desc: "Student's first name (exact spelling)",
                },
                {
                  title: "Course Code",
                  desc: "Valid course code (e.g., CS101, MATH201)",
                },
                {
                  title: "Course Title",
                  desc: "Full course title",
                },
                {
                  title: "Credit Unit",
                  desc: "Number of credit units (0–5)",
                },
                {
                  title: "Grade",
                  desc: "Valid grade (1.00–5.00, INC, DRP, S, US)",
                },
                {
                  title: "Re Exam",
                  desc: "Re-exam details (optional)",
                },
                {
                  title: "Remarks",
                  desc: "PASSED, FAILED, DROPPED, or LACKING REQ",
                },
                {
                  title: "Instructor",
                  desc: "Instructor name",
                },
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 sm:gap-2 p-2 sm:p-0 rounded-md hover:bg-amber-100/50 transition-colors duration-200"
                >
                  <span className="mt-1.5 sm:mt-2 w-2 h-2 sm:w-1.5 sm:h-1.5 bg-amber-600 rounded-full flex-shrink-0" />
                  <span className="flex-1 min-w-0 leading-relaxed">
                    <strong className="text-amber-900">{item.title}</strong>
                    <span className="block sm:inline"> – {item.desc}</span>
                  </span>
                </li>
              ))}
            </ul>

            {/* Footer tip */}
            <div className="mt-4 sm:mt-3 p-4 sm:p-3 bg-amber-100 rounded-md border border-amber-200/50">
              <p className="text-amber-800 text-sm sm:text-base md:text-lg font-medium text-center sm:text-left leading-relaxed">
                <span className="inline-block mr-2 text-lg sm:text-base">
                  ⚠️
                </span>
                Double-check all data before uploading to avoid mismatches.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
