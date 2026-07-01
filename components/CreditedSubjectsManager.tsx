"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  BookOpen,
  PlusCircle,
  Trash2,
  GraduationCap,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  getCreditedSubjects,
  addCreditedSubject,
  removeCreditedSubject,
  bulkAddCreditedSubjects,
} from "@/actions/credited-subjects";
import { getCurriculumChecklist } from "@/actions/curriculum-actions";
import { getStudentDetails } from "@/actions/grades";

// Weighted values for status display
type CreditedSubjectRecord = {
  id: string;
  studentNumber: string;
  courseCode: string;
  courseTitle: string;
  creditUnits: number;
  schoolName: string | null;
  notes: string | null;
  creditedAt: Date;
};

type CurriculumSubject = {
  courseCode: string;
  courseTitle: string;
  creditLec: number;
  creditLab: number;
};

interface CreditedSubjectsManagerProps {
  studentNumber: string;
  studentCourse: string;
  studentMajor: string | null;
}

export default function CreditedSubjectsManager({
  studentNumber,
  studentCourse,
  studentMajor,
}: CreditedSubjectsManagerProps) {
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;

  const [creditedSubjects, setCreditedSubjects] = useState<
    CreditedSubjectRecord[]
  >([]);
  const [curriculumSubjects, setCurriculumSubjects] = useState<
    CurriculumSubject[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedCurriculumSubject, setSelectedCurriculumSubject] =
    useState("");
  const [manualCourseCode, setManualCourseCode] = useState("");
  const [manualCourseTitle, setManualCourseTitle] = useState("");
  const [manualCreditUnits, setManualCreditUnits] = useState(3);
  const [schoolName, setSchoolName] = useState("");
  const [notes, setNotes] = useState("");
  const [entryMode, setEntryMode] = useState<"curriculum" | "manual">(
    "curriculum",
  );

  // Bulk state
  const [bulkSubjects, setBulkSubjects] = useState<
    CurriculumSubject[]
  >([]);
  const [bulkMode, setBulkMode] = useState(false);

  const isAuthorized =
    role === "admin" ||
    role === "superuser" ||
    role === "registrar" ||
    role === "registrar_staff";

  // ─── Data Fetching ──────────────────────────────────────────────────

  const fetchCreditedSubjects = useCallback(async () => {
    try {
      const data = await getCreditedSubjects(studentNumber);
      setCreditedSubjects(data);
    } catch (err) {
      console.error("Failed to fetch credited subjects:", err);
      toast.error("Failed to load credited subjects.");
    } finally {
      setLoading(false);
    }
  }, [studentNumber]);

  const fetchCurriculum = useCallback(async () => {
    try {
      const curriculum = await getCurriculumChecklist(
        studentCourse,
        studentMajor,
      );
      // Deduplicate by course code
      const seen = new Set<string>();
      const unique: CurriculumSubject[] = [];
      for (const item of curriculum) {
        if (!seen.has(item.courseCode)) {
          seen.add(item.courseCode);
          unique.push({
            courseCode: item.courseCode,
            courseTitle: item.courseTitle,
            creditLec: item.creditUnit.lec,
            creditLab: item.creditUnit.lab,
          });
        }
      }
      setCurriculumSubjects(unique);
    } catch (err) {
      console.error("Failed to fetch curriculum:", err);
    }
  }, [studentCourse, studentMajor]);

  useEffect(() => {
    fetchCreditedSubjects();
    fetchCurriculum();
  }, [fetchCreditedSubjects, fetchCurriculum]);

  // ─── Credited course codes for filtering ────────────────────────────

  const creditedCodes = new Set(
    creditedSubjects.map((s) => s.courseCode),
  );

  const uncreditedCurriculumSubjects = curriculumSubjects.filter(
    (s) => !creditedCodes.has(s.courseCode),
  );

  // ─── Handlers ───────────────────────────────────────────────────────

  const handleAddSingle = async () => {
    if (entryMode === "curriculum" && !selectedCurriculumSubject) {
      toast.error("Please select a subject from the curriculum.");
      return;
    }
    if (entryMode === "manual" && (!manualCourseCode || !manualCourseTitle)) {
      toast.error("Please enter the course code and title.");
      return;
    }

    setSaving(true);
    try {
      let code: string;
      let title: string;
      let units: number;

      if (entryMode === "curriculum") {
        const subject = curriculumSubjects.find(
          (s) => s.courseCode === selectedCurriculumSubject,
        );
        if (!subject) {
          toast.error("Selected subject not found.");
          return;
        }
        code = subject.courseCode;
        title = subject.courseTitle;
        units = subject.creditLec + subject.creditLab;
      } else {
        code = manualCourseCode;
        title = manualCourseTitle;
        units = manualCreditUnits;
      }

      const result = await addCreditedSubject({
        studentNumber,
        courseCode: code,
        courseTitle: title,
        creditUnits: units,
        schoolName: schoolName || undefined,
        notes: notes || undefined,
      });

      if (result.success) {
        toast.success(result.message);
        // Reset form
        setSelectedCurriculumSubject("");
        setManualCourseCode("");
        setManualCourseTitle("");
        setManualCreditUnits(3);
        setSchoolName("");
        setNotes("");
        await fetchCreditedSubjects();
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error("Failed to add credited subject.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const result = await removeCreditedSubject({ id });
      if (result.success) {
        toast.success(result.message);
        await fetchCreditedSubjects();
        // Refresh curriculum list since this code is now available again
        setBulkSubjects((prev) =>
          prev.filter(
            (s) =>
              !creditedSubjects.find(
                (cs) => cs.id === id && cs.courseCode === s.courseCode,
              ),
          ),
        );
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error("Failed to remove credited subject.");
    }
  };

  const handleBulkAddToggle = (subject: CurriculumSubject) => {
    setBulkSubjects((prev) => {
      const exists = prev.find((s) => s.courseCode === subject.courseCode);
      if (exists) {
        return prev.filter((s) => s.courseCode !== subject.courseCode);
      }
      return [...prev, subject];
    });
  };

  const handleBulkAdd = async () => {
    if (bulkSubjects.length === 0) {
      toast.error("No subjects selected.");
      return;
    }

    setSaving(true);
    try {
      const result = await bulkAddCreditedSubjects({
        studentNumber,
        subjects: bulkSubjects.map((s) => ({
          courseCode: s.courseCode,
          courseTitle: s.courseTitle,
          creditUnits: s.creditLec + s.creditLab,
          schoolName: schoolName || undefined,
          notes: notes || undefined,
        })),
      });

      if (result.success) {
        toast.success(result.message);
        setBulkSubjects([]);
        setSchoolName("");
        setNotes("");
        await fetchCreditedSubjects();
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error("Failed to bulk add credited subjects.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────

  if (!isAuthorized) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-muted bg-muted/20 p-4">
        <AlertCircle className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          You do not have permission to manage credited subjects.
        </p>
      </div>
    );
  }

  const totalCreditedUnits = creditedSubjects.reduce(
    (sum, s) => sum + s.creditUnits,
    0,
  );

  return (
    <div className="space-y-6">
      {/* ── Summary Card ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border bg-blue-50/50 p-4">
          <BookOpen className="h-8 w-8 text-blue-600" />
          <div>
            <p className="text-2xl font-bold text-blue-700">
              {creditedSubjects.length}
            </p>
            <p className="text-xs text-blue-600">Credited Subjects</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-green-50/50 p-4">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
          <div>
            <p className="text-2xl font-bold text-green-700">
              {totalCreditedUnits}
            </p>
            <p className="text-xs text-green-600">Credited Units</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-amber-50/50 p-4">
          <GraduationCap className="h-8 w-8 text-amber-600" />
          <div>
            <p className="text-2xl font-bold text-amber-700">
              {creditedSubjects.filter((s) => s.schoolName).length}
            </p>
            <p className="text-xs text-amber-600">With School Info</p>
          </div>
        </div>
      </div>

      {/* ── Existing Credited Subjects Table ──────────────────────────── */}
      <div>
        <h3 className="mb-3 text-base font-semibold">
          Currently Credited Subjects
        </h3>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading...
          </p>
        ) : creditedSubjects.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No subjects have been credited for this student yet. Add subjects
            using the form below.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableCaption>
                A list of subjects credited from other institutions.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Code</TableHead>
                  <TableHead>Course Title</TableHead>
                  <TableHead className="w-[80px] text-center">
                    Units
                  </TableHead>
                  <TableHead className="w-[150px]">School</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[80px] text-center">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditedSubjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-mono font-medium">
                      {subject.courseCode}
                    </TableCell>
                    <TableCell>{subject.courseTitle}</TableCell>
                    <TableCell className="text-center">
                      {subject.creditUnits}
                    </TableCell>
                    <TableCell>
                      {subject.schoolName || (
                        <span className="text-xs italic text-muted-foreground">
                          Not specified
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {subject.notes || (
                        <span className="text-xs italic text-muted-foreground">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Remove Credited Subject
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove{" "}
                              <strong>
                                {subject.courseCode} - {subject.courseTitle}
                              </strong>{" "}
                              from the credited subjects list? This subject will
                              return to &ldquo;Not Taken&rdquo; status in the
                              curriculum checklist.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemove(subject.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Separator />

      {/* ── Add Form ──────────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">
            {bulkMode ? "Bulk Credit Subjects" : "Add Credited Subject"}
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBulkMode(!bulkMode);
              setBulkSubjects([]);
            }}
          >
            {bulkMode ? "Single Entry Mode" : "Bulk Select Mode"}
          </Button>
        </div>

        {!bulkMode ? (
          <div className="space-y-4 rounded-md border p-4">
            {/* Entry mode toggle */}
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium">Entry Mode:</Label>
              <div className="flex gap-2">
                <Button
                  variant={
                    entryMode === "curriculum" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setEntryMode("curriculum")}
                  className={
                    entryMode === "curriculum"
                      ? "bg-blue-700 hover:bg-blue-600"
                      : ""
                  }
                >
                  From Curriculum
                </Button>
                <Button
                  variant={entryMode === "manual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEntryMode("manual")}
                  className={
                    entryMode === "manual"
                      ? "bg-blue-700 hover:bg-blue-600"
                      : ""
                  }
                >
                  Manual Entry
                </Button>
              </div>
            </div>

            {entryMode === "curriculum" ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="curriculum-subject">
                    Select Subject from Curriculum
                  </Label>
                  <Select
                    value={selectedCurriculumSubject}
                    onValueChange={setSelectedCurriculumSubject}
                  >
                    <SelectTrigger id="curriculum-subject" className="w-full">
                      <SelectValue placeholder="Search for a subject..." />
                    </SelectTrigger>
                    <SelectContent>
                      {uncreditedCurriculumSubjects.length === 0 ? (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                          All curriculum subjects are already credited.
                        </div>
                      ) : (
                        uncreditedCurriculumSubjects.map((s) => (
                          <SelectItem
                            key={s.courseCode}
                            value={s.courseCode}
                          >
                            {s.courseCode} — {s.courseTitle} (
                            {s.creditLec + s.creditLab}u)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="manual-code">Course Code *</Label>
                  <Input
                    id="manual-code"
                    value={manualCourseCode}
                    onChange={(e) => setManualCourseCode(e.target.value)}
                    placeholder="e.g., GNED 11"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="manual-title">Course Title *</Label>
                  <Input
                    id="manual-title"
                    value={manualCourseTitle}
                    onChange={(e) => setManualCourseTitle(e.target.value)}
                    placeholder="e.g., Understanding the Self"
                  />
                </div>
                <div>
                  <Label htmlFor="manual-units">Credit Units</Label>
                  <Input
                    id="manual-units"
                    type="number"
                    min={0}
                    value={manualCreditUnits}
                    onChange={(e) =>
                      setManualCreditUnits(Number(e.target.value) || 0)
                    }
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="school-name">School / Institution</Label>
                <Input
                  id="school-name"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g., University of the Philippines"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Equivalent to GNED 11"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleAddSingle}
                disabled={saving}
                className="bg-blue-700 hover:bg-blue-600"
              >
                {saving ? (
                  "Adding..."
                ) : (
                  <>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Credited Subject
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 rounded-md border p-4">
            <div className="text-sm text-muted-foreground">
              Select multiple subjects from the curriculum to credit all at
              once. Click on a subject to toggle selection.
            </div>

            {uncreditedCurriculumSubjects.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                All curriculum subjects are already credited.
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1">
                {uncreditedCurriculumSubjects.map((s) => {
                  const isSelected = bulkSubjects.some(
                    (bs) => bs.courseCode === s.courseCode,
                  );
                  return (
                    <div
                      key={s.courseCode}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleBulkAddToggle(s)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handleBulkAddToggle(s);
                        }
                      }}
                      className={`flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                        isSelected
                          ? "bg-blue-100 text-blue-800"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isSelected ? (
                          <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border" />
                        )}
                        <span>
                          <strong>{s.courseCode}</strong> — {s.courseTitle}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {s.creditLec + s.creditLab}u
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="bulk-school">School / Institution</Label>
                <Input
                  id="bulk-school"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g., University of the Philippines"
                />
              </div>
              <div>
                <Label htmlFor="bulk-notes">Notes</Label>
                <Input
                  id="bulk-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Common notes for all selected subjects"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {bulkSubjects.length} subject(s) selected
              </p>
              <Button
                onClick={handleBulkAdd}
                disabled={saving || bulkSubjects.length === 0}
                className="bg-blue-700 hover:bg-blue-600"
              >
                {saving ? (
                  "Adding..."
                ) : (
                  <>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Credit {bulkSubjects.length} Subject(s)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
