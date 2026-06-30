"use client";

import { AlertTriangle, Download, Mail, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GradeChangePolicyNoticeProps {
  /**
   * Context — which flow this notice appears in.
   * "upload" = bulk Excel upload tab
   * "manual" = manual single-entry tab
   */
  variant?: "upload" | "manual";
}

export default function GradeChangePolicyNotice({
  variant = "upload",
}: GradeChangePolicyNoticeProps) {
  const handleDownloadForm = () => {
    const link = document.createElement("a");
    link.href = "/api/download/grade-change-form";
    link.download = "UREG-QF-12-Request-for-Change-of-Grades.docx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 sm:p-4">
      <div className="flex items-start gap-2 sm:gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
        <div className="min-w-0 flex-1 space-y-3">
          <h3 className="font-semibold text-blue-800">
            Grade Change Policy — Required Steps
          </h3>

          <ol className="ml-1 list-inside list-decimal space-y-2 text-sm text-blue-700">
            <li className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
              <span>
                <strong>Download and complete</strong> the official UREG-QF-12
                Request for Change of Grades form below.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
              <span>
                <strong>Email the completed form</strong> to the
                Registrar&apos;s Office at{" "}
                <code className="rounded bg-blue-100 px-1 font-semibold text-blue-900">
                  cvsubacoor.registrar@cvsu.edu.ph
                </code>{" "}
                to submit your grade change request for approval.
              </span>
            </li>
            <li>
              <strong>Provide a reason</strong> for the grade change in the
              field below before uploading or submitting.
            </li>
          </ol>

          <div className="rounded-md bg-blue-100 p-3">
            <p className="text-sm font-medium text-blue-800">
              Grade changes will not be processed until the completed form is
              received and approved by the Registrar&apos;s Office.
            </p>
          </div>

          <div className="flex flex-col gap-2 border-t border-blue-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-blue-700">
              Download the official Grade Change Request Form:
            </p>
            <Button
              onClick={handleDownloadForm}
              variant="outline"
              size="sm"
              className="w-full border-blue-300 text-blue-700 hover:bg-blue-100 sm:w-auto"
            >
              <Download className="mr-1 h-4 w-4" />
              Download UREG-QF-12 Form (.docx)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
