"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Search,
  Plus,
  CheckCircle,
  AlertCircle,
  User,
  Eye,
  LocateIcon,
  MailIcon,
  PhoneCallIcon,
  BookOpen,
  GraduationCap,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  searchStudent,
  addManualGrade,
  getStudentDetails,
  checkExsistingGrade,
} from "@/actions/grades";
import type { AcademicYear, Semester } from "@prisma/client";
import { courseMap, formatMajor } from "@/lib/courses";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn, GRADE_HIERARCHY } from "@/lib/utils";
import { getCourseOptions } from "@/lib/subjects";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useUser } from "@clerk/nextjs";

interface Student {
  studentNumber: string;
  firstName: string;
  lastName: string;
  course: string;
  major: string | "";
}

interface CourseOption {
  id: string;
  code: string;
  title: string;
}

interface StudentDetails {
  studentNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  course: string;
  major: string | "";
  status: string;
  email: string;
  phone: string;
  address: string;
}

const formSchema = z.object({
  courseCode: z.string().min(1, "Course code is required"),
  creditUnit: z.string().min(1, "Credit unit is required"),
  courseTitle: z.string().min(1, "Course title is required"),
  grade: z.string().min(1, "Grade is required"),
  reExam: z.string().optional(),
  remarks: z.string().min(1, "Remarks is required"),
  instructor: z.string().min(1, "Instructor is required"),
  selectedCourseId: z.string().min(1, "Course selection is required"),
});

const calculateRemarks = (gradeVal: string, reExamVal: string) => {
  const basis = (reExamVal && reExamVal !== "none") ? reExamVal : gradeVal;

  if (["1.00", "1.25", "1.50", "1.75", "2.00", "2.25", "2.50", "2.75", "3.00"].includes(basis)) {
    return "PASSED";
  } else if (basis === "4.00") {
    return "CON. FAILURE";
  } else if (basis === "5.00") {
    return "FAILED";
  } else if (basis === "INC") {
    return "LACK OF REQ";
  } else if (basis === "DRP") {
    return "DROPPED";
  } else if (basis === "S") {
    return "SATISFACTORY";
  } else if (basis === "US") {
    return "UNSATISFACTORY";
  }
  return "";
};

