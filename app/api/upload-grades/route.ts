import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Major, AcademicYear, Semester } from "@prisma/client";
import * as XLSX from "xlsx";
import { auth, currentUser } from "@clerk/nextjs/server";

export const runtime = "nodejs";

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

interface UploadResult {
  identifier?: string;
  studentNumber?: string;
  courseCode: string;
  status: string;
  studentName?: string;
  possibleMatches?: Array<{
    studentNumber: string;
    firstName: string;
    lastName: string;
  }>;
}
function normalizeGrade(value: any): string | null {
  if (!value) return null;
  const str = String(value).trim().toUpperCase();

  if (GRADE_HIERARCHY.includes(str)) {
    return str;
  }

  const num = parseFloat(str);
  return !isNaN(num) ? num.toFixed(2) : str;
}

function sanitizeString(value: any): string {
  if (!value) return "";
  return String(value).replace(/['"]+/g, "").replace(/,/g, "").trim();
}

export async function POST(req: Request) {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const academicYear = formData.get("academicYear") as string;
    const semester = formData.get("semester") as string;

    if (!file || !academicYear || !semester) {
      return NextResponse.json(
        { error: "Missing file, academicYear, or semester" },
        { status: 400 }
      );
    }

    // ✅ Parse Excel file SERVER-SIDE
    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: "",
    });

    if (!Array.isArray(jsonData) || jsonData.length === 0) {
      return NextResponse.json(
        { error: "Invalid Excel file or no data found" },
        { status: 400 }
      );
    }

    const results: UploadResult[] = [];

    for (const entry of jsonData) {
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
        } = entry;

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
          where: {
            academicYear_semester: {
              academicYear: academicYear as unknown as AcademicYear,
              semester: semester as unknown as Semester,
            },
          },
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
            academicYear: academicYear as unknown as AcademicYear,
            semester: semester as unknown as Semester,
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
              academicYear: academicYear as unknown as AcademicYear,
              semester: semester as unknown as Semester,
            },
          },
        });

        if (existingGrade) {
          const existingGradeIndex = GRADE_HIERARCHY.indexOf(
            existingGrade.grade
          );
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

        await prisma.grade.upsert({
          where: {
            studentNumber_courseCode_academicYear_semester: {
              studentNumber: String(student.studentNumber),
              courseCode: sanitizedCourseCode,
              academicYear: academicYear as unknown as AcademicYear,
              semester: semester as unknown as Semester,
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
              connect: {
                academicYear_semester: {
                  academicYear: academicYear as unknown as AcademicYear,
                  semester: semester as unknown as Semester,
                },
              },
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

        await prisma.gradeLog.create({
          data: {
            studentNumber: student.studentNumber,
            courseCode: sanitizedCourseCode,
            grade: standardizedGrade,
            remarks: sanitizedRemarks,
            instructor: sanitizedInstructor,
            academicYear: academicYear as unknown as AcademicYear,
            semester: semester as unknown as Semester,
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
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process file" },
      { status: 500 }
    );
  }
}
