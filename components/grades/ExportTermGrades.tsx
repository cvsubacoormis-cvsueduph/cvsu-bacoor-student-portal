"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircleIcon,
  Download,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { COG_GENERATION_ROLES } from "@/lib/cog-roles";
import { formatAcademicYear } from "@/lib/grade-utils";
import { semesterMap } from "@/lib/utils";

/**
 * Academic terms as returned by /api/academic-terms.
 * `academicYear` is a Prisma enum value such as "AY_2024_2025".
 */
type AcademicTerm = {
  academicYear: string;
  semester: string;
};

/**
 * Toolbar control that downloads every grade record for one academic year and
 * semester as an .xlsx in the bulk-upload template format.
 *
 * Rendered only for admin/registrar — the server enforces the same gate, so
 * this is a UX affordance rather than the security boundary.
 */
export function ExportTermGrades() {
  const { user, isLoaded } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;

  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [isLoadingTerms, setIsLoadingTerms] = useState(false);
  const [academicYear, setAcademicYear] = useState("");
  const [semester, setSemester] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Fetch the available terms lazily, the first time the dialog opens.
  useEffect(() => {
    if (!open || terms.length > 0) return;

    let cancelled = false;
    setIsLoadingTerms(true);

    fetch("/api/academic-terms")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: AcademicTerm[]) => {
        if (!cancelled) setTerms(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load academic terms.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTerms(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, terms.length]);

  const academicYears = useMemo(
    () => [...new Set(terms.map((t) => t.academicYear))],
    [terms],
  );

  const semesterOptions = useMemo(
    () =>
      academicYear
        ? [
            ...new Set(
              terms
                .filter((t) => t.academicYear === academicYear)
                .map((t) => t.semester),
            ),
          ]
        : [],
    [terms, academicYear],
  );

  const resetSelections = () => {
    setAcademicYear("");
    setSemester("");
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) resetSelections();
  };

  const handleExport = async () => {
    if (!academicYear || !semester) return;

    setIsExporting(true);
    try {
      const params = new URLSearchParams({ academicYear, semester });
      const res = await fetch(`/api/grades/export?${params.toString()}`);

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to export grades.");
      }

      const blob = await res.blob();

      // Prefer the server-provided filename so it stays in sync with the API.
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const fileName =
        match?.[1] ?? `Grades_${academicYear}_${semester}.xlsx`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      // Confirm the row count so a complete export is distinguishable from a
      // partial one at a glance.
      const rowCount = res.headers.get("X-Export-Row-Count");
      toast.success(
        rowCount
          ? `${Number(rowCount).toLocaleString()} grade rows exported.`
          : "Grades exported successfully.",
      );
      setOpen(false);
      resetSelections();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to export grades. Please try again.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Don't render for roles that can't export — the API rejects them anyway.
  if (!isLoaded || !role || !COG_GENERATION_ROLES.includes(role as never)) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-green-600 text-green-700 hover:bg-green-50 hover:text-green-800"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export Grades
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Grades
          </DialogTitle>
          <DialogDescription>
            Download all grades for one academic year and semester as an Excel
            file.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="export-academic-year">Academic Year</Label>
            <Select
              value={academicYear}
              onValueChange={(v) => {
                setAcademicYear(v);
                setSemester("");
              }}
              disabled={isLoadingTerms}
            >
              <SelectTrigger id="export-academic-year">
                <SelectValue
                  placeholder={
                    isLoadingTerms ? "Loading terms..." : "Select academic year"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {formatAcademicYear(year)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="export-semester">Semester</Label>
            <Select
              value={semester}
              onValueChange={setSemester}
              disabled={!academicYear}
            >
              <SelectTrigger id="export-semester">
                <SelectValue placeholder="Select semester" />
              </SelectTrigger>
              <SelectContent>
                {semesterOptions.map((sem) => (
                  <SelectItem key={sem} value={sem}>
                    {semesterMap(sem) || sem}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Alert className="border-blue-500 text-blue-700 bg-blue-50">
            <AlertCircleIcon className="h-4 w-4 !text-blue-700" />
            <AlertTitle>Upload-template format</AlertTitle>
            <AlertDescription>
              <p>
                The file uses the same columns as the bulk upload template, so
                you can correct it offline and upload it again without
                reformatting.
              </p>
            </AlertDescription>
          </Alert>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={!academicYear || !semester || isExporting}
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
