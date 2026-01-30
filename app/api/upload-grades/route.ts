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

function normalizeCourseCode(code: string | null) {
  if (!code) return "";
  const cleanStr = String(code).replace(/['"]+,/g, "").trim();
  const noPunctuation = cleanStr.replace(/[-_.]/g, " ").replace(/\s+/g, " ");

  // Collapse spaces for regex matching
  const collapsed = noPunctuation.replace(/\s+/g, "");

  // Pattern: (Letters)(Numbers)(OptionalLetters)
  const match = collapsed.match(/^([A-Za-z]+)(\d+)([A-Za-z]*)$/);

  if (match) {
    const [_, prefix, num, suffix] = match;
    return `${prefix.toUpperCase()} ${num}${suffix.toLowerCase()}`;
  }

  // Fallback
  return noPunctuation.replace(/\s+/g, " ").trim().toUpperCase();
}

function levenshteinDistance(a: string, b: string): number {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }

  }

  return matrix[b.length][a.length];
}

function areNamesSimilar(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;
  if (name1 === name2) return true;

  const len = Math.max(name1.length, name2.length);
  if (len === 0) return true;

  // 1. strict fuzzy check on whole string
  const dist = levenshteinDistance(name1, name2);
  const similarity = 1 - dist / len;
  if (similarity >= 0.8) return true;

  // 2. Token retrieval check (handles "Name Middle Surname" vs "Name Surname" and typos in specific words)
  // Split into words
  const tokens1 = name1.split(" ").filter((t) => t.length > 1); // ignore single letters? Maybe keep them for initials
  const tokens2 = name2.split(" ").filter((t) => t.length > 1);

  if (tokens1.length === 0 || tokens2.length === 0) return false;

  const [shorter, longer] =
    tokens1.length < tokens2.length ? [tokens1, tokens2] : [tokens2, tokens1];

  let matches = 0;
  for (const sToken of shorter) {
    // For each token in shorter, is there a match in longer?
    let found = false;
    for (const lToken of longer) {
      if (sToken === lToken) {
        found = true;
        break;
      }
      // Word-level fuzzy
      const sLen = Math.max(sToken.length, lToken.length);
      const wDist = levenshteinDistance(sToken, lToken);
      if (1 - wDist / sLen >= 0.75) {
        // Tolerant word match
        found = true;
        break;
      }
    }
    if (found) matches++;
  }

  // If we matched all (or almost all) tokens of the shorter name
  return matches >= shorter.length;
}

