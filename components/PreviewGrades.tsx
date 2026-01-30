"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EyeIcon, PencilIcon, CheckIcon, TrashIcon, PlusIcon, Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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
import { Input } from "./ui/input";
import toast from "react-hot-toast";

type AcademicTerm = {
  id: string;
  academicYear: string;
  semester: string;
};

export type Grade = {
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

export type PreviewGradesProps = {
  studentNumber: string;
  firstName: string;
  lastName: string;
  role?: string;
};

export function PreviewGrades({
  studentNumber,
  firstName,
  lastName,
  role,
}: PreviewGradesProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [academicTerms, setAcademicTerms] = useState<AcademicTerm[]>([]);
  const [academicYear, setAcademicYear] = useState<string>("");
  const [semester, setSemester] = useState<string>("");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [editedGrades, setEditedGrades] = useState<Grade[]>([]);
  const [editingRows, setEditingRows] = useState<{ [key: number]: boolean }>(
    {}
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [availableSubjects, setAvailableSubjects] = useState<{ id: string; courseCode: string; courseTitle: string; creditUnit: number }[]>([]);
  const [openComboboxIndex, setOpenComboboxIndex] = useState<number | null>(null);

  // Fetch academic terms when dialog opens.
  useEffect(() => {
    if (isDialogOpen && academicTerms.length === 0) {
      async function fetchAcademicTerms() {
        try {
          const res = await fetch(
            `/api/academic-terms?studentNumber=${studentNumber}`
          );
          if (!res.ok) {
            throw new Error("Failed to fetch academic terms");
          }
          const data = await res.json();
          setAcademicTerms(data);
        } catch (err) {
          console.log(err);
        }
      }
      fetchAcademicTerms();
    }
  }, [isDialogOpen, academicTerms.length]);



  // Extract unique academic years for the first Select.
  const uniqueAcademicYears = Array.from(
    new Set(academicTerms.map((term) => term.academicYear))
  );

  // Filter semester options based on the selected academic year.
  const semesterOptions = academicYear
    ? academicTerms
      .filter((term) => term.academicYear === academicYear)
      .map((term) => term.semester)
    : [];

  // Fetch subject offerings when AY/Sem changes
  useEffect(() => {
    if (academicYear && semester) {
      async function fetchSubjects() {
        try {
          const res = await fetch(`/api/subject-offerings?academicYear=${academicYear}&semester=${semester}`);
          if (res.ok) {
            const data = await res.json();
            // Deduplicate based on courseCode
            const uniqueSubjects = data.reduce((acc: any[], current: any) => {
              const x = acc.find(item => item.courseCode === current.courseCode);
              if (!x) {
                return acc.concat([current]);
              } else {
                return acc;
              }
            }, []);
            setAvailableSubjects(uniqueSubjects);
          }
        } catch (e) {
          console.error(e);
        }
      }
      fetchSubjects();
    }
  }, [academicYear, semester]);

  // Fetch student grades when both academicYear and semester are selected.
  useEffect(() => {
    if (academicYear && semester) {
      async function fetchGrades() {
        setLoading(true);
        setError("");
        try {
          const response = await fetch(
            `/api/preview-grades?studentNumber=${studentNumber}&academicYear=${academicYear}&semester=${semester}`
          );
          if (!response.ok) {
            throw new Error("Failed to fetch grades");
          }
          const data = await response.json();
          // Filter results based on firstName and lastName.
          const filteredGrades = data;
          if (filteredGrades.length === 0) {
            setError(
              "No matching record found for the student name. Please verify the details."
            );
          }
          setGrades(filteredGrades);
          // Create a separate state copy for editing.
          setEditedGrades(filteredGrades);
        } catch (err) {
          console.error(err);
          toast.error("Failed to fetch grades");
          setError("Failed to fetch grades");
        } finally {
          setLoading(false);
        }
      }
      fetchGrades();
    }
  }, [academicYear, semester, studentNumber, firstName, lastName]);

  // Handle changes in the input fields.
  const handleGradeChange = (
    index: number,
    field: keyof Grade,
    value: string
  ) => {
    const updatedGrades = [...editedGrades];
    updatedGrades[index] = {
      ...updatedGrades[index],
      [field]: field === "creditUnit" ? Number(value) : value,
    };
    setEditedGrades(updatedGrades);
  };

  const handleCourseChange = (index: number, courseCode: string) => {
    const subject = availableSubjects.find(s => s.courseCode === courseCode);
    const updatedGrades = [...editedGrades];
    updatedGrades[index] = {
      ...updatedGrades[index],
      courseCode,
      courseTitle: subject?.courseTitle || "",
      creditUnit: subject?.creditUnit || 0,
    };
    setEditedGrades(updatedGrades);
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
    // Set editing for the last item (newly added)
    setEditingRows({ ...editingRows, [grades.length]: true });
  };

  const handleDeleteRow = async (index: number) => {
    const gradeToDelete = grades[index];
    if (gradeToDelete.id === "new") {
      const newGrades = grades.filter((_, i) => i !== index);
      const newEditedGrades = editedGrades.filter((_, i) => i !== index);
      setGrades(newGrades);
      setEditedGrades(newEditedGrades);
      // Clean up editing rows
      const newEditingRows = { ...editingRows };
      delete newEditingRows[index];
      setEditingRows(newEditingRows);
      return;
    }

    if (!confirm("Are you sure you want to delete this grade?")) return;

    try {
      const res = await fetch(`/api/preview-grades?id=${gradeToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete grade");
      }

      const newGrades = grades.filter((_, i) => i !== index);
      const newEditedGrades = editedGrades.filter((_, i) => i !== index);
      setGrades(newGrades);
      setEditedGrades(newEditedGrades);
      // Clean up editing rows
      const newEditingRows = { ...editingRows };
      delete newEditingRows[index];
      setEditingRows(newEditingRows);

      toast.success("Grade deleted successfully");
    } catch (error) {
      console.error("Error deleting grade", error);
      toast.error("Failed to delete grade");
    }
  };

  // Toggle edit mode for a given row.
  const toggleEditRow = async (index: number) => {
    if (editingRows[index]) {
      // If we're exiting edit mode, save the changes
      try {
        const gradeToSave = editedGrades[index];
        const isNew = gradeToSave.id === "new";

        const url = isNew ? "/api/preview-grades" : `/api/preview-grades?id=${gradeToSave.id}`;
        const method = isNew ? "POST" : "PATCH";

        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(gradeToSave),
        }
        );

        if (!res.ok) {
          throw new Error(
            `Failed to update grade for ${editedGrades[index].courseCode}`
          );
        }

        const updatedGrade = await res.json();

        // Update both grades and editedGrades states
        setGrades((prev) =>
          prev.map((g, i) => (i === index ? updatedGrade : g))
        );
        setEditedGrades((prev) =>
          prev.map((g, i) => (i === index ? updatedGrade : g))
        );

        toast.success(isNew ? "Grade added successfully" : "Grade updated successfully");
      } catch (error) {
        console.error("Error updating grade", error);
        toast.error("Failed to update grade");
        // Keep in edit mode if error
        return;
      }
    }

    // Toggle edit mode
    setEditingRows((prev) => {
      const newRows = { ...prev };
      if (newRows[index]) {
        delete newRows[index];
      } else {
        newRows[index] = true;
      }
      return newRows;
    });
  };

  // Persist the updated grades by sending a PATCH request for each updated row.
  const handleSaveChanges = async () => {
    try {
      const changedGrades = editedGrades.filter((editedGrade, index) => {
        const originalGrade = grades[index];
        // If it's new, it's considered changed
        if (editedGrade.id === "new") return true;

        return (
          editedGrade.grade !== originalGrade.grade ||
          editedGrade.courseCode !== originalGrade.courseCode ||
          editedGrade.creditUnit !== originalGrade.creditUnit ||
          editedGrade.courseTitle !== originalGrade.courseTitle ||
          editedGrade.reExam !== originalGrade.reExam ||
          editedGrade.remarks !== originalGrade.remarks ||
          editedGrade.instructor !== originalGrade.instructor
        );
      });

      if (changedGrades.length === 0) {
        toast("No changes to save");
        setIsDialogOpen(false);
        setEditingRows({});
        return;
      }

      const updatePromises = changedGrades.map(async (grade) => {
        const isNew = grade.id === "new";
        const url = isNew ? "/api/preview-grades" : `/api/preview-grades?id=${grade.id}`;
        const method = isNew ? "POST" : "PATCH";

        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(grade),
        });
        if (!res.ok) {
          throw new Error(`Failed to update grade for ${grade.courseCode}`);
        }
        return res.json();
      });

      await Promise.all(updatePromises);

      // Refresh data
      const response = await fetch(
        `/api/preview-grades?studentNumber=${studentNumber}&academicYear=${academicYear}&semester=${semester}`
      );
      if (response.ok) {
        const data = await response.json();
        setGrades(data);
        setEditedGrades(data);
      }

      setEditingRows({});

      toast.success("Grades updated successfully");
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error updating grades", error);
      toast.error("Failed to update grades");
    }
  };

  return (
    <div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="border-none rounded-full">
            <EyeIcon className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[1125px]">
          <DialogHeader>
            <DialogTitle>Preview Grades</DialogTitle>
            <DialogDescription>
              Select an academic year and semester to view student grades.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-start gap-3">
              {/* Selects */}
              <Select
                onValueChange={(value) => {
                  setAcademicYear(value);
                  setSemester("");
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Academic Year" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueAcademicYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year.replace("AY_", "").replace("_", "-")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                onValueChange={(value) => setSemester(value)}
                disabled={!academicYear}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Semester" />
                </SelectTrigger>
                <SelectContent>
                  {semesterOptions.map((sem) => (
                    <SelectItem key={sem} value={sem}>
                      {sem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {role !== "faculty" && academicYear && semester && (
              <Button onClick={handleAddRow} size="sm" className="bg-green-600 hover:bg-green-700">
                <PlusIcon className="w-4 h-4 mr-2" /> Add Grade
              </Button>
            )}
          </div>
          {loading && (
            <div className="flex items-center justify-center">
              <SyncLoader color="blue" size={15} />
            </div>
          )}
          {error && <p className="text-red-500">{error}</p>}
          {!loading &&
            !error &&
            academicYear &&
            semester &&
            grades.length === 0 && (
              <p>No grades available for the selected period.</p>
            )}
          {grades.length > 0 && (
            <Table>
              <TableCaption>
                Grades of {firstName} {lastName} for{" "}
                {academicYear.replaceAll("_", "-")} {semester} SEMESTER
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-sm">Course Code</TableHead>
                  <TableHead className="text-sm">Credit Unit</TableHead>
                  <TableHead className="text-sm">Course Title</TableHead>
                  <TableHead className="text-sm">Grade</TableHead>
                  <TableHead className="text-sm">Re Exam</TableHead>
                  <TableHead className="text-sm">Remarks</TableHead>
                  <TableHead className="text-sm">Instructor</TableHead>
                  <TableHead className="text-sm">Uploaded by</TableHead>
                  {role !== "faculty" && (
                    <TableHead className="text-sm">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map((grade, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {editingRows[index] ? (
                        <Popover
                          open={openComboboxIndex === index}
                          onOpenChange={(isOpen) => setOpenComboboxIndex(isOpen ? index : null)}
                          modal={true}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openComboboxIndex === index}
                              className="w-[180px] justify-between"
                            >
                              {editedGrades[index].courseCode
                                ? availableSubjects.find((subject) => subject.courseCode === editedGrades[index].courseCode)?.courseCode
                                : "Select Course..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0">
                            <Command>
                              <CommandInput placeholder="Search course..." />
                              <CommandList>
                                <CommandEmpty>No course found.</CommandEmpty>
                                <CommandGroup>
                                  {availableSubjects.map((subject) => (
                                    <CommandItem
                                      key={subject.courseCode} // Use unique key
                                      value={`${subject.courseCode} ${subject.courseTitle}`} // Make search work for both code and title
                                      onSelect={(currentValue) => {
                                        // When searching by title, the value might not be exact courseCode anymore due to our custom value
                                        // So we use the subject from map closure or find by matching parts
                                        handleCourseChange(index, subject.courseCode);
                                        setOpenComboboxIndex(null);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          editedGrades[index].courseCode === subject.courseCode
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      {subject.courseCode} - {subject.courseTitle}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        grade.courseCode
                      )}
                    </TableCell>
                    <TableCell>
                      {editingRows[index] ? (
                        <Input
                          type="number"
                          value={editedGrades[index].creditUnit}
                          onChange={(e) =>
                            handleGradeChange(
                              index,
                              "creditUnit",
                              e.target.value
                            )
                          }
                          className="border p-1 rounded"
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
                          onChange={(e) =>
                            handleGradeChange(
                              index,
                              "courseTitle",
                              e.target.value
                            )
                          }
                          className="border p-1 rounded"
                        />
                      ) : (
                        grade.courseTitle
                      )}
                    </TableCell>
                    <TableCell>
                      {editingRows[index] ? (
                        <Input
                          type="text"
                          value={editedGrades[index].grade}
                          onChange={(e) =>
                            handleGradeChange(index, "grade", e.target.value)
                          }
                          className="border p-1 rounded"
                        />
                      ) : (
                        grade.grade
                      )}
                    </TableCell>
                    <TableCell>
                      {editingRows[index] ? (
                        <Input
                          type="text"
                          value={editedGrades[index].reExam ?? ""}
                          onChange={(e) =>
                            handleGradeChange(index, "reExam", e.target.value)
                          }
                          className="border p-1 rounded"
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
                          onChange={(e) =>
                            handleGradeChange(index, "remarks", e.target.value)
                          }
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
                          onChange={(e) =>
                            handleGradeChange(
                              index,
                              "instructor",
                              e.target.value
                            )
                          }
                          className="border p-1 rounded w-auto"
                        />
                      ) : (
                        grade.instructor
                      )}
                    </TableCell>
                    <TableCell>{grade.uploadedBy || "System"}</TableCell>
                    <TableCell>
                      {role !== "faculty" && (
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
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <DialogFooter>
            {role !== "faculty" && (
              <Button
                className="bg-blue-700 hover:bg-blue-500"
                type="submit"
                onClick={handleSaveChanges}
              >
                Save changes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
