"use client";

import type React from "react";
import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { getCourseOptions } from "@/lib/subjects";
import toast from "react-hot-toast";

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

export default function ManualGradeEntry() {
  const [academicYear, setAcademicYear] = useState<string>("");
  const [semester, setSemester] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchType, setSearchType] = useState<"studentNumber" | "name">(
    "studentNumber"
  );
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentDetails, setStudentDetails] = useState<StudentDetails | null>(
    null
  );
  const [showStudentDetails, setShowStudentDetails] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [validationError, setValidationError] = useState<string>("");

  // Form fields
  const [courseCode, setCourseCode] = useState<string>("");
  const [creditUnit, setCreditUnit] = useState<string>("");
  const [courseTitle, setCourseTitle] = useState<string>("");
  const [grade, setGrade] = useState<string>("");
  const [reExam, setReExam] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [instructor, setInstructor] = useState<string>("");
  const [courseOptions, setCourseOptions] = useState<CourseOption[]>([]);
  const [courseCodeOpen, setCourseCodeOpen] = useState(false);
  const [courseTitleOpen, setCourseTitleOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");

  const handleGradeChange = (value: string) => {
    setGrade(value);

    // Automatically set remarks based on grade
    switch (value) {
      case "1.00":
      case "1.25":
      case "1.50":
      case "1.75":
      case "2.00":
      case "2.25":
      case "2.50":
      case "2.75":
      case "3.00":
        setRemarks("PASSED");
        break;
      case "4.00":
        setRemarks("CON. FAILURE");
        break;
      case "5.00":
        setRemarks("FAILED");
        break;
      case "INC":
        setRemarks("LACK OF REQ");
        break;
      case "DRP":
        setRemarks("DROPPED");
        break;
      case "S":
        setRemarks("SATISFACTORY");
        break;
      case "US":
        setRemarks("UNSATISFACTORY");
        break;
      default:
        setRemarks("");
    }
  };

  const handleCourseSelect = (id: string) => {
    const selectedCourse = courseOptions.find((course) => course.id === id);
    if (selectedCourse) {
      setSelectedCourseId(id);
      setCourseCode(selectedCourse.code);
      setCourseTitle(selectedCourse.title);
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
    setIsSearching(true);
    try {
      const results = await searchStudent(searchQuery, searchType);
      setSearchResults(results);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setSearchResults([]);
    setSearchQuery("");
    setShowStudentDetails(false);
    setStudentDetails(null);
    setValidationError("");

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
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !academicYear || !semester || !selectedCourseId)
      return;

    const selectedCourse = courseOptions.find((c) => c.id === selectedCourseId);
    if (!selectedCourse) return;

    const alreadyHasGrade = await checkExsistingGrade({
      studentNumber: selectedStudent.studentNumber,
      courseCode: selectedCourse.code,
      academicYear: academicYear as AcademicYear,
      semester: semester as Semester,
    });

    if (alreadyHasGrade) {
      toast.error(
        "This student already has a grade for this course. please contact registrar if you want to edit the grade."
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus("idle");
    try {
      const gradeData = {
        studentNumber: selectedStudent.studentNumber,
        firstName: selectedStudent.firstName,
        lastName: selectedStudent.lastName,
        academicYear,
        semester,
        courseCode: selectedCourse.code,
        creditUnit: Number.parseFloat(creditUnit),
        courseTitle: selectedCourse.title,
        grade,
        reExam,
        remarks,
        instructor,
      };

      await addManualGrade({
        ...gradeData,
        academicYear: gradeData.academicYear as AcademicYear,
        semester: gradeData.semester as Semester,
      });

      setSubmitStatus("success");
      setSelectedCourseId("");
      setCreditUnit("");
      setGrade("");
      setReExam("");
      setRemarks("");
      setInstructor("");
      setSelectedStudent(null);
      setShowStudentDetails(false);
      setStudentDetails(null);

      setTimeout(() => {
        setSubmitStatus("idle");
      }, 3000);
    } catch (error) {
      console.error("Failed to add grade:", error);
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startYear = 2024;
  const numberOfYears = 6; // generate next 5 academic years
  const academicYears = Array.from({ length: numberOfYears }, (_, i) => {
    const ayStart = startYear + i;
    const ayEnd = ayStart + 1;
    return `AY_${ayStart}_${ayEnd}`;
  });

  return (
    <div className="space-y-6">
      {/* Academic Year and Semester Selection */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium text-lg mb-4">Select Academic Period</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="academic-year">Academic Year *</Label>
              <Select value={academicYear} onValueChange={setAcademicYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((year: string) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="semester">Semester *</Label>
              <Select
                value={semester}
                onValueChange={(value) => {
                  setSemester(value);
                  setValidationError("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIRST">1st Semester</SelectItem>
                  <SelectItem value="SECOND">2nd Semester</SelectItem>
                  <SelectItem value="MIDYEAR">Midyear</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Error */}
      {validationError && (
        <div className="rounded-lg bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-800">Validation Error</h3>
            <p className="text-red-700 text-sm">{validationError}</p>
          </div>
        </div>
      )}

      {/* Data Accuracy Warning for Manual Entry */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <h3 className="font-medium text-blue-800">
              Important: Verify Student Information
            </h3>
            <p className="text-blue-700 text-sm">
              Before adding grades manually, please ensure all student
              information is accurate:
            </p>
            <ul className="text-blue-700 text-sm space-y-1 ml-4">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-blue-600 rounded-full"></span>
                <strong>Student Number</strong> - Verify the student number is
                correct and exists in the system
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-blue-600 rounded-full"></span>
                <strong>Student Name</strong> - Confirm first name and last name
                spelling match official records
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-blue-600 rounded-full"></span>
                <strong>Course Information</strong> - Ensure course code and
                title are valid and current
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-blue-600 rounded-full"></span>
                <strong>Grade Values</strong> - Use only approved grade values
                from the dropdown
              </li>
            </ul>
            <div className="mt-3 p-3 bg-blue-100 rounded-md">
              <p className="text-blue-800 text-sm font-medium">
                💡 Use the search function to find and verify student
                information before entering grades.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Student Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Student
          </CardTitle>
          <p className="text-sm text-gray-600">
            Search for the student to ensure accurate information before adding
            grades.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search-type">Search by</Label>
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
            <div className="flex-2">
              <Label htmlFor="search-query">
                {searchType === "studentNumber"
                  ? "Student Number"
                  : "First Name or Last Name"}
              </Label>
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    searchType === "studentNumber"
                      ? "Enter student number"
                      : "Enter first name or last name"
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-blue-700 hover:bg-blue-900"
                >
                  {isSearching ? "Searching..." : "Search"}
                </Button>
              </div>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <Label>Search Results</Label>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {searchResults.map((student) => (
                  <div
                    key={student.studentNumber}
                    className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="font-medium">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {student.studentNumber} • {student.course} •
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleViewStudentDetails(student)}
                          variant="outline"
                          size="sm"
                          disabled={isLoadingDetails}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {isLoadingDetails ? "Loading..." : "View Details"}
                        </Button>
                        <Button
                          onClick={() => handleStudentSelect(student)}
                          size="sm"
                          className="bg-blue-700 hover:bg-blue-900"
                        >
                          Select
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Student Details Modal */}
          {showStudentDetails && studentDetails && (
            <Card className="border-2 border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-blue-800">
                    <User className="h-5 w-5" />
                    Student Information
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        handleStudentSelect({
                          studentNumber: studentDetails.studentNumber,
                          firstName: studentDetails.firstName,
                          lastName: studentDetails.lastName,
                          course: studentDetails.course,
                          major: studentDetails.major,
                        })
                      }
                      size="sm"
                      className="bg-blue-700 hover:bg-blue-900"
                    >
                      Select for Grading
                    </Button>
                    <Button
                      onClick={() => setShowStudentDetails(false)}
                      variant="outline"
                      size="sm"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Full Name
                      </Label>
                      <p className="text-base font-medium">
                        {studentDetails.firstName} {studentDetails.middleName}{" "}
                        {studentDetails.lastName}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Student Number
                      </Label>
                      <p className="text-base">
                        {studentDetails.studentNumber}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Course & Year
                      </Label>
                      <p className="text-base">
                        {courseMap(studentDetails.course)}{" "}
                        {studentDetails.major === "NONE"
                          ? ""
                          : formatMajor(studentDetails.major)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Status{" "}
                      </Label>
                      <Badge
                        variant={
                          studentDetails.status === "REGULAR"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {studentDetails.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Address
                      </Label>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <LocateIcon className="h-4 w-4 text-blue-600" />
                          <span className="text-base font-medium">
                            {studentDetails.address}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Email Address
                      </Label>
                      <div className="flex items-center gap-1">
                        <MailIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-base">
                          {studentDetails.email}
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Contact Number
                      </Label>
                      <div className="flex items-center gap-1">
                        <PhoneCallIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-base">
                          {studentDetails.phone}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <Separator />
              </CardContent>
            </Card>
          )}

          {/* No Results Message */}
          {searchQuery && searchResults.length === 0 && !isSearching && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-yellow-800 font-medium">
                    No students found
                  </p>
                  <p className="text-yellow-700 text-sm">
                    Please verify the{" "}
                    {searchType === "studentNumber" ? "student number" : "name"}{" "}
                    and try again. Make sure the information is correct and the
                    student exists in the system.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Selected Student */}
          {selectedStudent && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-green-900">
                    ✓ Student Verified: {selectedStudent.firstName}{" "}
                    {selectedStudent.lastName}
                  </p>
                  <p className="text-sm text-green-700">
                    {selectedStudent.studentNumber} • {selectedStudent.course} •
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedStudent(null)}
                  className="ml-auto"
                >
                  Change
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grade Entry Form */}
      {selectedStudent && academicYear && semester && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Grade
            </CardTitle>
            <div className="text-sm text-gray-600">
              Adding grade for:{" "}
              <strong>
                {selectedStudent.firstName} {selectedStudent.lastName}
              </strong>{" "}
              ({selectedStudent.studentNumber})
            </div>
          </CardHeader>
          <CardContent>
            {/* Course Information Warning */}
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-amber-700 text-sm">
                  <strong>Double-check course information:</strong> Ensure the
                  course code and title are correct and that the student is
                  enrolled in this course for the selected academic period.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="course-code">Course Code *</Label>
                  <Popover
                    open={courseCodeOpen}
                    onOpenChange={setCourseCodeOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={courseCodeOpen}
                        className="w-full justify-between bg-transparent"
                      >
                        {selectedCourseId
                          ? courseOptions.find(
                              (course) => course.id === selectedCourseId
                            )?.code
                          : "Select course code..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search course code..." />
                        <CommandList>
                          <CommandEmpty>No course found.</CommandEmpty>
                          <CommandGroup>
                            {courseOptions.map((course) => (
                              <CommandItem
                                key={course.id}
                                value={course.id}
                                onSelect={(currentValue) => {
                                  handleCourseSelect(currentValue);
                                  setCourseCodeOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCourseId === course.id
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {course.code} - {course.title}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credit-unit">Credit Unit *</Label>
                  <Select
                    value={creditUnit}
                    onValueChange={setCreditUnit}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select credit unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="course-title">Course Title *</Label>
                <Popover
                  open={courseTitleOpen}
                  onOpenChange={setCourseTitleOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={courseTitleOpen}
                      className="w-full justify-between bg-transparent"
                    >
                      {selectedCourseId
                        ? courseOptions.find(
                            (course) => course.id === selectedCourseId
                          )?.title
                        : "Select course title..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search course title..." />
                      <CommandList>
                        <CommandEmpty>No course found.</CommandEmpty>
                        <CommandGroup>
                          {courseOptions.map((course) => (
                            <CommandItem
                              key={course.id}
                              value={course.id}
                              onSelect={(currentValue) => {
                                handleCourseSelect(currentValue);
                                setCourseTitleOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCourseId === course.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {course.title}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade *</Label>
                  <Select
                    value={grade}
                    onValueChange={handleGradeChange}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.00">1.00</SelectItem>
                      <SelectItem value="1.25">1.25</SelectItem>
                      <SelectItem value="1.50">1.50</SelectItem>
                      <SelectItem value="1.75">1.75</SelectItem>
                      <SelectItem value="2.00">2.00</SelectItem>
                      <SelectItem value="2.25">2.25</SelectItem>
                      <SelectItem value="2.50">2.50</SelectItem>
                      <SelectItem value="2.75">2.75</SelectItem>
                      <SelectItem value="3.00">3.00</SelectItem>
                      <SelectItem value="4.00">4.00</SelectItem>
                      <SelectItem value="5.00">5.00</SelectItem>
                      <SelectItem value="INC">INC</SelectItem>
                      <SelectItem value="DRP">DRP</SelectItem>
                      <SelectItem value="S">S</SelectItem>
                      <SelectItem value="US">US</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks *</Label>
                  <Select
                    value={remarks}
                    onValueChange={setRemarks}
                    required
                    disabled={!!grade}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          grade ? "Auto-set from grade" : "Select remarks"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PASSED">PASSED</SelectItem>
                      <SelectItem value="CON. FAILURE">CON. FAILURE</SelectItem>
                      <SelectItem value="FAILED">FAILED</SelectItem>
                      <SelectItem value="DROPPED">DROPPED</SelectItem>
                      <SelectItem value="LACK OF REQ">LACK OF REQ</SelectItem>
                      <SelectItem value="SATISFACTORY">SATISFACTORY</SelectItem>
                      <SelectItem value="UNSATISFACTORY">
                        UNSATISFACTORY
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="re-exam">Re-exam</Label>
                  <Input
                    id="re-exam"
                    value={reExam}
                    onChange={(e) => setReExam(e.target.value)}
                    placeholder="Re-exam details (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instructor">Instructor *</Label>
                  <Input
                    id="instructor"
                    value={instructor}
                    onChange={(e) => setInstructor(e.target.value)}
                    placeholder="MR. ZANNIE I. GAMUYAO"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 bg-blue-700 hover:bg-blue-900"
                >
                  {isSubmitting ? "Adding Grade..." : "Add Grade"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Status Messages */}
      {submitStatus === "success" && (
        <div className="rounded-lg bg-green-50 p-4 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-green-800">
              Grade Added Successfully
            </h3>
            <p className="text-green-700 text-sm">
              The grade has been successfully added for{" "}
              {selectedStudent?.firstName} {selectedStudent?.lastName}.
            </p>
          </div>
        </div>
      )}

      {submitStatus === "error" && (
        <div className="rounded-lg bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-800">Failed to Add Grade</h3>
            <p className="text-red-700 text-sm">
              There was an error adding the grade. Please verify all information
              and try again.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