function normalizeTitleForMatch(title: string) {
  let normalized = normalizeName(title);

  // Replace Roman Numerals (1-10) with Arabic
  // We check for isolated words "i", "ii", "iii" etc (since normalizeName lowercases)
  const romans: { [key: string]: string } = {
    "i": "1", "ii": "2", "iii": "3", "iv": "4", "v": "5",
    "vi": "6", "vii": "7", "viii": "8", "ix": "9", "x": "10"
  };

  return normalized.split(" ").map(word => romans[word] || word).join(" ");
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
        .map((g) => normalizeCourseCode(g.courseCode))
        .filter((code) => code !== "")
    ),
  ];

  const uniqueCourseTitles = [
    ...new Set(
      grades
        .map((g) => sanitizeString(g.courseTitle))
        .filter((t) => t && t !== "")
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
    .flatMap((g) => {
      const conditions = [];
      if (g.lastName) conditions.push({ lastName: { equals: g.lastName, mode: 'insensitive' as const } });
      if (g.firstName) conditions.push({ firstName: { equals: g.firstName, mode: 'insensitive' as const } });
      return conditions;
    });

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


  // 2. Fetch relevant curriculum subjects (Broadened for Fuzzy Match)
  // We need to fetch NOT ONLY the exact codes in the file, but also the ENTIRE curriculum 
  // for the students we found. This allows us to fuzzy match "ITEC 50" -> "ITEC 50A" within their valid subjects.

  const allFoundStudents = [...studentsByNumber, ...studentsByName];
  const uniqueCurricula = new Set(
    allFoundStudents
      .filter(s => s.course) // Ensure course is present
      .map(s => JSON.stringify({ course: s.course, major: s.major || Major.NONE }))
  );

  const curriculumConditions = Array.from(uniqueCurricula).map(str => {
    const parsed = JSON.parse(str);
    return {
      course: parsed.course,
      major: parsed.major // Major is required in schema, use NONE not null
    };
  });

  // Query: (Course + Major matches) OR (Code is in our explicit list - for global lookup fallback)
  const curriculumSubjects = await prisma.curriculumChecklist.findMany({
    where: {
      OR: [
        ...curriculumConditions,
        { courseCode: { in: uniqueCourseCodes } },
        { courseTitle: { in: uniqueCourseTitles as string[] } }
      ]
    },
    select: {
      id: true,
      courseCode: true,
      course: true,
      major: true,
      courseTitle: true,
      creditLec: true,
      creditLab: true
    },
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
      reExam: true,
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
      let sanitizedCourseCode = normalizeCourseCode(courseCode);
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
      let studentByName = mapByName.get(fileFullName);

      // Attempt 3: Scanner Fallback (if Map failed)
      // Iterate over our 'studentsByName' (which now contains everyone with matching LastName)
      // and check for fuzzy match on First Name.
      if (!studentByName && studentsByName.length > 0 && fileFullName) {
        studentByName = studentsByName.find(s => {
          const dbName = normalizeName(s.firstName + " " + s.lastName);
          return areNamesSimilar(dbName, fileFullName);
        });
      }

      if (studentByNum) {
        // We found a student with this number. Does the name match?
        const dbFullName = normalizeName(studentByNum.firstName + " " + studentByNum.lastName);

        if (fileFullName && dbFullName !== fileFullName) {
          // Mismatch! The student number points to "John", but the file says "Jane".
          if (areNamesSimilar(dbFullName, fileFullName)) {
            // Fuzzy match confirmed it's likely the same person (typo/middle name)
            resolvedStudent = studentByNum;
            identificationMethod = "ID_MATCH_FUZZY";
          } else if (studentByName) {
            // We found "Jane" under a different ID. Trust the Name if it's an EXACT/Normal match elsewhere.
            resolvedStudent = studentByName;
            identificationMethod = "NAME_CORRECTION";
          } else {
            // We didn't find "Jane" anywhere else, and it's not fuzzy similar to "John".
            // Name mismatch and target not found. Fail.

            // Allow override if file name is "empty-ish"? No, fileFullName checked above.
            resolvedStudent = undefined;
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

      let standardizedGrade = normalizeGrade(grade);
      let standardizedReExam = normalizeGrade(reExam);
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
      // Priority 1: Match Specific Course & Major
      let checklistSubject = curriculumSubjects.find(
        (cs) =>
          cs.courseCode === sanitizedCourseCode &&
          cs.course === targetStudent.course &&
          cs.major === (targetStudent.major || Major.NONE)
      );

      // Priority 2: Match Specific Course (Ignore Major)
      if (!checklistSubject) {
        checklistSubject = curriculumSubjects.find(
          (cs) =>
            cs.courseCode === sanitizedCourseCode &&
            cs.course === targetStudent.course
        );
      }

      // Priority 3: Global Match (Any Course) - "Make sure it exists in course curriculum no matter what course"
      if (!checklistSubject) {
        checklistSubject = curriculumSubjects.find(
          (cs) => cs.courseCode === sanitizedCourseCode
        );
      }

      // Priority 4: Fuzzy Match in Student's Curriculum (Course/Major)
      let isFuzzyCode = false;
      if (!checklistSubject) {
        // Filter to student's curriculum
        const candidates = curriculumSubjects.filter(cs =>
          cs.course === targetStudent.course &&
          cs.major === (targetStudent.major || Major.NONE)
        );

        let bestMatch = null;
        let bestDist = Infinity;

        for (const cand of candidates) {
          const dist = levenshteinDistance(cand.courseCode, sanitizedCourseCode);
          if (dist < bestDist) {
            bestDist = dist;
            bestMatch = cand;
          }
        }

        // Threshold: Allow distance 1 for short codes, maybe 2 for longer?
        // Or simple Ratio. 
        // "ITEC 50" (7 chars) vs "ITEC 50A" (8 chars) -> dist 1.
        // "ITEC 50" vs "ITEC 55" -> dist 1.
        // Let's be conservative: Distance <= 2 AND Similarity > 0.8
        const len = Math.max(sanitizedCourseCode.length, bestMatch?.courseCode.length || 0);
        const ratio = 1 - (bestDist / len);

        if (bestMatch && (bestDist <= 1 || (bestDist <= 2 && ratio >= 0.8))) {
          checklistSubject = bestMatch;
          sanitizedCourseCode = bestMatch.courseCode; // Auto-correct code
          isFuzzyCode = true;
        }
      }

      // Priority 5: Fallback by Course Title (Contextual - Student's Curriculum)
      // "Course Code is wrong, but Title is correct"
      // We check if the TITLE exists in the student's calculated curriculum.
      let isTitleFallback = false;
      if (!checklistSubject && sanitizedCourseTitle) {
        // Filter to student's curriculum first
        const studentCurriculum = curriculumSubjects.filter(cs =>
          cs.course === targetStudent.course &&
          cs.major === (targetStudent.major || Major.NONE)
        );

        // Normalize the file title using our robust name normalizer (removes punct, lowers case)
        const normalizedFileTitle = normalizeTitleForMatch(sanitizedCourseTitle);

        let bestTitleMatch = null;
        let bestTitleDist = Infinity;

        // Iterate and find best fuzzy match
        for (const cand of studentCurriculum) {
          const dbTitle = normalizeTitleForMatch(cand.courseTitle);
          // Optimization: Exact match check first
          if (dbTitle === normalizedFileTitle) {
            bestTitleMatch = cand;
            bestTitleDist = 0;
            break;
          }

          const dist = levenshteinDistance(dbTitle, normalizedFileTitle);
          if (dist < bestTitleDist) {
            bestTitleDist = dist;
            bestTitleMatch = cand;
          }
        }

        // Evaluate Best Match
        // Titles are long, so allow more distance but high ratio
        if (bestTitleMatch) {
          const dbTitleNorm = normalizeTitleForMatch(bestTitleMatch.courseTitle);
          const len = Math.max(normalizedFileTitle.length, dbTitleNorm.length);
          const ratio = 1 - (bestTitleDist / len);

          // Allow:
          // 1. Exact match (dist 0)
          // 2. Very high similarity (>0.9) - e.g. "Programming 1" vs "Programming I" (len ~13, dist 1 => 0.92)
          // 3. Or small distance (<=3) for longer strings provided ratio is decent
          if (bestTitleDist === 0 || (ratio >= 0.9 && bestTitleDist <= 3)) {
            checklistSubject = bestTitleMatch;
            sanitizedCourseCode = bestTitleMatch.courseCode;
            isTitleFallback = true;
          }
        }
      }

      // Priority 6: Fallback by Course Title (Global)
      // If not in student's curriculum, check if it exists globally (risky if titles duplicate, but taking first match)
      if (!checklistSubject && sanitizedCourseTitle) {
        const normalizedFileTitle = normalizeTitleForMatch(sanitizedCourseTitle);

        let bestGlobalMatch = null;
        let bestGlobalDist = Infinity;

        for (const cand of curriculumSubjects) {
          const dbTitle = normalizeTitleForMatch(cand.courseTitle);
          if (dbTitle === normalizedFileTitle) {
            bestGlobalMatch = cand;
            bestGlobalDist = 0;
            break;
          }
          const dist = levenshteinDistance(dbTitle, normalizedFileTitle);
          if (dist < bestGlobalDist) {
            bestGlobalDist = dist;
            bestGlobalMatch = cand;
          }
        }

        if (bestGlobalMatch) {
          const dbTitleNorm = normalizeTitleForMatch(bestGlobalMatch.courseTitle);
          const len = Math.max(normalizedFileTitle.length, dbTitleNorm.length);
          const ratio = 1 - (bestGlobalDist / len);

          if (bestGlobalDist === 0 || (ratio >= 0.9 && bestGlobalDist <= 3)) {
            checklistSubject = bestGlobalMatch;
            sanitizedCourseCode = bestGlobalMatch.courseCode;
            isTitleFallback = true;
          }
        }
      }

      let subjectOfferingId: string | null = null;
      let isLegacyUpload = false;
      let resolvedCreditUnit = Number(creditUnit);
      let resolvedCourseTitle = sanitizedCourseTitle?.toUpperCase() ?? "";

      if (checklistSubject) {
        const offering = offeringMap.get(checklistSubject.id);
        if (offering) {
          subjectOfferingId = offering.id;
        }
        // Use checklist data if available
        resolvedCreditUnit = (checklistSubject.creditLec || 0) + (checklistSubject.creditLab || 0);
        resolvedCourseTitle = checklistSubject.courseTitle || resolvedCourseTitle;
      }

      // Validation: Must exist in curriculum (unless Legacy Mode)
      // We no longer fail if !subjectOfferingId, provided it exists in curriculum.
      if (!checklistSubject) {
        // If strict mode, fail
        if (!isLegacyMode) {
          results.push({
            studentNumber: targetStudent.studentNumber,
            courseCode: sanitizedCourseCode,
            status: `❌ Subject not found in any curriculum`,
          });

          failedLogsToCreate.push({
            studentNumber: targetStudent.studentNumber,
            courseCode: sanitizedCourseCode,
            courseTitle: sanitizedCourseTitle || "",
            creditUnit: Number(creditUnit) || 0,
            grade: standardizedGrade,
            remarks: "Subject not in any curriculum",
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
      let finalInstructor = sanitizedInstructor;

      if (identificationMethod === "NAME_CORRECTION") {
        statusMsg = `Grade uploaded (Corrected ID by Name match)`;
        statusPrefix = "⚠️"; // Warn user we changed the ID
      } else if (identificationMethod === "NAME_RECOVERY") {
        const reason = normalizedStudentNumber ? "ID invalid" : "ID missing";
        statusMsg = `Grade uploaded (Found by Name, ${reason})`;
        statusPrefix = "⚠️";
      } else if (isFuzzyCode && checklistSubject) {
        statusMsg = `Grade uploaded (Fuzzy Match: ${sanitizedCourseCode} -> ${checklistSubject.courseCode})`;
        statusPrefix = "⚠️";
      } else if (isTitleFallback && checklistSubject) {
        statusMsg = `Grade uploaded (Corrected Code by Title: ${entry.courseCode || "MISSING"} -> ${checklistSubject.courseCode})`;
        statusPrefix = "⚠️";
      }

      if (existingGrade) {
        // Resolve Instructor: New one takes precedence usually, UNLESS it's empty and we have an existing one.
        // User wants to "map the instructor... without changing my grades".
        // If the new file has an instructor, we update it.
        // If the new file has NO instructor, we keep the existing one.
        if (!finalInstructor && existingGrade.instructor) {
          finalInstructor = existingGrade.instructor;
        }

        // Force Keep Existing Grade (User Request)
        standardizedGrade = existingGrade.grade;
        // Keep existing reExam if present, otherwise allow new one (though usually we shouldn't change it either if we are strictly preserving)
        // Let's assume strict preservation for integrity
        if (existingGrade.reExam) {
          standardizedReExam = existingGrade.reExam;
        }

        if (
          existingGrade.remarks === sanitizedRemarks &&
          existingGrade.instructor === finalInstructor
        ) {
          results.push({
            studentNumber: targetStudent.studentNumber,
            courseCode: sanitizedCourseCode,
            status: "✅ Grade already exists, no changes",
            studentName: `${targetStudent.firstName} ${targetStudent.lastName}`,
          });
          continue;
        }

        action = "UPDATED";
        statusMsg = "Instructor/Metadata updated (Grade preserved)";
      } else if (isLegacyMode && !subjectOfferingId) {
        action = "LEGACY_ENTRY";
        statusMsg = "Legacy Grade uploaded";
        statusPrefix = "⚠️";
      }

      gradesToUpsert.push({
        studentNumber: targetStudent.studentNumber,
        courseCode: sanitizedCourseCode,
        courseTitle: resolvedCourseTitle,
        creditUnit: resolvedCreditUnit,
        grade: standardizedGrade,
        reExam: standardizedReExam,
        remarks: sanitizedRemarks,
        instructor: finalInstructor,
        academicYear,
        semester,
        subjectOfferingId: subjectOfferingId, // Can be null now
        uploadedBy: user?.fullName ?? "",
      });

      logsToCreate.push({
        studentNumber: targetStudent.studentNumber,
        grade: standardizedGrade,
        courseCode: sanitizedCourseCode,
        courseTitle: resolvedCourseTitle,
        creditUnit: resolvedCreditUnit,
        remarks: sanitizedRemarks,
        instructor: finalInstructor,
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
      const sanitizedCourseCode = normalizeCourseCode(courseCode);
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