export default function ManualGradeEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user } = useUser();

  const role = user?.publicMetadata?.role as string;

  // Initialize state from URL params
  const [academicYear, setAcademicYear] = useState<string>(
    searchParams.get("academicYear") || ""
  );
  const [semester, setSemester] = useState<string>(
    searchParams.get("semester") || ""
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    searchParams.get("q") || ""
  );
  const [searchType, setSearchType] = useState<"studentNumber" | "name">(
    (searchParams.get("type") as "studentNumber" | "name") || "studentNumber"
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentDetails, setStudentDetails] = useState<StudentDetails | null>(
    null
  );
  const [showStudentDetails, setShowStudentDetails] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string>("");

  // Form
  const [courseOptions, setCourseOptions] = useState<CourseOption[]>([]);
  const [courseCodeOpen, setCourseCodeOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      courseCode: "",
      creditUnit: "",
      courseTitle: "",
      grade: "",
      reExam: "",
      remarks: "",
      instructor: "",
      selectedCourseId: "",
    },
  });

  const { watch, setValue } = form;
  const grade = watch("grade");
  const reExam = watch("reExam");

  useEffect(() => {
    if (grade) {
      const remarks = calculateRemarks(grade, reExam || "none");
      setValue("remarks", remarks);
    }
  }, [grade, reExam, setValue]);

  // Helper to update URL params
  const createQueryString = useCallback(
    (params: Record<string, string | null>) => {
      const newSearchParams = new URLSearchParams(searchParams.toString());

      Object.entries(params).forEach(([key, value]) => {
        if (value === null) {
          newSearchParams.delete(key);
        } else {
          newSearchParams.set(key, value);
        }
      });

      return newSearchParams.toString();
    },
    [searchParams]
  );

  const updateUrl = (params: Record<string, string | null>) => {
    router.replace(`${pathname}?${createQueryString(params)}`, { scroll: false });
  };

  // Sync state changes to URL (for dropdowns)
  const handleAcademicYearChange = (value: string) => {
    setAcademicYear(value);
    updateUrl({ academicYear: value });
  };

  const handleSemesterChange = (value: string) => {
    setSemester(value);
    setValidationError("");
    updateUrl({ semester: value });
  };

  // Handle URL-based student selection on mount or URL change
  useEffect(() => {
    const selectedId = searchParams.get("selected");

    const fetchSelectedStudent = async () => {
      if (!selectedId || selectedStudent?.studentNumber === selectedId) return;

      setIsLoadingDetails(true);
      try {
        // We reuse getStudentDetails to fetch the student by ID
        const details = await getStudentDetails(selectedId);
        if (details) {
          const student: Student = {
            studentNumber: details.studentNumber,
            firstName: details.firstName,
            lastName: details.lastName,
            course: details.course,
            major: details.major,
          };

          handleStudentSelect(student, false); // false = don't update URL again
        } else {
          // Invalid ID in URL, remove it
          updateUrl({ selected: null });
        }
      } catch (error) {
        console.error("Error fetching selected student from URL:", error);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchSelectedStudent();

    // Also perform search if query exists and results are empty (initial load)
    const initialQuery = searchParams.get("q");
    if (initialQuery && searchResults.length === 0 && !selectedId) {
      // We can trigger search here, but need to be careful about infinite loops.
      // It's safer to just let the user see the query in the box and click search, 
      // OR trigger it once. 
      // Let's rely on the user clicking search to avoid auto-triggering heavy queries 
      // unless explicitly desired. 
      // User request: "add search params when searching ... is that prod level"
      // Prod level usually implies auto-hydration.
      // Let's auto-search if not already searching.
      if (!isSearching) {
        performSearch(initialQuery, (searchParams.get("type") as "name" | "studentNumber") || "studentNumber");
      }
    }
  }, [searchParams]); // Depend on searchParams to react to navigation

  const performSearch = async (query: string, type: "studentNumber" | "name", page: number = 1) => {
    if (!academicYear || !semester) {
      if (!academicYear && !semester) return;
    }

    setIsSearching(true);
    try {
      const result = await searchStudent(query, type, page);
      setSearchResults(result.data);
      setTotalPages(result.meta.totalPages);
      setCurrentPage(result.meta.page);
    } catch (error) {
      console.error("Search failed:", error);
      toast.error("An error occurred while searching");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  const handleCourseSelect = (id: string) => {
    const selectedCourse = courseOptions.find((course) => course.id === id);
    if (selectedCourse) {
      setValue("selectedCourseId", id);
      setValue("courseCode", selectedCourse.code);
      setValue("courseTitle", selectedCourse.title);
    }
  };

  const handleSearch = async () => {
    if (!academicYear || !semester) {
      setValidationError("Please select both academic year and semester first");
      return;
    }

    if (!searchQuery.trim()) {
      setValidationError("Please enter a search query");
      return;
    }

    setValidationError("");

    // Update URL with search params
    updateUrl({
      q: searchQuery,
      type: searchType,
      selected: null // Clear selection on new search
    });

    // Search is also triggered by the useEffect when URL changes, 
    // but we can call it directly for immediate feedback logic if needed.
    // However, sticking to "URL as source of truth" is cleaner.
    // BUT, router.replace is async-ish. 
    // Let's call performSearch directly AND update URL.
    // Let's call performSearch directly AND update URL.
    await performSearch(searchQuery, searchType, 1);
  };

  const handleStudentSelect = (student: Student, shouldUpdateUrl = true) => {
    setSelectedStudent(student);
    setSearchResults([]);
    // Don't clear query from state so user sees what they searched, 
    // but maybe clear from URL if we want "clean" selected state? 
    // Usually keep it.

    setShowStudentDetails(false);
    setStudentDetails(null);
    setValidationError("");

    if (shouldUpdateUrl) {
      updateUrl({ selected: student.studentNumber });
    }

    // Reset Form
    form.reset({
      courseCode: "",
      creditUnit: "",
      courseTitle: "",
      grade: "",
      reExam: "",
      remarks: "",
      instructor: "",
      selectedCourseId: "",
    });

    // Update course options based on student's program
    const options = getCourseOptions(student.course, student.major).map(
      (course, index) => ({
        id: `${course.code}_${index}_${Date.now()}`,
        code: course.code,
        title: course.title,
      })
    );
    setCourseOptions(options);
  };

  const handleViewStudentDetails = async (student: Student) => {
    if (!academicYear || !semester) {
      setValidationError("Please select both academic year and semester first");
      return;
    }

    setIsLoadingDetails(true);
    try {
      const details = await getStudentDetails(student.studentNumber);
      setStudentDetails(details as StudentDetails);
      setShowStudentDetails(true);
    } catch (error) {
      console.error("Failed to load student details:", error);
      toast.error("Failed to load student details");
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!selectedStudent || !academicYear || !semester) {
      toast.error("Please fill in all required fields.");
      return;
    }

    // Check for existing grade
    const alreadyHasGrade = await checkExsistingGrade({
      studentNumber: selectedStudent.studentNumber,
      courseCode: values.courseCode,
      academicYear: academicYear as AcademicYear,
      semester: semester as Semester,
    });

    if (alreadyHasGrade) {
      Swal.fire({
        icon: 'warning',
        title: 'Grade Already Exists',
        text: 'This student already has a grade for this course in the selected term.',
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Confirm Grade Submission',
      html: `
            <div class="text-left text-sm">
                <p><strong>Student:</strong> ${selectedStudent.firstName} ${selectedStudent.lastName}</p>
                <p><strong>Course:</strong> ${values.courseCode}</p>
                <p><strong>Grade:</strong> <span class="text-blue-600 font-bold text-lg">${values.grade}</span></p>
                <p><strong>Remarks:</strong> ${values.remarks}</p>
            </div>
        `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Submit Grade',
      confirmButtonColor: '#1d4ed8'
    });

    if (!result.isConfirmed) return;

    setIsSubmitting(true);
    try {
      const gradeData = {
        studentNumber: selectedStudent.studentNumber,
        firstName: selectedStudent.firstName,
        lastName: selectedStudent.lastName,
        academicYear,
        semester,
        courseCode: values.courseCode,
        creditUnit: Number.parseFloat(values.creditUnit),
        courseTitle: values.courseTitle,
        grade: values.grade,
        reExam: values.reExam,
        remarks: values.remarks,
        instructor: values.instructor,
      };

      await addManualGrade({
        ...gradeData,
        academicYear: gradeData.academicYear as AcademicYear,
        semester: gradeData.semester as Semester,
        isResolved: false
      });

      Swal.fire({
        icon: 'success',
        title: 'Grade Added',
        text: `Successfully added grade for ${selectedStudent.firstName} ${selectedStudent.lastName}`,
        timer: 2000,
        showConfirmButton: false
      });

      // Reset form
      form.reset({
        courseCode: "",
        creditUnit: "",
        courseTitle: "",
        grade: "",
        reExam: "",
        remarks: "",
        instructor: "",
        selectedCourseId: "",
      });

      // Clear selection
      setSelectedStudent(null);
      updateUrl({ selected: null }); // Clear URL selection

      setShowStudentDetails(false);
      setStudentDetails(null);

    } catch (error) {
      console.error("Failed to add grade:", error);
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: 'An error occurred while saving the grade.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdminOrRegistrar = ["admin", "registrar"].includes(role);
  const startYear = isAdminOrRegistrar ? 2014 : 2025;

  const currentYear = new Date().getFullYear() - 1;
  // Ensure we go at least up to next year or a bit more
  const endYear = currentYear + 1;
  const numberOfYears = (endYear - startYear) + 2; // +2 buffer

  const academicYears = Array.from({ length: numberOfYears }, (_, i) => {
    const ayStart = startYear + i;
    const ayEnd = ayStart + 1;
    return `AY_${ayStart}_${ayEnd}`;
  }).reverse();

  return (
    <div className="space-y-6 mx-auto">
      {/* 1. Academic Configuration */}
      <Card className="border-t-4 border-t-amber-500 shadow-sm">
        <CardHeader>

          <CardTitle className="flex items-center gap-2 text-xl">
            <BookOpen className="w-5 h-5 text-amber-500" />
            Configuration
          </CardTitle>
          <CardDescription>Select the academic term before searching for students.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="academic-year">Academic Year <span className="text-red-500">*</span></Label>
              <Select value={academicYear} onValueChange={handleAcademicYearChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears
                    .filter((year) => role !== "faculty" || year === `AY_${currentYear}_${currentYear + 1}`)
                    .map((year: string) => (
                      <SelectItem key={year} value={year}>
                        {year.replace("AY_", "AY ").replace("_", "-")}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="semester">Semester <span className="text-red-500">*</span></Label>
              <Select
                value={semester}
                onValueChange={handleSemesterChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIRST">First Semester</SelectItem>
                  <SelectItem value="SECOND">Second Semester</SelectItem>
                  <SelectItem value="MIDYEAR">Midyear</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Error */}
      {validationError && (
        <div className="rounded-lg bg-red-50 p-4 flex items-start gap-3 border border-red-100">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-800">Validation Error</h3>
            <p className="text-red-700 text-sm">{validationError}</p>
          </div>
        </div>
      )}

      {/* 2. Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find Student
          </CardTitle>
          <CardDescription>
            Search by Student Number or Name (e.g., "Lastname" or "Firstname").
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-1/3 space-y-2">
              <Label>Search Criteria</Label>
              <Select
                value={searchType}
                onValueChange={(value: "studentNumber" | "name") =>
                  setSearchType(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="studentNumber">Student Number</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:flex-1 space-y-2">
              <Label>Search Query</Label>
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    searchType === "studentNumber"
                      ? "20XXXXXXX"
                      : "Enter name..."
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                </Button>
              </div>
            </div>
          </div>

          {/* Search Results Table */}
          {searchResults.length > 0 && (
            <div className="border rounded-md">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((student) => (
                    <TableRow key={student.studentNumber}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">{student.firstName} {student.lastName}</p>
                            <p className="text-xs text-gray-500">{student.studentNumber}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{student.course}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewStudentDetails(student)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Eye className="w-4 h-4 mr-1" /> Details
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleStudentSelect(student)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Select <CheckCircle className="w-3 h-3 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {searchResults.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 border-t pt-4">
              <div className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => performSearch(searchQuery, searchType, currentPage - 1)}
                  disabled={currentPage <= 1 || isSearching}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => performSearch(searchQuery, searchType, currentPage + 1)}
                  disabled={currentPage >= totalPages || isSearching}
                  className="flex items-center gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !isSearching && (
            <div className="text-center py-8 text-gray-500">
              <User className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p>No students found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Student / Entry Form */}
      {selectedStudent && academicYear && semester && (
        <Card className="border-t-4 border-t-green-500 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-6 w-6 text-green-600" />
                  Grade Entry Form
                </CardTitle>
                <CardDescription className="my-2">
                  Entering grades for <span className="font-semibold text-green-700">{selectedStudent.firstName} {selectedStudent.lastName}</span>
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {selectedStudent.studentNumber}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-amber-50 border-amber-200 border rounded-lg p-4 mb-6 text-sm text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <p>Make sure the Course Code and Title match the student's actual enrollment for this semester.</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Course Code */}
                  <FormField
                    control={form.control}
                    name="selectedCourseId"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Course Code <span className="text-red-500">*</span></FormLabel>
                        <Popover open={courseCodeOpen} onOpenChange={setCourseCodeOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value
                                  ? courseOptions.find((c) => c.id === field.value)?.code
                                  : "Select course code..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0">
                            <Command>
                              <CommandInput placeholder="Search code..." />
                              <CommandList>
                                <CommandEmpty>No course found.</CommandEmpty>
                                <CommandGroup>
                                  {courseOptions.map((course) => (
                                    <CommandItem
                                      key={course.id}
                                      value={course.id}
                                      onSelect={(val) => {
                                        handleCourseSelect(val);
                                        setCourseCodeOpen(false);
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", field.value === course.id ? "opacity-100" : "opacity-0")} />
                                      {course.code}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Credit Unit */}
                  <FormField
                    control={form.control}
                    name="creditUnit"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Credit Unit <span className="text-red-500">*</span></FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Units" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[0, 1, 2, 3, 4, 5].map(u => (
                              <SelectItem key={u} value={u.toString()}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Course Title */}
                  <FormField
                    control={form.control}
                    name="courseTitle"
                    render={({ field }) => (
                      <FormItem className="col-span-1 md:col-span-2 space-y-2">
                        <FormLabel>Course Title <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-gray-50" placeholder="Auto-populated upon selecting course code" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Grade */}
                  <FormField
                    control={form.control}
                    name="grade"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Grade <span className="text-red-500">*</span></FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="font-medium text-blue-700">
                              <SelectValue placeholder="Select Grade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GRADE_HIERARCHY.map((g) => (
                              <SelectItem key={g} value={g}>{g}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Remarks */}
                  <FormField
                    control={form.control}
                    name="remarks"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Remarks <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className={cn("font-medium",
                            field.value === "PASSED" ? "text-green-600" :
                              field.value === "FAILED" ? "text-red-600" : "text-gray-700"
                          )} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Re-exam */}
                  <FormField
                    control={form.control}
                    name="reExam"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Re-exam Grade</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {GRADE_HIERARCHY.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Instructor */}
                  <FormField
                    control={form.control}
                    name="instructor"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Instructor <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Instructor Name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </div>

                <div className="flex justify-end pt-6 border-t">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-green-600 hover:bg-green-700 min-w-[150px]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" /> Submit Grade
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Student Details Dialog / Modal can remain as overlay or inline. Currently it's inline overlay in existing code? 
          Wait, existing code had it as a conditional render.  */}
      {showStudentDetails && studentDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl bg-white shadow-xl max-h-[90vh]">
            <CardHeader className="bg-blue-50 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className=" text-blue-800 flex items-center gap-2">
                  <User className="h-5 w-5" /> Student Profile
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowStudentDetails(false)}>
                  <span className="text-xl">×</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <Label className="text-gray-500">Full Name</Label>
                  <p className="font-semibold text-lg">{studentDetails.firstName} {studentDetails.middleName} {studentDetails.lastName}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-gray-500">Student Number</Label>
                  <p className="font-mono text-lg">{studentDetails.studentNumber}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-gray-500">Course & Major</Label>
                  <p>{courseMap(studentDetails.course)} {studentDetails.major !== "NONE" && `(${formatMajor(studentDetails.major)})`}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-gray-500 mr-2">Status</Label>
                  <Badge className={`ml-auto ${studentDetails.status === "REGULAR" ? "bg-green-700" : "bg-blue-700"}`}>{studentDetails.status}</Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <LocateIcon className="w-4 h-4" /> Contact Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 block">Email</span>
                    <span>{studentDetails.email}</span>
                  </div>
                  {role !== "faculty" && (
                    <>
                      <div>
                        <span className="text-gray-500 block">Phone</span>
                        <span>{studentDetails.phone}</span>
                      </div>
                      <div className="md:col-span-2">
                        <span className="text-gray-500 block">Address</span>
                        <span>{studentDetails.address}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t gap-2">
                <Button variant="outline" onClick={() => setShowStudentDetails(false)}>Close</Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => handleStudentSelect({
                    studentNumber: studentDetails.studentNumber,
                    firstName: studentDetails.firstName,
                    lastName: studentDetails.lastName,
                    course: studentDetails.course,
                    major: studentDetails.major,
                  })}
                >
                  Select for Grading
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
