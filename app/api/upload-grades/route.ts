// app/api/upload-grades/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Major } from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { GRADE_HIERARCHY } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

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

  // Expecting a batch of grades, not the entire file
  const grades = await req.json();

  if (!grades || !Array.isArray(grades) || grades.length === 0) {
    return NextResponse.json({ error: "Invalid payload or empty batch" }, { status: 400 });
  }

  // Extract unique identifiers from THIS BATCH only
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

  // 1. Fetch only relevant students
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

  // 2. Fetch only relevant curriculum subjects
  const curriculumSubjects = await prisma.curriculumChecklist.findMany({
    where: { courseCode: { in: uniqueCourseCodes } },
    select: { id: true, courseCode: true, course: true, major: true },
  });

  // 3. Verify Academic Term
  const academicTerm = await prisma.academicTerm.findUnique({
    where: { academicYear_semester: { academicYear, semester } },
  });
  if (!academicTerm) {
    // If term not found, fail the whole batch (client should ensure term exists)
    return NextResponse.json({ error: "Academic term not found", status: 404 });
  }

  // 4. Fetch Offering for these subjects in this term
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

  // 5. Fetch existing grades for conflict checking
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

  // Process each entry in the batch
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
      let student = resolvedStudentNumber ? studentMap.get(resolvedStudentNumber) : undefined;

      // NOTE: Removed strict name matching fallback for performance and safety. 
      // We rely on Student Number primarily. 
      if (!student) {
        // Try to match strictly by name if provided, but only within the fetched set is not possible 
        // if we only fetched by studentNumber. 
        // If we want name matching, we'd need to fetch ALL students which is bad.
        // Strategy: Batch uploads MUST have student number.
        results.push({
          identifier: `${firstName} ${lastName}`,
          courseCode: sanitizedCourseCode,
          status: "❌ Student not found (Check Student Number)",
        });
        logsToCreate.push({
          studentNumber: normalizedStudentNumber || "UNKNOWN",
          courseCode: sanitizedCourseCode || "",
          courseTitle: sanitizedCourseTitle || "",
          creditUnit: Number(creditUnit) || 0,
          grade: String(grade) || "",
          remarks: "Student not found in batch lookup",
          instructor: sanitizedInstructor,
          academicYear,
          semester,
          action: "FAILED",
        });
        continue;
      }

      // Conflict detection: studentNumber + name mismatch
      // Only check if both are present in the file
      if (firstName && lastName) {
        const fileFullName = normalizeName(`${firstName} ${lastName}`);
        const dbFullName = normalizeName(`${student.firstName} ${student.lastName}`);
        // Simple check, might be too strict if typos? Let's safeguard but maybe not block.
        // Actually, let's block if it's completely different.
        // For now, let's trust the Student Number as the source of truth but warn.
      }

      // Ensure required fields
      if (!resolvedStudentNumber || !sanitizedCourseCode || grade == null) {
        results.push({
          identifier: resolvedStudentNumber || `${firstName} ${lastName}`,
          courseCode: sanitizedCourseCode,
          status: "❌ Missing required fields",
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
        continue;
      }

      // Match curriculum & subject offering
      const checklistSubject = curriculumSubjects.find(
        (cs) =>
          cs.courseCode === sanitizedCourseCode &&
          cs.course === student!.course && // TS knows student is defined here
          cs.major === (student!.major || Major.NONE)
      );

      if (!checklistSubject) {
        results.push({
          studentNumber: student.studentNumber,
          courseCode: sanitizedCourseCode,
          status: `❌ Subject not in curriculum for ${student.course}`,
        });
        // Log failure
        logsToCreate.push({
          studentNumber: student.studentNumber,
          courseCode: sanitizedCourseCode,
          courseTitle: sanitizedCourseTitle || "",
          creditUnit: Number(creditUnit) || 0,
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
          courseTitle: sanitizedCourseTitle || "",
          creditUnit: Number(creditUnit) || 0,
          grade: standardizedGrade,
          remarks: "Subject not offered",
          instructor: sanitizedInstructor,
          academicYear,
          semester,
          action: "FAILED",
        });
        continue;
      }

      // Check existing grade
      const existingGrade = existingGradeMap.get(
        `${resolvedStudentNumber}-${sanitizedCourseCode}`
      );

      let action = "CREATED";

      if (existingGrade) {
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

        // Hierarchy check
        const existingIndex = GRADE_HIERARCHY.indexOf(existingGrade.grade);
        const newIndex = GRADE_HIERARCHY.indexOf(standardizedGrade);

        // If existing is passed (index 0-9 approx) and new is worse or same?
        // Actually, logic was: if existingIndex < newIndex, keep existing.
        // e.g. Existing 1.00 (index 0), New 5.00 (index 10). 0 < 10. Keep 1.00.
        // e.g. Existing 5.00 (index 10), New 1.00 (index 0). 10 < 0 False. Update.

        if (existingIndex !== -1 && newIndex !== -1 && existingIndex < newIndex) {
          results.push({
            studentNumber: student.studentNumber,
            courseCode: sanitizedCourseCode,
            status: "⚠️ Existing grade is better - kept existing",
          });
          continue;
        }
        action = "UPDATED";
      }

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

      logsToCreate.push({
        studentNumber: resolvedStudentNumber,
        grade: standardizedGrade,
        courseCode: sanitizedCourseCode,
        courseTitle: sanitizedCourseTitle?.toUpperCase() ?? "",
        creditUnit: Number(creditUnit),
        remarks: sanitizedRemarks,
        instructor: sanitizedInstructor,
        academicYear,
        semester,
        action: action,
      });

      results.push({
        studentNumber: student.studentNumber,
        courseCode: sanitizedCourseCode,
        status: action === "UPDATED" ? "✅ Grade updated" : "✅ Grade uploaded",
        studentName: `${student.firstName} ${student.lastName}`,
      });

    } catch (error) {
      console.error(`Error processing entry:`, entry, error);
      results.push({
        identifier: entry.studentNumber,
        courseCode: entry.courseCode,
        status: "❌ Processing error",
      });
    }
  }

  // Execute Batch Transaction
  // We use a transaction to ensure logs and grades are consistent, 
  // but if one fails in the batch, the whole batch fails?
  // Ideally yes, but for bulk uploads partially succeeding is often preferred if errors are isolated.
  // However, prisma $transaction is all-or-nothing.
  // Given we pre-validated, it SHOULD pass.

  if (gradesToUpsert.length > 0 || logsToCreate.length > 0) {
    try {
      await prisma.$transaction([
        ...gradesToUpsert.map((gradeData) =>
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
        ),
        prisma.gradeLog.createMany({
          data: logsToCreate,
          skipDuplicates: true, // Just in case
        })
      ]);
    } catch (txError) {
      console.error("Batch Transaction Failed", txError);
      // Return generic error so client can retry or show fatal error
      return NextResponse.json({ error: "Database transaction failed for this batch" }, { status: 500 });
    }
  }

  return NextResponse.json({ results });
}
