"use client";

import { Badge } from "@/components/ui/badge";

interface ChangeDiffProps {
  action: string;
  current?: {
    courseCode?: string;
    courseTitle?: string;
    creditUnit?: number;
    grade?: string;
    remarks?: string;
    instructor?: string;
  } | null;
  proposed: Record<string, unknown>;
  /** Reason provided by the faculty for this grade change */
  changeReason?: string | null;
}

export function ChangeDiff({ action, current, proposed, changeReason }: ChangeDiffProps) {
  const fields: { key: string; label: string; format?: (v: any) => string }[] = [
    { key: "courseCode", label: "Course Code" },
    { key: "courseTitle", label: "Title" },
    { key: "creditUnit", label: "Credits", format: (v) => String(v ?? "—") },
    { key: "grade", label: "Grade" },
    { key: "remarks", label: "Remarks" },
    { key: "instructor", label: "Instructor" },
  ];

  if (action === "DELETE") {
    return (
      <div className="text-sm space-y-2">
        <Badge variant="destructive" className="mb-1">DELETE</Badge>
        <p className="text-xs text-gray-500">
          The following grade will be permanently removed:
        </p>
        <div className="bg-red-50 border border-red-200 rounded p-3 space-y-1">
          {fields.map((f) => {
            const val = current?.[f.key as keyof typeof current];
            return val != null ? (
              <div key={f.key} className="flex justify-between text-xs">
                <span className="text-gray-500">{f.label}:</span>
                <span className="font-medium">{f.format ? f.format(val) : String(val)}</span>
              </div>
            ) : null;
          })}
        </div>
        {changeReason && (
          <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
            <span className="font-medium">Reason:</span> {changeReason}
          </div>
        )}
      </div>
    );
  }

  if (action === "CREATE") {
    return (
      <div className="text-sm space-y-2">
        <Badge className="bg-green-100 text-green-800 mb-1">CREATE</Badge>
        <p className="text-xs text-gray-500">New grade will be created with:</p>
        <div className="bg-green-50 border border-green-200 rounded p-3 space-y-1">
          {fields.map((f) => {
            const val = proposed[f.key];
            return val != null ? (
              <div key={f.key} className="flex justify-between text-xs">
                <span className="text-gray-500">{f.label}:</span>
                <span className="font-medium">{f.format ? f.format(val) : String(val)}</span>
              </div>
            ) : null;
          })}
        </div>
        {changeReason && (
          <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
            <span className="font-medium">Reason:</span> {changeReason}
          </div>
        )}
      </div>
    );
  }

  // UPDATE — side-by-side diff. Uses _previous stored alongside the proposed data.
  const previous = (proposed._previous as Record<string, unknown>) ?? current;

  return (
    <div className="text-sm space-y-2">
      <Badge className="bg-amber-100 text-amber-800 mb-1">UPDATE</Badge>
      <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs">
        <div className="font-medium text-gray-500 pb-1">Field</div>
        <div className="font-medium text-gray-500 pb-1">Current</div>
        <div className="font-medium text-blue-700 pb-1">Proposed</div>
        {fields.map((f) => {
          const oldVal = previous?.[f.key as keyof typeof previous];
          const newVal = proposed[f.key];
          const oldStr = oldVal != null ? (f.format ? f.format(oldVal) : String(oldVal)) : "—";
          const newStr = newVal != null ? (f.format ? f.format(newVal) : String(newVal)) : "—";
          const changed = oldStr !== newStr;
          return (
            <div key={f.key} className="contents">
              <span className="text-gray-400">{f.label}</span>
              <span className={changed ? "line-through text-gray-400" : "text-gray-600"}>
                {oldStr}
              </span>
              <span className={changed ? "font-medium text-blue-700 bg-blue-50 px-1 rounded" : "text-gray-600"}>
                {newStr}
              </span>
            </div>
          );
        })}
      </div>
      {changeReason && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
          <span className="font-medium">Reason:</span> {changeReason}
        </div>
      )}
    </div>
  );
}
