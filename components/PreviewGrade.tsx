"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SyncLoader } from "react-spinners";
import {
  PencilIcon,
  CheckIcon,
  TrashIcon,
  ArrowLeftIcon,
} from "lucide-react";
import toast from "react-hot-toast";

import { GradeFilters } from "@/components/grades/GradeFilters";
import { GradeEditRow } from "@/components/grades/GradeEditRow";
import { GradeChangeHistory } from "@/components/grades/GradeChangeHistory";
import type {
  GradeRecord,
  SubjectOption,
  AcademicTerm,
} from "@/lib/grade-utils";
import {
  canEdit,
  isRegistrarStaff,
  computeRemarks,
  computeFinalRemarks,
} from "@/lib/grade-utils";

export default function PreviewGrade({
  studentNumber,
  firstName,
  lastName,
}: {
  studentNumber: string;
  firstName: string;
  lastName: string;
}) {
  const router = useRouter();
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const userCanEdit = canEdit(role);
  const isStaff = isRegistrarStaff(role);

  const [academicTerms, setAcademicTerms] = useState<AcademicTerm[]>([]);
  const [academicYear, setAcademicYear] = useState("");
  const [semester, setSemester] = useState("");
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [editedGrades, setEditedGrades] = useState<GradeRecord[]>([]);
  const [editingRows, setEditingRows] = useState<{ [key: number]: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [availableSubjects, setAvailableSubjects] = useState<SubjectOption[]>([]);

  // ─── Data fetching ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/academic-terms?studentNumber=${studentNumber}`);
        if (res.ok) setAcademicTerms(await res.json());
      } catch (err) {
        console.error(err);
      }
    })();
  }, [studentNumber]);

  const uniqueAcademicYears = Array.from(
    new Set(academicTerms.map((t) => t.academicYear)),
  );
  const semesterOptions = academicYear
    ? academicTerms.filter((t) => t.academicYear === academicYear).map((t) => t.semester)
    : [];

  useEffect(() => {
    if (academicYear && semester) {
      fetch(
        `/api/subject-offerings?academicYear=${academicYear}&semester=${semester}`,
      )
        .then((r) => r.json())
        .then((data) => {
          const unique = data.reduce((acc: any[], cur: any) => {
            if (!acc.find((x: any) => x.courseCode === cur.courseCode))
              acc.push(cur);
            return acc;
          }, []);
          setAvailableSubjects(unique);
        })
        .catch(console.error);
    }
  }, [academicYear, semester]);

  const fetchGrades = () => {
    if (!academicYear || !semester) return;
    setLoading(true);
    setError("");
    fetch(
      `/api/preview-grades?studentNumber=${studentNumber}&academicYear=${academicYear}&semester=${semester}`,
    )
      .then((r) => r.json())
      .then((data) => {
        setGrades(data);
        setEditedGrades(data);
        if (data.length === 0) setError("No grades found for this period.");
      })
      .catch(() => {
        toast.error("Failed to fetch grades");
        setError("Failed to fetch grades.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchGrades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear, semester, studentNumber]);

  // Auto-refresh for registrar_staff (picks up approved changes)
  useEffect(() => {
    if (!isStaff || !academicYear || !semester) return;
    const interval = setInterval(fetchGrades, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff, academicYear, semester, studentNumber]);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleAcademicYearChange = (v: string) => {
    setAcademicYear(v);
    setSemester("");
    setGrades([]);
    setEditedGrades([]);
    setError("");
  };

  const handleGradeChange = (index: number, field: keyof GradeRecord, value: string) => {
    const updated = [...editedGrades];
    const row = {
      ...updated[index],
      [field]: field === "creditUnit" ? Number(value) : value,
    };
    if (field === "grade") row.remarks = computeFinalRemarks(value, row.reExam);
    if (field === "reExam") row.remarks = computeFinalRemarks(row.grade, value);
    updated[index] = row;
    setEditedGrades(updated);
  };

  const handleCourseChange = (index: number, courseCode: string) => {
    const subject = availableSubjects.find((s) => s.courseCode === courseCode);
    const updated = [...editedGrades];
    updated[index] = {
      ...updated[index],
      courseCode,
      courseTitle: subject?.courseTitle || "",
      creditUnit: subject?.creditUnit || 0,
      remarks: computeRemarks(updated[index]?.grade ?? ""),
    };
    setEditedGrades(updated);
  };

  const handleAddRow = () => {
    const newGrade: GradeRecord = {
      id: "new",
      studentNumber,
      firstName,
      lastName,
      courseCode: "",
      creditUnit: 0,
      courseTitle: "",
      grade: "",
      reExam: "",
      remarks: "",
      instructor: "",
      academicYear,
      semester,
    };
    setGrades((prev) => [...prev, newGrade]);
    setEditedGrades((prev) => [...prev, newGrade]);
    setEditingRows((prev) => ({ ...prev, [grades.length]: true }));
  };

  const handleDeleteRow = async (index: number) => {
    const g = grades[index];
    if (g.id === "new") {
      setGrades((prev) => prev.filter((_, i) => i !== index));
      setEditedGrades((prev) => prev.filter((_, i) => i !== index));
      const r = { ...editingRows };
      delete r[index];
      setEditingRows(r);
      return;
    }
    if (!confirm("Are you sure you want to delete this grade?")) return;
    try {
      const res = await fetch(`/api/preview-grades?id=${g.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      const result = await res.json();
      if (result.pending) {
        toast.success("Grade deletion submitted for approval");
      } else {
        setGrades((prev) => prev.filter((_, i) => i !== index));
        setEditedGrades((prev) => prev.filter((_, i) => i !== index));
        const r = { ...editingRows };
        delete r[index];
        setEditingRows(r);
        toast.success("Grade deleted");
      }
    } catch {
      toast.error("Failed to delete grade");
    }
  };

  const toggleEditRow = async (index: number) => {
    if (editingRows[index]) {
      try {
        const g = editedGrades[index];
        const isNew = g.id === "new";
        const url = isNew ? "/api/preview-grades" : `/api/preview-grades?id=${g.id}`;
        const method = isNew ? "POST" : "PATCH";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(g),
        });
        if (!res.ok) throw new Error("Failed to save");
        const saved = await res.json();

        if (saved.pending) {
          if (isNew) {
            setGrades((prev) => prev.filter((_, i) => i !== index));
            setEditedGrades((prev) => prev.filter((_, i) => i !== index));
            const r = { ...editingRows };
            delete r[index];
            setEditingRows(r);
            toast.success("Grade submitted for registrar approval");
            return;
          }
          toast.success("Update submitted for approval");
          setEditedGrades((prev) =>
            prev.map((x, i) => (i === index ? grades[i] : x)),
          );
        } else {
          setGrades((prev) => prev.map((x, i) => (i === index ? saved : x)));
          setEditedGrades((prev) => prev.map((x, i) => (i === index ? saved : x)));
          toast.success(isNew ? "Grade added" : "Grade updated");
        }
      } catch {
        toast.error("Failed to save grade");
        return;
      }
    }
    setEditingRows((prev) => {
      const next = { ...prev };
      if (next[index]) delete next[index];
      else next[index] = true;
      return next;
    });
  };

  const handleSaveAll = async () => {
    try {
      const changed = editedGrades.filter((eg, i) => {
        const og = grades[i];
        if (eg.id === "new") return true;
        return (
          eg.grade !== og.grade ||
          eg.courseCode !== og.courseCode ||
          eg.creditUnit !== og.creditUnit ||
          eg.courseTitle !== og.courseTitle ||
          eg.reExam !== og.reExam ||
          eg.remarks !== og.remarks ||
          eg.instructor !== og.instructor
        );
      });
      if (changed.length === 0) return toast("No changes to save");

      const results = await Promise.all(
        changed.map(async (g) => {
          const isNew = g.id === "new";
          const res = await fetch(
            isNew ? "/api/preview-grades" : `/api/preview-grades?id=${g.id}`,
            {
              method: isNew ? "POST" : "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(g),
            },
          );
          if (!res.ok) throw new Error(`Failed: ${g.courseCode}`);
          return res.json();
        }),
      );

      const hasPending = results.some((r) => r?.pending);
      fetchGrades();
      setEditingRows({});
      toast.success(
        hasPending
          ? "Changes submitted for registrar approval."
          : "Grades saved successfully",
      );
    } catch {
      toast.error("Failed to save grades");
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="bg-white p-6 rounded-md flex-1 m-4 mt-0 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.back()}
          className="rounded-full"
        >
          <ArrowLeftIcon className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            {firstName && lastName
              ? `${firstName} ${lastName}`
              : studentNumber}
          </h1>
          <p className="text-sm text-gray-500">Student Number: {studentNumber}</p>
        </div>
      </div>

      {/* Filters */}
      <GradeFilters
        uniqueAcademicYears={uniqueAcademicYears}
        semesterOptions={semesterOptions}
        academicYear={academicYear}
        semester={semester}
        onAcademicYearChange={handleAcademicYearChange}
        onSemesterChange={setSemester}
        canEditGrades={userCanEdit}
        hasGrades={grades.length > 0}
        onAddRow={handleAddRow}
        onSaveAll={handleSaveAll}
      />

      {/* Body */}
      {loading && (
        <div className="flex justify-center py-12">
          <SyncLoader color="blue" size={15} />
        </div>
      )}
      {error && <p className="text-red-500 mb-2">{error}</p>}
      {!loading &&
        !error &&
        academicYear &&
        semester &&
        grades.length === 0 && (
          <p className="text-gray-500">
            No grades available for the selected period.
          </p>
        )}

      {grades.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableCaption>
              Grades for {academicYear.replaceAll("_", "-")} — {semester}{" "}
              SEMESTER
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Course Code</TableHead>
                <TableHead>Credit Unit</TableHead>
                <TableHead>Course Title</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Re Exam</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Uploaded By</TableHead>
                {userCanEdit && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map((grade, index) => (
                <TableRow key={index}>
                  <GradeEditRow
                    editing={!!editingRows[index]}
                    data={editingRows[index] ? editedGrades[index] : grade}
                    subjects={availableSubjects}
                    onGradeChange={(field, value) =>
                      handleGradeChange(index, field, value)
                    }
                    onCourseChange={(code) => handleCourseChange(index, code)}
                  />

                  {/* Uploaded By */}
                  <TableCell>{grade.uploadedBy || "System"}</TableCell>

                  {/* Actions */}
                  {userCanEdit && (
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button
                          onClick={() => toggleEditRow(index)}
                          className="bg-blue-700 hover:bg-blue-500"
                          size="icon"
                        >
                          {editingRows[index] ? (
                            <CheckIcon className="w-4 h-4" />
                          ) : (
                            <PencilIcon className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          onClick={() => handleDeleteRow(index)}
                          variant="destructive"
                          size="icon"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                        {/* Change history button — only for existing grades */}
                        {grade.id !== "new" && (
                          <GradeChangeHistory
                            studentNumber={studentNumber}
                            courseCode={grade.courseCode}
                            academicYear={grade.academicYear}
                            semester={grade.semester}
                          />
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
