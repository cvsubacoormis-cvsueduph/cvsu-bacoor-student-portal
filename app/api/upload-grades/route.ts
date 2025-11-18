import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import * as XLSX from "xlsx";
import { Major } from "@prisma/client";

export const runtime = "nodejs"; // Required for xlsx

// ---- Your same grade hierarchy ----
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

export async function POST(req: Request) {
  try {
    // ---------------------------
    // 1️⃣ Auth check
    // ---------------------------
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ---------------------------
    // 2️⃣ Extract file from formData()
    // ---------------------------
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // ---------------------------
    // 3️⃣ Read the Excel file (Buffer)
    // ---------------------------
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const grades = XLSX.utils.sheet_to_json(worksheet);

    if (!grades || grades.length === 0) {
      return NextResponse.json(
        {
          error: "Excel file is empty",
        },
        { status: 400 }
      );
    }

    // Results collector
    const results: any[] = [];

    // ---------------------------
    // 4️⃣ PROCESS EVERY GRADE ROW (YOUR ORIGINAL LOGIC)
    // ---------------------------
    for (const entry of grades) {
      try {
        // ------------------
        // Extract fields
        // ------------------
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
        } = entry as any;

        const normalizedStudentNumber = studentNumber
          ? String(studentNumber).replace(/-/g, "")
          : null;

        const sanitizedFirstName = sanitizeString(firstName);
        const sanitizedLastName = sanitizeString(lastName);
        const sanitizedCourseCode = sanitizeString(courseCode);
        const sanitizedCourseTitle = sanitizeString(courseTitle);
        const sanitizedRemarks = sanitizeString(remarks)?.toUpperCase() ?? "";
        const sanitizedInstructor =
          sanitizeString(instructor)?.toUpperCase() ?? "";

        // Required fields validation
        if (
          (!normalizedStudentNumber &&
            (!sanitizedFirstName || !sanitizedLastName)) ||
          !sanitizedCourseCode ||
          grade == null ||
          !academicYear ||
          !semester
        ) {
          results.push({
            identifier:
              normalizedStudentNumber ||
              `${sanitizedFirstName} ${sanitizedLastName}`,
            courseCode: sanitizedCourseCode,
            status:
              "❌ Missing required fields (studentNumber OR firstName+lastName required)",
          });
          continue;
        }

        // Normalize grade & reExam
        const standardizedGrade = normalizeGrade(grade);
        const standardizedReExam = normalizeGrade(reExam);

        if (!standardizedGrade) {
          results.push({
            identifier:
              normalizedStudentNumber ||
              `${sanitizedFirstName} ${sanitizedLastName}`,
            courseCode: sanitizedCourseCode,
            status: "❌ Invalid grade value",
          });
          continue;
        }

        // ------------------------
        // Check academic term
        // ------------------------
        const academicTerm = await prisma.academicTerm.findUnique({
          where: { academicYear_semester: { academicYear, semester } },
        });

        if (!academicTerm) {
          results.push({
            identifier:
              normalizedStudentNumber ||
              `${sanitizedFirstName} ${sanitizedLastName}`,
            courseCode: sanitizedCourseCode,
            status: "❌ Academic term not found",
          });
          continue;
        }

        // ------------------------
        // Find student
        // ------------------------
        let student;

        if (normalizedStudentNumber) {
          student = await prisma.student.findUnique({
            where: { studentNumber: normalizedStudentNumber },
          });
        } else {
          const matches = await prisma.student.findMany({
            where: {
              firstName: {
                equals: sanitizedFirstName ?? "",
                mode: "insensitive",
              },
              lastName: {
                equals: sanitizedLastName ?? "",
                mode: "insensitive",
              },
            },
          });

          if (matches.length === 0) {
            results.push({
              identifier: `${sanitizedFirstName} ${sanitizedLastName}`,
              courseCode: sanitizedCourseCode,
              status: "❌ Student not found",
            });
            continue;
          }

          if (matches.length > 1) {
            results.push({
              identifier: `${sanitizedFirstName} ${sanitizedLastName}`,
              courseCode: sanitizedCourseCode,
              status: `❌ Multiple students found`,
            });
            continue;
          }

          student = matches[0];
        }

        if (!student) {
          results.push({
            identifier:
              normalizedStudentNumber ||
              `${sanitizedFirstName} ${sanitizedLastName}`,
            courseCode: sanitizedCourseCode,
            status: "❌ Student not found",
          });
          continue;
        }

        // ------------------------
        // Curriculum subject
        // ------------------------
        const checklistSubject = await prisma.curriculumChecklist.findFirst({
          where: {
            courseCode: sanitizedCourseCode,
            course: student.course,
            major: student.major ?? Major.NONE,
          },
        });

        if (!checklistSubject) {
          results.push({
            studentNumber: student.studentNumber,
            courseCode: sanitizedCourseCode,
            status: "❌ Subject not part of curriculum",
          });
          continue;
        }

        // ------------------------
        // Subject Offering
        // ------------------------
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
            status: "❌ Subject not offered in this term",
          });
          continue;
        }

        // ------------------------
        // Check existing grade
        // ------------------------
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
          const existingIndex = GRADE_HIERARCHY.indexOf(existingGrade.grade);
          const newIndex = GRADE_HIERARCHY.indexOf(standardizedGrade);

          if (existingIndex < newIndex) {
            results.push({
              studentNumber: student.studentNumber,
              courseCode: sanitizedCourseCode,
              status: "⚠ Existing grade is better — NOT updated",
            });
            continue;
          }
        }

        // ------------------------
        // UPSERT GRADE
        // ------------------------
        await prisma.grade.upsert({
          where: {
            studentNumber_courseCode_academicYear_semester: {
              studentNumber: student.studentNumber,
              courseCode: sanitizedCourseCode,
              academicYear,
              semester,
            },
          },
          create: {
            student: {
              connect: { studentNumber: student.studentNumber },
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
            uploadedBy: user?.fullName ?? "",
          },
          update: {
            courseTitle: sanitizedCourseTitle?.toUpperCase() ?? "",
            creditUnit: Number(creditUnit),
            grade: standardizedGrade,
            reExam: standardizedReExam,
            remarks: sanitizedRemarks,
            instructor: sanitizedInstructor,
            subjectOffering: { connect: { id: subjectOffering.id } },
            uploadedBy: user?.fullName ?? "",
          },
        });

        // Log entry
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

        // Success record
        results.push({
          studentNumber: student.studentNumber,
          courseCode: sanitizedCourseCode,
          status: "Grade uploaded",
        });
      } catch (err) {
        results.push({
          entry,
          status: "❌ Server error processing this row",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
