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
  if (!name) return "";
  // Normalize accents: NFD separates accents from letters, regex removes them
  // e.g. "Peña" -> "Pena", "NUNO" -> "NUNO"
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Remove dots, commas, and other common punctuation, replace with space to avoid merging words
  const noPunctuation = normalized.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ");
  // Collapse multiple spaces into one and lower case
  return noPunctuation.replace(/\s+/g, " ").trim().toLowerCase();
}

export async function POST(req: Request) {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Expecting a batch of grades, not the entire file
  const grades = await req.json();

  if (!grades || !Array.isArray(grades) || grades.length === 0) {
    return NextResponse.json({ error: "Invalid payload or empty batch" }, { status: 400 });
  }

  // --- Security: Check for Legacy Mode Authorization ---
  const requestLegacyMode = grades[0]?.allowLegacy === true;
  const userRole = (user.publicMetadata?.role as string) || "";
  const canUseLegacyMode = ["admin", "superuser", "registrar"].includes(userRole);

  // Only enable legacy mode if requested AND authorized
  const isLegacyMode = requestLegacyMode && canUseLegacyMode;

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

  // Prepare names for lookup
  const namesToLookup = new Set<string>();
  grades.forEach(g => {
    if (g.firstName && g.lastName) {
      namesToLookup.add(normalizeName(g.firstName + " " + g.lastName));
      // Also add reverse order just in case (Last First)
      namesToLookup.add(normalizeName(g.lastName + " " + g.firstName));
    }
  });

  const { academicYear, semester } = grades[0] || {};
  if (!academicYear || !semester) {
    return NextResponse.json(
      { error: "Academic year and semester are required" },
      { status: 400 }
    );
  }

  // 1. Fetch students by Number AND by Name
  // We fetch all potential matches to cross-reference in memory
  const studentsByNumber = await prisma.student.findMany({
    where: { studentNumber: { in: uniqueStudentNumbers } },
    select: {
      studentNumber: true,
      firstName: true,
      lastName: true,
      course: true,
      major: true,
    },
  });

  // We can't easily do a "OR" with normalized names in SQL without raw query or unwanted complexity
  // So we fetch by studentNumber first (most common), and if we need names, we might need a broader search 
  // OR we rely on the fact that if the student number is wrong, the correct student MIGHT not be in 'studentsByNumber'
  // Strategy: Fetch ALL students that match the names? That might be too many if names are common (e.g. John Smith).
  // Better Strategy: 
  // Since we are processing a batch (e.g. 50 items), it is safe to try to fetch students matching these names logic wise.
  // Prisma doesn't support computed column filtering easily.
  // Let's rely on fetching by studentNumber FIRST. If that fails or mismatches, we need to find the student by name.
  // To avoid N+1, let's try to fetch students that match the First/Last names in the batch.
  // We can use OR conditions for the batch.

  const nameConditions = grades
    .filter((g) => g.firstName && g.lastName)
    .map((g) => ({
      firstName: { equals: g.firstName, mode: 'insensitive' as const },
      lastName: { equals: g.lastName, mode: 'insensitive' as const }
    }));

  // Dedup name conditions to avoid too large query
  // Actually, 'contains' or 'mode: insensitive' is good. 
  // Let's construct a findMany with OR.

  let studentsByName: typeof studentsByNumber = [];
  if (nameConditions.length > 0) {
    // Chunking name queries if too many? Batch is 50, so 50 ORs is acceptable for Postgres.
    studentsByName = await prisma.student.findMany({
      where: {
        OR: nameConditions
      },
      select: {
        studentNumber: true,
        firstName: true,
        lastName: true,
        course: true,
        major: true,
      }
    });
  }

  // Indexing
  const mapByNumber = new Map(studentsByNumber.map((s) => [s.studentNumber, s]));
  const mapByName = new Map<string, typeof studentsByNumber[0]>();

  // Helper to store in mapByName
  const addToNameMap = (s: typeof studentsByNumber[0]) => {
    const n1 = normalizeName(s.firstName + " " + s.lastName);
    const n2 = normalizeName(s.lastName + " " + s.firstName); // Last First support
    // We store both permutations to be safe, prioritizing First Last
    if (!mapByName.has(n1)) mapByName.set(n1, s);
    if (!mapByName.has(n2)) mapByName.set(n2, s);
  };

  studentsByNumber.forEach(addToNameMap);
  studentsByName.forEach(addToNameMap);


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
    return NextResponse.json(
      {
        error: `Academic term not found for Year: ${academicYear}, Semester: ${semester}. Please contact the administrator to initialize this term.`
      },
      { status: 404 }
    );
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
  // We need to know who the student IS first before checking conflicts.
  // Actually, we can fetch existing grades based on the resolved student numbers LATER 
  // OR we fetch based on the student numbers we found in step 1.
  const allFoundStudentNumbers = [...new Set([...studentsByNumber, ...studentsByName].map(s => s.studentNumber))];

  const existingGrades = await prisma.grade.findMany({
    where: {
      studentNumber: { in: allFoundStudentNumbers },
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
  const failedLogsToCreate = []; // Separate array for failed logs

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

      // --- Student Identification Logic ---

      const fileFullName = normalizeName((firstName || "") + " " + (lastName || ""));
      let resolvedStudent: typeof studentsByNumber[0] | undefined;
      let identificationMethod = "";

      // Attempt 1: Look up by Student Number
      const studentByNum = normalizedStudentNumber ? mapByNumber.get(normalizedStudentNumber) : undefined;

      // Attempt 2: Look up by Name
      const studentByName = mapByName.get(fileFullName);

      if (studentByNum) {
        // We found a student with this number. Does the name match?
        const dbFullName = normalizeName(studentByNum.firstName + " " + studentByNum.lastName);

        if (fileFullName && dbFullName !== fileFullName) {
          // Mismatch! The student number points to "John", but the file says "Jane".
          if (studentByName) {
            // We found "Jane" under a different ID. Trust the Name (User Requirement).
            resolvedStudent = studentByName;
            identificationMethod = "NAME_CORRECTION"; // Found by name, ignored wrong ID
          } else {
            // We didn't find "Jane" anywhere.
            // This is dangerous. The user said "one student number owns by 5 to 8 students".
            // Use case: The ID in file is "123". DB has "123" -> "John". File says "123" -> "Jane".
            // If we accept "John", we give "Jane's" grade to "John". BAD.
            // We MUST reject if names don't match and we can't find the real student.
            // UNLESS the file has no name columns? But schema requires them now implicitly for this logic.

            // If name in file is empty/missing, we have to trust ID?
            if (!fileFullName) {
              resolvedStudent = studentByNum;
              identificationMethod = "ID_OññNLY";
            } else {
              // Name mismatch and target not found. Fail.
              resolvedStudent = undefined;
            }
          }
        } else {
          // Name matches (or fuzzy match passed), or file name is missing.
          resolvedStudent = studentByNum;
          identificationMethod = "ID_MATCH";
        }
      } else {
        // Number not found in DB.
        if (studentByName) {
          // But we found the student by Name!
          resolvedStudent = studentByName;
          identificationMethod = "NAME_RECOVERY"; // Recovered by name
        }
      }

      if (!resolvedStudent) {
        let errorMsg = "Student not found";
        if (studentByNum && fileFullName) {
          errorMsg = `Name mismatch: ID belongs to ${studentByNum.firstName} ${studentByNum.lastName}, but file says ${firstName} ${lastName}`;
        } else if (normalizedStudentNumber && !studentByNum && !studentByName) {
          errorMsg = `Student # ${normalizedStudentNumber} not found, and name search failed`;
        }

        results.push({
          identifier: `${firstName} ${lastName}`,
          courseCode: sanitizedCourseCode,
          status: `❌ ${errorMsg}`,
        });
        failedLogsToCreate.push({
          studentNumber: normalizedStudentNumber || "UNKNOWN",
          courseCode: sanitizedCourseCode || "",
          courseTitle: sanitizedCourseTitle || "",
          creditUnit: Number(creditUnit) || 0,
          grade: String(grade) || "",
          remarks: errorMsg,
          instructor: sanitizedInstructor,
          academicYear,
          semester,
          action: "FAILED",
          importedName: `${firstName || ""} ${lastName || ""}`.trim(),
        });
        continue;
      }

      const targetStudent = resolvedStudent; // Validated student

      // Ensure required fields
      if (!sanitizedCourseCode || grade == null) {
        results.push({
          identifier: targetStudent.studentNumber,
          courseCode: sanitizedCourseCode,
          status: "❌ Missing required fields",
        });
        failedLogsToCreate.push({
          studentNumber: targetStudent.studentNumber,
          courseCode: sanitizedCourseCode || "",
          courseTitle: sanitizedCourseTitle || "",
          creditUnit: Number(creditUnit) || 0,
          grade: String(grade) || "",
          remarks: "Missing required fields (Course Code or Grade)",
          instructor: sanitizedInstructor,
          academicYear,
          semester,
          action: "FAILED",
          importedName: `${firstName || ""} ${lastName || ""}`.trim(),
        });
        continue;
      }

      const standardizedGrade = normalizeGrade(grade);
      const standardizedReExam = normalizeGrade(reExam);
      if (!standardizedGrade) {
        results.push({
          identifier: targetStudent.studentNumber,
          courseCode: sanitizedCourseCode,
          status: "❌ Invalid grade value",
        });
        failedLogsToCreate.push({
          studentNumber: targetStudent.studentNumber,
          courseCode: sanitizedCourseCode || "",
          courseTitle: sanitizedCourseTitle || "",
          creditUnit: Number(creditUnit) || 0,
          grade: String(grade) || "",
          remarks: "Invalid grade value",
          instructor: sanitizedInstructor,
          academicYear,
          semester,
          action: "FAILED",
          importedName: `${firstName || ""} ${lastName || ""}`.trim(),
        });
        continue;
      }

      // Match curriculum & subject offering
      const checklistSubject = curriculumSubjects.find(
        (cs) =>
          cs.courseCode === sanitizedCourseCode &&
          cs.course === targetStudent.course &&
          cs.major === (targetStudent.major || Major.NONE)
      );

      let subjectOfferingId: string | null = null;
      let isLegacyUpload = false;

      if (checklistSubject) {
        const offering = offeringMap.get(checklistSubject.id);
        if (offering) {
          subjectOfferingId = offering.id;
        }
      }

      if (!subjectOfferingId) {
        // If strict mode, fail
        if (!isLegacyMode) {
          const statusMsg = checklistSubject
            ? "❌ Subject not offered in selected term"
            : `❌ Subject not in curriculum for ${targetStudent.course}`;

          results.push({
            studentNumber: targetStudent.studentNumber,
            courseCode: sanitizedCourseCode,
            status: statusMsg,
          });

          failedLogsToCreate.push({
            studentNumber: targetStudent.studentNumber,
            courseCode: sanitizedCourseCode,
            courseTitle: sanitizedCourseTitle || "",
            creditUnit: Number(creditUnit) || 0,
            grade: standardizedGrade,
            remarks: checklistSubject ? "Subject not offered" : "Subject not in curriculum",
            instructor: sanitizedInstructor,
            academicYear,
            semester,
            action: "FAILED",
            importedName: `${firstName || ""} ${lastName || ""}`.trim(),
          });
          continue;
        } else {
          // Legacy Mode: Allow without link
          isLegacyUpload = true;
        }
      }

      // Check existing grade
      const existingGrade = existingGradeMap.get(
        `${targetStudent.studentNumber}-${sanitizedCourseCode}`
      );

      let action = "CREATED";
      let statusPrefix = "✅";
      let statusMsg = "Grade uploaded";

      if (identificationMethod === "NAME_CORRECTION") {
        statusMsg = `Grade uploaded (Corrected ID by Name match)`;
        statusPrefix = "⚠️"; // Warn user we changed the ID
      } else if (identificationMethod === "NAME_RECOVERY") {
        statusMsg = `Grade uploaded (Found by Name, ID invalid)`;
        statusPrefix = "⚠️";
      }

      if (existingGrade) {
        if (
          existingGrade.grade === standardizedGrade &&
          existingGrade.remarks === sanitizedRemarks &&
          existingGrade.instructor === sanitizedInstructor
        ) {
          results.push({
            studentNumber: targetStudent.studentNumber,
            courseCode: sanitizedCourseCode,
            status: "✅ Grade already exists, no changes",
            studentName: `${targetStudent.firstName} ${targetStudent.lastName}`,
          });
          continue;
        }

        // Hierarchy check
        const existingIndex = GRADE_HIERARCHY.indexOf(existingGrade.grade);
        const newIndex = GRADE_HIERARCHY.indexOf(standardizedGrade);

        if (existingIndex !== -1 && newIndex !== -1 && existingIndex < newIndex) {
          results.push({
            studentNumber: targetStudent.studentNumber,
            courseCode: sanitizedCourseCode,
            status: "⚠️ Existing grade is better - kept existing",
            studentName: `${targetStudent.firstName} ${targetStudent.lastName}`,
          });
          continue;
        }
        action = "UPDATED";
        statusMsg = "Grade updated";
      } else if (isLegacyMode && !subjectOfferingId) {
        action = "LEGACY_ENTRY";
        statusMsg = "Legacy Grade uploaded";
        statusPrefix = "⚠️";
      }

      gradesToUpsert.push({
        studentNumber: targetStudent.studentNumber,
        courseCode: sanitizedCourseCode,
        courseTitle: sanitizedCourseTitle?.toUpperCase() ?? "",
        creditUnit: Number(creditUnit),
        grade: standardizedGrade,
        reExam: standardizedReExam,
        remarks: sanitizedRemarks,
        instructor: sanitizedInstructor,
        academicYear,
        semester,
        subjectOfferingId: subjectOfferingId, // Can be null now
        uploadedBy: user?.fullName ?? "",
      });

      logsToCreate.push({
        studentNumber: targetStudent.studentNumber,
        grade: standardizedGrade,
        courseCode: sanitizedCourseCode,
        courseTitle: sanitizedCourseTitle?.toUpperCase() ?? "",
        creditUnit: Number(creditUnit),
        remarks: sanitizedRemarks,
        instructor: sanitizedInstructor,
        academicYear,
        semester,
        action: action,
        importedName: `${firstName || ""} ${lastName || ""}`.trim(),
      });

      results.push({
        studentNumber: targetStudent.studentNumber,
        courseCode: sanitizedCourseCode,
        status: `${statusPrefix} ${statusMsg}`,
        studentName: `${targetStudent.firstName} ${targetStudent.lastName}`,
      });

    } catch (error) {
      console.error(`Error processing entry:`, entry, error);
      const {
        studentNumber,
        lastName,
        firstName,
        courseCode,
        creditUnit,
        courseTitle,
        grade,
        instructor,
      } = entry;

      const normalizedStudentNumber = studentNumber
        ? String(studentNumber).replace(/-/g, "")
        : null;
      const sanitizedCourseCode = sanitizeString(courseCode);
      const sanitizedCourseTitle = sanitizeString(courseTitle);
      const sanitizedInstructor = sanitizeString(instructor)?.toUpperCase() ?? "";

      results.push({
        identifier: normalizedStudentNumber || `${firstName} ${lastName}`,
        courseCode: sanitizedCourseCode,
        status: "❌ Processing error",
      });

      failedLogsToCreate.push({
        studentNumber: normalizedStudentNumber || "UNKNOWN",
        courseCode: sanitizedCourseCode || "",
        courseTitle: sanitizedCourseTitle || "",
        creditUnit: Number(creditUnit) || 0,
        grade: String(grade) || "",
        remarks: `Processing error: ${error instanceof Error ? error.message : "Unknown error"}`,
        instructor: sanitizedInstructor,
        academicYear,
        semester,
        action: "FAILED",
        importedName: `${firstName || ""} ${lastName || ""}`.trim(),
      });
    }
  }

  // Save failed logs separately (outside transaction so they persist even if grades fail)
  if (failedLogsToCreate.length > 0) {
    try {
      await prisma.gradeLog.createMany({
        data: failedLogsToCreate,
        skipDuplicates: true,
      });
    } catch (logError) {
      console.error("Failed to save error logs:", logError);
      // Don't fail the whole batch if logging fails
    }
  }

  // Execute Batch Transaction for successful grades and their logs
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
              subjectOffering: gradeData.subjectOfferingId ? { connect: { id: gradeData.subjectOfferingId } } : undefined,
              uploadedBy: gradeData.uploadedBy,
            },
            update: {
              courseTitle: gradeData.courseTitle,
              creditUnit: gradeData.creditUnit,
              grade: gradeData.grade,
              reExam: gradeData.reExam,
              remarks: gradeData.remarks,
              instructor: gradeData.instructor,
              subjectOffering: gradeData.subjectOfferingId ? { connect: { id: gradeData.subjectOfferingId } } : { disconnect: true },
              uploadedBy: gradeData.uploadedBy,
            },
          })
        ),
        prisma.gradeLog.createMany({
          data: logsToCreate,
          skipDuplicates: true,
        })
      ]);
    } catch (txError) {
      console.error("Batch Transaction Failed", txError);
      return NextResponse.json({ error: "Database transaction failed for this batch" }, { status: 500 });
    }
  }

  return NextResponse.json({ results });
}
