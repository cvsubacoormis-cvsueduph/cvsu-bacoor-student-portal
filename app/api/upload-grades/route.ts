import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Major } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";

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

// 🔹 Helper to normalize numeric and special grade values
function normalizeGrade(value: any): string | null {
  if (!value) return null;
  const str = String(value).trim().toUpperCase();

  if (GRADE_HIERARCHY.includes(str)) {
    return str;
  }

  const num = parseFloat(str);
  return !isNaN(num) ? num.toFixed(2) : str;
}

// 🔹 Helper to sanitize strings from Excel (remove quotes, extra spaces, commas)
function sanitizeString(value: any): string | null {
  if (!value) return null;
  return String(value)
    .replace(/['"]+/g, "") // remove quotes
    .replace(/,/g, "") // remove stray commas
    .replace(/\s+/g, " ") // collapse spaces
    .trim();
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const grades = await req.json();

  if (!grades || !Array.isArray(grades)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const results = [];

  for (const entry of grades) {
    try {
      const {
        studentNumber,
        firstName,
        lastName,
        courseCode,
        courseTitle,
        creditUnit,
        grade,
        reExam,
        remarks,
        instructor,
        academicYear,
        semester,
      } = entry;

      // ✅ Normalize studentNumber (remove dashes if any)
      const normalizedStudentNumber = studentNumber
        ? String(studentNumber).replace(/-/g, "")
        : null;

      // ✅ Sanitize text inputs
      const sanitizedFirstName = sanitizeString(firstName);
      const sanitizedLastName = sanitizeString(lastName);
      const sanitizedCourseCode = sanitizeString(courseCode);
      const sanitizedCourseTitle = sanitizeString(courseTitle);
      const sanitizedRemarks = sanitizeString(remarks)?.toUpperCase() ?? "";
      const sanitizedInstructor =
        sanitizeString(instructor)?.toUpperCase() ?? "";

      // Validate required fields
      if (
        (!normalizedStudentNumber && (!firstName || !lastName)) ||
        !sanitizedCourseCode ||
        grade == null ||
        !academicYear ||
        !semester
      ) {
        results.push({
          identifier: normalizedStudentNumber || `${firstName} ${lastName}`,
          courseCode: sanitizedCourseCode,
          status:
            "❌ Missing required fields (need studentNumber OR firstName+lastName)",
        });
        continue;
      }

      // ✅ Normalize grade & reExam
      const standardizedGrade = normalizeGrade(grade);
      const standardizedReExam = normalizeGrade(reExam);

      if (!standardizedGrade) {
        results.push({
          identifier: normalizedStudentNumber || `${firstName} ${lastName}`,
          courseCode: sanitizedCourseCode,
          status: "❌ Invalid grade value",
        });
        continue;
      }

      // ✅ Check if academic term exists
      const academicTerm = await prisma.academicTerm.findUnique({
        where: { academicYear_semester: { academicYear, semester } },
      });

      if (!academicTerm) {
        results.push({
          identifier: normalizedStudentNumber || `${firstName} ${lastName}`,
          courseCode: sanitizedCourseCode,
          status: "❌ Academic term not found",
        });
        continue;
      }

      // ✅ Find student
      let student;
      if (normalizedStudentNumber) {
        student = await prisma.student.findUnique({
          where: { studentNumber: normalizedStudentNumber },
        });
      } else {
        const students = await prisma.student.findMany({
          where: {
            AND: [
              sanitizedFirstName
                ? {
                    firstName: {
                      equals: sanitizedFirstName,
                      mode: "insensitive",
                    },
                  }
                : {},
              sanitizedLastName
                ? {
                    lastName: {
                      equals: sanitizedLastName,
                      mode: "insensitive",
                    },
                  }
                : {},
            ],
          },
        });

        if (students.length === 0) {
          results.push({
            identifier:
              `${sanitizedFirstName ?? ""} ${sanitizedLastName ?? ""}`.trim(),
            courseCode: sanitizedCourseCode,
            status: "❌ Student not found by name",
          });
          continue;
        }

        if (students.length > 1) {
          results.push({
            identifier:
              `${sanitizedFirstName ?? ""} ${sanitizedLastName ?? ""}`.trim(),
            courseCode: sanitizedCourseCode,
            status: `❌ Multiple students found with names ${sanitizedFirstName} ${sanitizedLastName}`,
            possibleMatches: students.map((s) => ({
              studentNumber: s.studentNumber,
              firstName: s.firstName,
              lastName: s.lastName,
            })),
          });
          continue;
        }

        student = students[0];
      }

      if (!student) {
        results.push({
          identifier: normalizedStudentNumber || `${firstName} ${lastName}`,
          courseCode: sanitizedCourseCode,
          status: "❌ Student not found",
        });
        continue;
      }

      // ✅ Find curriculum subject
      const checklistSubject = await prisma.curriculumChecklist.findFirst({
        where: {
          courseCode: sanitizedCourseCode,
          course: student.course,
          major: student.major ? student.major : Major.NONE,
        },
      });

      if (!checklistSubject) {
        results.push({
          studentNumber: student.studentNumber,
          courseCode: sanitizedCourseCode,
          status: `❌ Subject not in curriculum for ${student.course}${
            student.major ? ` - ${student.major}` : ""
          }`,
        });
        continue;
      }

      // ✅ Check subject offering
      const subjectOffering = await prisma.subjectOffering.findFirst({
        where: {
          curriculumId: checklistSubject.id,
          academicYear,
          semester,
          isActive: true,
        },
      });

      if (!subjectOffering) {
        results.push({
          studentNumber: student.studentNumber,
          courseCode: sanitizedCourseCode,
          status: "❌ Subject not offered in selected terms",
        });
        continue;
      }

      // ✅ Check for existing grade
      const existingGrade = await prisma.grade.findUnique({
        where: {
          studentNumber_courseCode_academicYear_semester: {
            studentNumber: student.studentNumber,
            courseCode: sanitizedCourseCode,
            academicYear,
            semester,
          },
        },
      });

      if (existingGrade) {
        const existingGradeIndex = GRADE_HIERARCHY.indexOf(existingGrade.grade);
        const newGradeIndex = GRADE_HIERARCHY.indexOf(standardizedGrade);

        if (existingGradeIndex < newGradeIndex) {
          results.push({
            studentNumber: student.studentNumber,
            courseCode: sanitizedCourseCode,
            status:
              "⚠️ Existing grade is better - kept the existing grade instead",
          });
          continue;
        }
      }

      // ✅ Upsert grade
      await prisma.grade.upsert({
        where: {
          studentNumber_courseCode_academicYear_semester: {
            studentNumber: String(student.studentNumber),
            courseCode: sanitizedCourseCode,
            academicYear,
            semester,
          },
        },
        create: {
          student: {
            connect: { studentNumber: String(student.studentNumber) },
          },
          courseCode: sanitizedCourseCode,
          courseTitle: sanitizedCourseTitle?.toUpperCase() ?? "",
          creditUnit: Number(creditUnit),
          grade: standardizedGrade,
          reExam: standardizedReExam,
          remarks: sanitizedRemarks,
          instructor: sanitizedInstructor,
          academicTerm: {
            connect: { academicYear_semester: { academicYear, semester } },
          },
          subjectOffering: { connect: { id: subjectOffering.id } },
        },
        update: {
          courseTitle: sanitizedCourseTitle?.toUpperCase() ?? "",
          creditUnit: Number(creditUnit),
          grade: standardizedGrade,
          reExam: standardizedReExam,
          remarks: sanitizedRemarks,
          instructor: sanitizedInstructor,
          subjectOffering: { connect: { id: subjectOffering.id } },
        },
      });

      // ✅ Create log
      await prisma.gradeLog.create({
        data: {
          studentNumber: student.studentNumber,
          courseCode: sanitizedCourseCode,
          grade: standardizedGrade,
          remarks: sanitizedRemarks,
          instructor: sanitizedInstructor,
          academicYear,
          semester,
          action: existingGrade ? "UPDATED" : "CREATED",
        },
      });

      results.push({
        studentNumber: student.studentNumber,
        courseCode: sanitizedCourseCode,
        status: "✅ Grade uploaded",
        studentName: `${sanitizedFirstName ?? student.firstName} ${sanitizedLastName ?? student.lastName}`,
      });
    } catch (error) {
      console.error(`Error processing entry:`, entry, error);
      results.push({
        identifier:
          entry.studentNumber || `${entry.firstName} ${entry.lastName}`,
        courseCode: entry.courseCode,
        status: "❌ Server error processing this record",
      });
    }
  }

  return NextResponse.json({ results });
}
