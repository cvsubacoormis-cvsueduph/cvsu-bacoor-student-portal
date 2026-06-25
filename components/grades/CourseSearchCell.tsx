"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import type { SubjectOption } from "@/lib/grade-utils";

interface CourseSearchCellProps {
  subjects: SubjectOption[];
  selectedCode: string;
  onSelect: (courseCode: string) => void;
}

export function CourseSearchCell({ subjects, selectedCode, onSelect }: CourseSearchCellProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered =
    query.trim() === ""
      ? subjects
      : subjects.filter(
          (s) =>
            s.courseCode.toLowerCase().includes(query.toLowerCase()) ||
            s.courseTitle.toLowerCase().includes(query.toLowerCase()),
        );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-[200px]">
      <Input
        value={open ? query : selectedCode || ""}
        placeholder="Search course..."
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border rounded px-2 py-1 text-sm"
      />
      {open && (
        <div className="absolute z-[9999] mt-1 max-h-56 w-[320px] overflow-auto rounded-md border bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="p-2 text-sm text-gray-500">No course found.</p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.courseCode}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                  s.courseCode === selectedCode ? "bg-blue-100 font-medium" : ""
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(s.courseCode);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {s.courseCode} — {s.courseTitle}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
