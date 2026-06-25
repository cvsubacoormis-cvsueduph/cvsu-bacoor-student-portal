"use client";

import { useState } from "react";
import { HistoryIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatAcademicYear } from "@/lib/grade-utils";

interface LogEntry {
  id: string;
  action: string;
  grade: string;
  creditUnit: number;
  courseTitle: string;
  instructor: string;
  remarks: string | null;
  performedAt: string;
  academicYear: string;
  semester: string;
}

interface GradeChangeHistoryProps {
  studentNumber: string;
  courseCode: string;
  academicYear: string;
  semester: string;
}

const ACTION_LABELS: Record<string, string> = {
  MANUAL_ENTRY: "Created",
  UPDATED: "Updated",
  DELETED: "Deleted",
  APPROVED_CREATE: "Approved (Create)",
  APPROVED_UPDATE: "Approved (Update)",
  APPROVED_DELETE: "Approved (Delete)",
  CREATED: "Created (Batch)",
  LEGACY_ENTRY: "Legacy Import",
};

const ACTION_COLORS: Record<string, string> = {
  MANUAL_ENTRY: "bg-green-100 text-green-800",
  UPDATED: "bg-amber-100 text-amber-800",
  DELETED: "bg-red-100 text-red-800",
  APPROVED_CREATE: "bg-green-100 text-green-800",
  APPROVED_UPDATE: "bg-blue-100 text-blue-800",
  APPROVED_DELETE: "bg-red-100 text-red-800",
  CREATED: "bg-green-50 text-green-700",
  LEGACY_ENTRY: "bg-gray-100 text-gray-600",
};

export function GradeChangeHistory({
  studentNumber,
  courseCode,
  academicYear,
  semester,
}: GradeChangeHistoryProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const fetchHistory = async () => {
    if (logs.length > 0) return; // already loaded
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        studentNumber,
        courseCode,
        academicYear,
        semester,
      });
      const res = await fetch(`/api/grade-history?${params}`);
      if (!res.ok) throw new Error("Failed to load history");
      const data = await res.json();
      setLogs(data);
    } catch {
      setError("Could not load history");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) fetchHistory(); }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400 hover:text-blue-600"
          title="View change history"
        >
          <HistoryIcon className="w-3.5 h-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b bg-gray-50">
          <p className="text-sm font-medium">Change History</p>
          <p className="text-xs text-gray-500">
            {courseCode} — {formatAcademicYear(academicYear)} {semester}
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            </div>
          )}
          {error && <p className="text-sm text-red-500 p-4">{error}</p>}
          {!loading && !error && logs.length === 0 && (
            <p className="text-sm text-gray-400 p-4">No history recorded.</p>
          )}
          {!loading &&
            logs.map((log) => (
              <div
                key={log.id}
                className="px-3 py-2.5 border-b last:border-0 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      ACTION_COLORS[log.action] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {ACTION_LABELS[log.action] || log.action}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(log.performedAt).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="text-xs text-gray-600 space-y-0.5">
                  <p>
                    Grade: <span className="font-semibold">{log.grade}</span>
                    {" · "}Credits: {log.creditUnit}
                  </p>
                  {log.instructor && log.instructor !== "N/A" && (
                    <p className="text-gray-400">Instructor: {log.instructor}</p>
                  )}
                </div>
              </div>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
