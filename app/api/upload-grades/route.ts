// app/api/upload-grades/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Major } from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const GRADE_HIERARCHY = [
  "1.00",
  "1.25",
  "1.50",
  "1.75",
  "2.00",
  "2.25",
  "2.50",
  "2.75",
  "3.00",
  "4.00",
  "5.00",
  "DRP",
  "INC",
  "S",
  "US",
];

const BATCH_SIZE = 100;

function normalizeGrade(value: any): string | null {
  if (!value) return null;
  const str = String(value).trim().toUpperCase();
  if (GRADE_HIERARCHY.includes(str)) return str;
  const num = parseFloat(str);
  return !isNaN(num) ? num.toFixed(2) : str;
}

function sanitizeString(value: any): string | null {
  if (!value) return null;
  return String(value).replace(/['"]+/g, "").replace(/,/g, "").trim();
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

export async function POST(req: Request) {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const grades = await req.json();

  if (!grades || !Array.isArray(grades)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Extract unique student numbers and course codes
  const uniqueStudentNumbers = [
    ...new Set(
      grades
        .map((g) => g.studentNumber)
        .filter(Boolean)
        .map((sn) => String(sn).replace(/-/g, ""))
    ),
  ];

  const uniqueCourseCodes = [
    ...new Set(
      grades
        .map((g) => sanitizeString(g.courseCode))
        .filter((code) => code !== null)
    ),
  ];

  const { academicYear, semester } = grades[0] || {};
  if (!academicYear || !semester) {
    return NextResponse.json(
      { error: "Academic year and semester are required" },
      { status: 400 }
    );
  }

  // Fetch all students
  const students = await prisma.student.findMany({
    where: { studentNumber: { in: uniqueStudentNumbers } },
    select: {
      studentNumber: true,
      firstName: true,
      lastName: true,
      course: true,
      major: true,
    },
  });
  const studentMap = new Map(students.map((s) => [s.studentNumber, s]));

  // Fetch curriculum subjects
  const curriculumSubjects = await prisma.curriculumChecklist.findMany({
    where: { courseCode: { in: uniqueCourseCodes } },
    select: { id: true, courseCode: true, course: true, major: true },
  });

  // Check academic term
  const academicTerm = await prisma.academicTerm.findUnique({
    where: { academicYear_semester: { academicYear, semester } },
  });
  if (!academicTerm) {
    return NextResponse.json({ error: "Academic term not found", status: 404 });
  }

  // Fetch subject offerings
  const subjectOfferings = await prisma.subjectOffering.findMany({
    where: {
      academicYear,
      semester,
      isActive: true,
      curriculumId: { in: curriculumSubjects.map((cs) => cs.id) },
    },
    select: { id: true, curriculumId: true },
  });
  const offeringMap = new Map(
    subjectOfferings.map((so) => [so.curriculumId, so])
  );

  // Fetch existing grades
  const existingGrades = await prisma.grade.findMany({
    where: {
      studentNumber: { in: uniqueStudentNumbers },
      courseCode: { in: uniqueCourseCodes },
      academicYear,
      semester,
    },
    select: {
      studentNumber: true,
      courseCode: true,
      grade: true,
      remarks: true,
      instructor: true,
    },
  });
  const existingGradeMap = new Map(
    existingGrades.map((eg) => [`${eg.studentNumber}-${eg.courseCode}`, eg])
  );

  const results = [];
  const gradesToUpsert = [];
  const logsToCreate = [];

  for (const entry of grades) {
    try {
      const {
        studentNumber,
        lastName,
        firstName,
        courseCode,
        creditUnit,
        courseTitle,
        grade,
        reExam,
        remarks,
        instructor,
      } = entry;

      const normalizedStudentNumber = studentNumber
        ? String(studentNumber).replace(/-/g, "")
        : null;
      const sanitizedCourseCode = sanitizeString(courseCode);
      const sanitizedCourseTitle = sanitizeString(courseTitle);
      const sanitizedRemarks = sanitizeString(remarks)?.toUpperCase() ?? "";
      const sanitizedInstructor =
        sanitizeString(instructor)?.toUpperCase() ?? "";

      let resolvedStudentNumber = normalizedStudentNumber;
      let student: (typeof students)[0] | undefined;

      // Step 1: Match by studentNumber
      if (resolvedStudentNumber) {
        student = studentMap.get(resolvedStudentNumber);
      }

      // Step 2: Fallback by name if studentNumber missing or not found
      if (!student) {
        const matchedStudents = students.filter(
          (s) =>
            normalizeName(s.firstName) === normalizeName(firstName) &&
            normalizeName(s.lastName) === normalizeName(lastName)
        );

        if (matchedStudents.length === 1) {
          student = matchedStudents[0];
          resolvedStudentNumber = student.studentNumber;
        } else if (matchedStudents.length > 1) {
          results.push({
            identifier: `${firstName} ${lastName}`,
            courseCode: sanitizedCourseCode,
            status: "⚠️ Multiple students found — student number required",
          });
          logsToCreate.push({
            studentNumber: resolvedStudentNumber || "",
            courseCode: sanitizedCourseCode || "",
            grade: String(grade) || "",
            remarks: "Multiple students found — student number required",
            instructor: sanitizedInstructor,
            academicYear,
            semester,
            action: "WARNING",
          });
          continue;
        } else {
          results.push({
            identifier: `${firstName} ${lastName}`,
            courseCode: sanitizedCourseCode,
            status: "❌ Student not found",
          });
          logsToCreate.push({
            studentNumber: normalizedStudentNumber || "",
            courseCode: sanitizedCourseCode || "",
            grade: String(grade) || "",
            remarks: "Student not found",
            instructor: sanitizedInstructor,
            academicYear,
            semester,
            action: "FAILED",
          });
          continue;
        }
      }

      // Step 3: Conflict detection: studentNumber + name mismatch
      if (
        normalizedStudentNumber &&
        student &&
        normalizedStudentNumber !== student.studentNumber
      ) {
        results.push({
          identifier: `${firstName} ${lastName}`,
          courseCode: sanitizedCourseCode,
          status: "⚠️ Student number does not match name — please verify",
        });
        logsToCreate.push({
          studentNumber: normalizedStudentNumber,
          courseCode: sanitizedCourseCode,
          grade: String(grade) || "",
          remarks: "Student number does not match name",
          instructor: sanitizedInstructor,
          academicYear,
          semester,
          action: "WARNING",
        });
        continue;
      }

      // Step 4: Ensure required fields
      if (!resolvedStudentNumber || !sanitizedCourseCode || grade == null) {
        results.push({
          identifier: resolvedStudentNumber || `${firstName} ${lastName}`,
          courseCode: sanitizedCourseCode,
          status: "❌ Missing required fields",
        });
        logsToCreate.push({
          studentNumber: resolvedStudentNumber || "",
          courseCode: sanitizedCourseCode || "",
          grade: String(grade) || "",
          remarks: "Missing required fields",
          instructor: sanitizedInstructor,
          academicYear,
          semester,
          action: "FAILED",
        });
        continue;
      }

      const standardizedGrade = normalizeGrade(grade);
      const standardizedReExam = normalizeGrade(reExam);
      if (!standardizedGrade) {
        results.push({
          identifier: resolvedStudentNumber,
          courseCode: sanitizedCourseCode,
          status: "❌ Invalid grade value",
        });
        logsToCreate.push({
          studentNumber: resolvedStudentNumber,
          courseCode: sanitizedCourseCode,
          grade: String(grade) || "",
          remarks: "Invalid grade value",
          instructor: sanitizedInstructor,
          academicYear,
          semester,
          action: "FAILED",
        });
        continue;
      }

      // Step 5: Match curriculum & subject offering
      const checklistSubject = curriculumSubjects.find(
        (cs) =>
          cs.courseCode === sanitizedCourseCode &&
          cs.course === student.course &&
          cs.major === (student.major || Major.NONE)
      );
      if (!checklistSubject) {
        results.push({
          studentNumber: student.studentNumber,
          courseCode: sanitizedCourseCode,
          status: `❌ Subject not in curriculum`,
        });
        logsToCreate.push({
          studentNumber: student.studentNumber,
          courseCode: sanitizedCourseCode,
          grade: standardizedGrade,
          remarks: "Subject not in curriculum",
          instructor: sanitizedInstructor,
          academicYear,
          semester,
          action: "FAILED",
        });
        continue;
      }

      const subjectOffering = offeringMap.get(checklistSubject.id);
      if (!subjectOffering) {
        results.push({
          studentNumber: student.studentNumber,
          courseCode: sanitizedCourseCode,
          status: "❌ Subject not offered in selected term",
        });
        logsToCreate.push({
          studentNumber: student.studentNumber,
          courseCode: sanitizedCourseCode,
          grade: standardizedGrade,
          remarks: "Subject not offered in selected term",
          instructor: sanitizedInstructor,
          academicYear,
          semester,
          action: "FAILED",
        });
        continue;
      }

      // Step 6: Check existing grade
      const existingGrade = existingGradeMap.get(
        `${resolvedStudentNumber}-${sanitizedCourseCode}`
      );
      if (existingGrade) {
        // Skip logging if grade is same
        if (
          existingGrade.grade === standardizedGrade &&
          existingGrade.remarks === sanitizedRemarks &&
          existingGrade.instructor === sanitizedInstructor
        ) {
          results.push({
            studentNumber: student.studentNumber,
            courseCode: sanitizedCourseCode,
            status: "✅ Grade already exists, no changes",
          });
          continue;
        }

        // Check hierarchy: if existing grade is better, skip
        const existingIndex = GRADE_HIERARCHY.indexOf(existingGrade.grade);
        const newIndex = GRADE_HIERARCHY.indexOf(standardizedGrade);
        if (existingIndex < newIndex) {
          results.push({
            studentNumber: student.studentNumber,
            courseCode: sanitizedCourseCode,
            status: "⚠️ Existing grade is better - kept existing",
          });
          continue;
        }
      }

      // Step 7: Prepare upsert
      gradesToUpsert.push({
        studentNumber: resolvedStudentNumber,
        courseCode: sanitizedCourseCode,
        courseTitle: sanitizedCourseTitle?.toUpperCase() ?? "",
        creditUnit: Number(creditUnit),
        grade: standardizedGrade,
        reExam: standardizedReExam,
        remarks: sanitizedRemarks,
        instructor: sanitizedInstructor,
        academicYear,
        semester,
        subjectOfferingId: subjectOffering.id,
        uploadedBy: user?.fullName ?? "",
      });

      // Step 8: Log only changes
      logsToCreate.push({
        studentNumber: resolvedStudentNumber,
        courseCode: sanitizedCourseCode,
        grade: standardizedGrade,
        remarks: sanitizedRemarks,
        instructor: sanitizedInstructor,
        academicYear,
        semester,
        action: existingGrade ? "UPDATED" : "CREATED",
      });

      results.push({
        studentNumber: student.studentNumber,
        courseCode: sanitizedCourseCode,
        status: "✅ Grade uploaded",
        studentName: `${student.firstName} ${student.lastName}`,
      });
    } catch (error) {
      console.error(`Error processing entry:`, entry, error);
      results.push({
        identifier: entry.studentNumber,
        courseCode: entry.courseCode,
        status: "❌ Server error",
      });
      logsToCreate.push({
        studentNumber: entry.studentNumber || "",
        courseCode: entry.courseCode || "",
        grade: String(entry.grade) || "",
        remarks: "Server error",
        instructor: entry.instructor || "",
        academicYear,
        semester,
        action: "FAILED",
      });
    }
  }

  // Step 9: Batch upsert grades
  for (let i = 0; i < gradesToUpsert.length; i += BATCH_SIZE) {
    const batch = gradesToUpsert.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((gradeData) =>
        prisma.grade.upsert({
          where: {
            studentNumber_courseCode_academicYear_semester: {
              studentNumber: gradeData.studentNumber,
              courseCode: gradeData.courseCode,
              academicYear: gradeData.academicYear,
              semester: gradeData.semester,
            },
          },
          create: {
            student: { connect: { studentNumber: gradeData.studentNumber } },
            courseCode: gradeData.courseCode,
            courseTitle: gradeData.courseTitle,
            creditUnit: gradeData.creditUnit,
            grade: gradeData.grade,
            reExam: gradeData.reExam,
            remarks: gradeData.remarks,
            instructor: gradeData.instructor,
            academicTerm: {
              connect: {
                academicYear_semester: {
                  academicYear: gradeData.academicYear,
                  semester: gradeData.semester,
                },
              },
            },
            subjectOffering: { connect: { id: gradeData.subjectOfferingId } },
            uploadedBy: gradeData.uploadedBy,
          },
          update: {
            courseTitle: gradeData.courseTitle,
            creditUnit: gradeData.creditUnit,
            grade: gradeData.grade,
            reExam: gradeData.reExam,
            remarks: gradeData.remarks,
            instructor: gradeData.instructor,
            subjectOffering: { connect: { id: gradeData.subjectOfferingId } },
            uploadedBy: gradeData.uploadedBy,
          },
        })
      )
    );
  }

  // Step 10: Batch create logs (warnings, changes, failed uploads)
  for (let i = 0; i < logsToCreate.length; i += BATCH_SIZE) {
    const batch = logsToCreate.slice(i, i + BATCH_SIZE);
    await prisma.gradeLog.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ results });
}
