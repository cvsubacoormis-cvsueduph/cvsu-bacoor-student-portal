"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import { Input } from "@/components/ui/input";
import { PencilIcon, CheckIcon, TrashIcon, PlusIcon, ArrowLeftIcon } from "lucide-react";
import toast from "react-hot-toast";

type AcademicTerm = {
    id: string;
    academicYear: string;
    semester: string;
};

type Grade = {
    id: string;
    studentNumber: string;
    firstName: string;
    lastName: string;
    courseCode: string;
    creditUnit: number;
    courseTitle: string;
    grade: string;
    reExam?: string;
    remarks?: string;
    instructor: string;
    academicYear: string;
    semester: string;
    uploadedBy?: string;
};

const GRADE_OPTIONS = [
    "1.00", "1.25", "1.50", "1.75",
    "2.00", "2.25", "2.50", "2.75",
    "3.00", "4.00", "5.00",
    "INC", "S", "US", "DRP",
];

function CourseSearchCell({
    subjects,
    selectedCode,
    onSelect,
}: {
    subjects: { id: string; courseCode: string; courseTitle: string; creditUnit: number }[];
    selectedCode: string;
    onSelect: (courseCode: string) => void;
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const filtered =
        query.trim() === ""
            ? subjects
            : subjects.filter(
                (s) =>
                    s.courseCode.toLowerCase().includes(query.toLowerCase()) ||
                    s.courseTitle.toLowerCase().includes(query.toLowerCase())
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
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${s.courseCode === selectedCode ? "bg-blue-100 font-medium" : ""
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

const computeRemarks = (gradeValue: string): string => {
    const g = parseFloat(gradeValue);
    if (isNaN(g)) {
        const upper = gradeValue.trim().toUpperCase();
        if (upper === "S") return "PASSED";
        if (upper === "US") return "UNSATISFACTORY";
        if (upper === "DRP") return "DROPPED";
        if (upper === "INC") return "LACK OF REQ.";
        return "";
    }
    if (g >= 1.00 && g <= 3.00) return "PASSED";
    if (g === 4.00) return "CONDITIONAL FAILURE";
    if (g === 5.00) return "FAILED";
    return "";
};

// When reExam is present, derive remarks from the reExam grade (same rules).
// Otherwise fall back to the original grade's remarks.
const computeFinalRemarks = (gradeValue: string, reExamValue?: string): string => {
    if (reExamValue && reExamValue.trim() !== "") {
        return computeRemarks(reExamValue.trim());
    }
    return computeRemarks(gradeValue);
};

export default function StudentGradesPage() {
    const { studentNumber } = useParams<{ studentNumber: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useUser();
    const role = user?.publicMetadata?.role as string | undefined;

    const firstName = searchParams.get("firstName") ?? "";
    const lastName = searchParams.get("lastName") ?? "";

    const [academicTerms, setAcademicTerms] = useState<AcademicTerm[]>([]);
    const [academicYear, setAcademicYear] = useState("");
    const [semester, setSemester] = useState("");
    const [grades, setGrades] = useState<Grade[]>([]);
    const [editedGrades, setEditedGrades] = useState<Grade[]>([]);
    const [editingRows, setEditingRows] = useState<{ [key: number]: boolean }>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [availableSubjects, setAvailableSubjects] = useState<
        { id: string; courseCode: string; courseTitle: string; creditUnit: number }[]
    >([]);

    // Fetch academic terms on mount
    useEffect(() => {
        async function fetchAcademicTerms() {
            try {
                const res = await fetch(`/api/academic-terms?studentNumber=${studentNumber}`);
                if (!res.ok) throw new Error("Failed to fetch academic terms");
                const data = await res.json();
                setAcademicTerms(data);
            } catch (err) {
                console.error(err);
            }
        }
        fetchAcademicTerms();
    }, [studentNumber]);

    const uniqueAcademicYears = Array.from(new Set(academicTerms.map((t) => t.academicYear)));
    const semesterOptions = academicYear
        ? academicTerms.filter((t) => t.academicYear === academicYear).map((t) => t.semester)
        : [];

    // Fetch subject offerings when AY/Sem changes
    useEffect(() => {
        if (academicYear && semester) {
            fetch(`/api/subject-offerings?academicYear=${academicYear}&semester=${semester}`)
                .then((r) => r.json())
                .then((data) => {
                    const unique = data.reduce((acc: any[], cur: any) => {
                        if (!acc.find((x: any) => x.courseCode === cur.courseCode)) {
                            acc.push(cur);
                        }
                        return acc;
                    }, []);
                    setAvailableSubjects(unique);
                })
                .catch(console.error);
        }
    }, [academicYear, semester]);

    // Fetch grades when AY/Sem changes
    useEffect(() => {
        if (academicYear && semester) {
            setLoading(true);
            setError("");
            fetch(
                `/api/preview-grades?studentNumber=${studentNumber}&academicYear=${academicYear}&semester=${semester}`
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
        }
    }, [academicYear, semester, studentNumber]);

    const handleGradeChange = (index: number, field: keyof Grade, value: string) => {
        const updated = [...editedGrades];
        const row = { ...updated[index], [field]: field === "creditUnit" ? Number(value) : value };
        // Recompute remarks whenever grade or reExam changes
        if (field === "grade") {
            row.remarks = computeFinalRemarks(value, row.reExam);
        }
        if (field === "reExam") {
            row.remarks = computeFinalRemarks(row.grade, value);
        }
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
        const newGrade: Grade = {
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
        setGrades([...grades, newGrade]);
        setEditedGrades([...editedGrades, newGrade]);
        setEditingRows({ ...editingRows, [grades.length]: true });
    };

    const handleDeleteRow = async (index: number) => {
        const g = grades[index];
        if (g.id === "new") {
            setGrades(grades.filter((_, i) => i !== index));
            setEditedGrades(editedGrades.filter((_, i) => i !== index));
            const r = { ...editingRows };
            delete r[index];
            setEditingRows(r);
            return;
        }
        if (!confirm("Are you sure you want to delete this grade?")) return;
        try {
            const res = await fetch(`/api/preview-grades?id=${g.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            setGrades(grades.filter((_, i) => i !== index));
            setEditedGrades(editedGrades.filter((_, i) => i !== index));
            const r = { ...editingRows };
            delete r[index];
            setEditingRows(r);
            toast.success("Grade deleted");
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
                setGrades((prev) => prev.map((x, i) => (i === index ? saved : x)));
                setEditedGrades((prev) => prev.map((x, i) => (i === index ? saved : x)));
                toast.success(isNew ? "Grade added" : "Grade updated");
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
            if (changed.length === 0) {
                toast("No changes to save");
                return;
            }
            await Promise.all(
                changed.map(async (g) => {
                    const isNew = g.id === "new";
                    const res = await fetch(
                        isNew ? "/api/preview-grades" : `/api/preview-grades?id=${g.id}`,
                        {
                            method: isNew ? "POST" : "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(g),
                        }
                    );
                    if (!res.ok) throw new Error(`Failed: ${g.courseCode}`);
                    return res.json();
                })
            );
            const refreshed = await fetch(
                `/api/preview-grades?studentNumber=${studentNumber}&academicYear=${academicYear}&semester=${semester}`
            );
            if (refreshed.ok) {
                const data = await refreshed.json();
                setGrades(data);
                setEditedGrades(data);
            }
            setEditingRows({});
            toast.success("Grades saved successfully");
        } catch {
            toast.error("Failed to save grades");
        }
    };

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
                        {firstName && lastName ? `${firstName} ${lastName}` : studentNumber}
                    </h1>
                    <p className="text-sm text-gray-500">Student Number: {studentNumber}</p>
                </div>
            </div>

            {/* Filters + Add button */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <Select
                        onValueChange={(v) => {
                            setAcademicYear(v);
                            setSemester("");
                            setGrades([]);
                            setEditedGrades([]);
                            setError("");
                        }}
                    >
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Academic Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {uniqueAcademicYears.map((y) => (
                                <SelectItem key={y} value={y}>
                                    {y.replace("AY_", "").replace("_", "-")}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select onValueChange={setSemester} disabled={!academicYear}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Semester" />
                        </SelectTrigger>
                        <SelectContent>
                            {semesterOptions.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {s}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    {role !== "faculty" && academicYear && semester && (
                        <Button
                            onClick={handleAddRow}
                            size="sm"
                            className="bg-blue-700 hover:bg-blue-600"
                        >
                            <PlusIcon className="w-4 h-4 mr-2" />
                            Add Grade
                        </Button>
                    )}
                    {role !== "faculty" && grades.length > 0 && (
                        <Button
                            onClick={handleSaveAll}
                            size="sm"
                            className="bg-green-700 hover:bg-green-600"
                        >
                            Save All Changes
                        </Button>
                    )}
                </div>
            </div>

            {/* Body */}
            {loading && (
                <div className="flex justify-center py-12">
                    <SyncLoader color="blue" size={15} />
                </div>
            )}
            {error && <p className="text-red-500 mb-2">{error}</p>}
            {!loading && !error && academicYear && semester && grades.length === 0 && (
                <p className="text-gray-500">No grades available for the selected period.</p>
            )}

            {grades.length > 0 && (
                <div className="overflow-x-auto">
                    <Table>
                        <TableCaption>
                            Grades for {academicYear.replaceAll("_", "-")} — {semester} SEMESTER
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
                                {role !== "faculty" && <TableHead>Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {grades.map((grade, index) => (
                                <TableRow key={index}>
                                    <TableCell>
                                        {editingRows[index] ? (
                                            <CourseSearchCell
                                                subjects={availableSubjects}
                                                selectedCode={editedGrades[index].courseCode}
                                                onSelect={(code) => handleCourseChange(index, code)}
                                            />
                                        ) : (
                                            grade.courseCode
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingRows[index] ? (
                                            <Input
                                                type="number"
                                                value={editedGrades[index].creditUnit}
                                                onChange={(e) => handleGradeChange(index, "creditUnit", e.target.value)}
                                                className="border p-1 rounded w-20"
                                            />
                                        ) : (
                                            grade.creditUnit
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingRows[index] ? (
                                            <Input
                                                type="text"
                                                value={editedGrades[index].courseTitle}
                                                onChange={(e) => handleGradeChange(index, "courseTitle", e.target.value)}
                                                className="border p-1 rounded"
                                                disabled
                                            />
                                        ) : (
                                            grade.courseTitle
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingRows[index] ? (
                                            <Select
                                                value={editedGrades[index].grade}
                                                onValueChange={(v) => handleGradeChange(index, "grade", v)}
                                            >
                                                <SelectTrigger className="w-[90px]">
                                                    <SelectValue placeholder="Grade" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {GRADE_OPTIONS.map((g) => (
                                                        <SelectItem key={g} value={g}>
                                                            {g}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            grade.grade
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingRows[index] ? (
                                            <Input
                                                type="text"
                                                value={editedGrades[index].reExam ?? ""}
                                                onChange={(e) => handleGradeChange(index, "reExam", e.target.value)}
                                                className="border p-1 rounded w-20"
                                            />
                                        ) : isNaN(parseFloat(grade.reExam ?? "")) ? (
                                            " "
                                        ) : (
                                            parseFloat(grade.reExam ?? "").toFixed(2)
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingRows[index] ? (
                                            <Input
                                                type="text"
                                                value={editedGrades[index].remarks ?? ""}
                                                onChange={(e) => handleGradeChange(index, "remarks", e.target.value)}
                                                className="border p-1 rounded"
                                            />
                                        ) : (
                                            grade.remarks || "-"
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingRows[index] ? (
                                            <Input
                                                type="text"
                                                value={editedGrades[index].instructor}
                                                onChange={(e) => handleGradeChange(index, "instructor", e.target.value)}
                                                className="border p-1 rounded"
                                            />
                                        ) : (
                                            grade.instructor
                                        )}
                                    </TableCell>
                                    <TableCell>{grade.uploadedBy || "System"}</TableCell>
                                    {role !== "faculty" && (
                                        <TableCell>
                                            <div className="flex items-center gap-2">
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
