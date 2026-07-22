"use server";

import prisma from "@/lib/prisma";
import { AcademicYear, Major, Prisma, Semester } from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";

export type StudentSearchResult = {
  studentNumber: string;
  firstName: string;
  lastName: string;
  course: string;
  major: string;
};

export type SearchResponse = {
  data: StudentSearchResult[];
  meta: {
    total: number;
    page: number;
    totalPages: number;
  };
};

export type StudentDetails = {
  studentNumber: string;
  firstName: string;
  lastName: string;
  middleInit?: string;
  course: string;
  major: string;
  status: string;
  email?: string;
  phone?: string;
  address: string;
  grades: Array<{
    courseCode: string;
    courseTitle: string;
    grade: string;
    semester: Semester;
    academicYear: AcademicYear;
    instructor: string;
  }>;
};

export type GradeData = {
  studentNumber: string;
  firstName: string;
  lastName: string;
  academicYear: AcademicYear;
  semester: Semester;
  courseCode: string;
  creditUnit: number;
  courseTitle: string;
  grade: string;
  reExam?: string;
  remarks?: string;
  instructor: string;
  isResolved: boolean;
  changeReason?: string;
};

export async function searchStudent(
  query: string,
  searchType: "studentNumber" | "name",
  page: number = 1,
  limit: number = 10,
): Promise<SearchResponse> {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const allowedRoles = [
    "admin",
    "superuser",
    "registrar",
    "registrar_staff",
    "faculty",
  ];
  if (!role || !allowedRoles.includes(role)) {
    throw new Error("Forbidden: insufficient permissions.");
  }
  if (!query.trim()) {
    throw new Error("Search query cannot be empty");
  }

  const skip = (page - 1) * limit;

  const whereClause =
    searchType === "studentNumber"
      ? {
          studentNumber: {
            contains: query,
            mode: "insensitive" as const,
          },
        }
      : {
          OR: [
            {
              firstName: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              lastName: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
          ],
        };

  const [total, results] = await prisma.$transaction([
    prisma.student.count({ where: whereClause }),
    prisma.student.findMany({
      where: whereClause,
      select: {
        studentNumber: true,
        firstName: true,
        lastName: true,
        course: true,
        major: true,
      },
      skip,
      take: limit,
      orderBy: { lastName: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  // Ensure major is a string (not null)
  return {
    data: results.map((s) => ({
      studentNumber: s.studentNumber,
      firstName: s.firstName,
      lastName: s.lastName,
      course: s.course,
      major: s.major ?? "",
    })),
    meta: {
      total,
      page,
      totalPages,
    },
  };
}

export async function getStudentDetails(
  studentNumber: string,
): Promise<StudentDetails> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await currentUser();
  const role = (user?.publicMetadata?.role as string) || "";
  const allowedRoles = [
    "admin",
    "superuser",
    "registrar",
    "registrar_staff",
    "faculty",
  ];
  if (!allowedRoles.includes(role)) {
    throw new Error("Forbidden");
  }

  if (!studentNumber.trim()) {
    throw new Error("Student number cannot be empty");
  }

  const student = await prisma.student.findUnique({
    where: { studentNumber },
    include: {
      grades: {
        orderBy: [{ academicYear: "desc" }, { semester: "desc" }],
        select: {
          courseCode: true,
          courseTitle: true,
          grade: true,
          semester: true,
          academicYear: true,
          instructor: true,
        },
      },
    },
  });

  if (!student) {
    throw new Error("Student not found");
  }

  return {
    studentNumber: student.studentNumber,
    firstName: student.firstName,
    lastName: student.lastName,
    middleInit: student.middleInit || "",
    course: student.course,
    major: student.major || "",
    status: student.status,
    email: student.email || "",
    phone: student.phone || "",
    address: student.address,
    grades: student.grades,
  };
}

export type AddManualGradeResult = {
  success: boolean;
  pending?: boolean;
  pendingId?: string;
  message: string;
};

export async function addManualGrade(
  gradeData: GradeData,
): Promise<AddManualGradeResult> {
  const user = await currentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const userRole = (user?.publicMetadata?.role as string) || "";
  const allowedRoles = [
    "admin",
    "superuser",
    "registrar",
    "registrar_staff",
    "faculty",
  ];
  if (!allowedRoles.includes(userRole)) {
    throw new Error("Forbidden: insufficient permissions.");
  }

  const isAdmin = userRole === "admin" || userRole === "superuser";
  const isDirectModify =
    userRole === "admin" ||
    userRole === "superuser" ||
    userRole === "registrar" ||
    userRole === "faculty";
  const isRegistrarStaff = userRole === "registrar_staff";

  const settingValue = await prisma.systemSettings.findUnique({
    where: { key: "UPLOAD_GRADES_ENABLED" },
  });
  const isUploadEnabled = settingValue?.value !== "false";

  if (!isUploadEnabled && !isAdmin) {
    throw new Error(
      "Uploading grades is currently disabled by administrators.",
    );
  }

  // Validate required fields
  if (
    !gradeData.studentNumber ||
    !gradeData.academicYear ||
    !gradeData.semester ||
    !gradeData.courseCode ||
    !gradeData.courseTitle ||
    gradeData.creditUnit === undefined ||
    !gradeData.grade ||
    !gradeData.instructor
  ) {
    throw new Error("Missing required fields");
  }

  // ------------------------------------------------------------------
  // Faculty: force instructor to their own name — prevent impersonation
  // ------------------------------------------------------------------
  if (userRole === "faculty") {
    gradeData.instructor = user?.fullName || gradeData.instructor;
  }

  // ------------------------------------------------------------------
  // registrar_staff → create pending change instead of applying directly
  // ------------------------------------------------------------------
  if (isRegistrarStaff) {
    const existingGrade = await prisma.grade.findFirst({
      where: {
        studentNumber: gradeData.studentNumber,
        courseCode: gradeData.courseCode.toUpperCase(),
        academicYear: gradeData.academicYear,
        semester: gradeData.semester,
      },
    });

    const isUpdate = !!existingGrade;

    const pending = await prisma.pendingGradeChange.create({
      data: {
        action: isUpdate ? "UPDATE" : "CREATE",
        studentNumber: gradeData.studentNumber,
        gradeId: existingGrade?.id ?? null,
        gradeData: {
          courseCode: gradeData.courseCode,
          creditUnit: Number(gradeData.creditUnit),
          courseTitle: gradeData.courseTitle,
          grade: gradeData.grade,
          reExam: gradeData.reExam ?? null,
          remarks: gradeData.remarks ?? "",
          instructor: gradeData.instructor,
          studentNumber: gradeData.studentNumber,
          academicYear: gradeData.academicYear,
          semester: gradeData.semester,
          uploadedBy: user?.fullName || "",
          ...(existingGrade
            ? {
                _previous: {
                  courseCode: existingGrade.courseCode,
                  creditUnit: existingGrade.creditUnit,
                  courseTitle: existingGrade.courseTitle,
                  grade: existingGrade.grade,
                  remarks: existingGrade.remarks ?? "",
                  instructor: existingGrade.instructor,
                },
              }
            : {}),
        },
        courseCode: gradeData.courseCode,
        academicYear: gradeData.academicYear,
        semester: gradeData.semester,
        requestedById: user.id,
        requestedByName: user?.fullName || "",
        requestedRole: userRole,
        status: "PENDING",
        changeReason: gradeData.changeReason ?? null,
      },
    });

    return {
      success: true,
      pending: true,
      pendingId: pending.id,
      message: isUpdate
        ? "Grade update sent for registrar approval."
        : "Grade submission sent for registrar approval.",
    };
  }

  // ------------------------------------------------------------------
  // faculty updating an existing grade → pending approval (when enabled)
  // ------------------------------------------------------------------
  const facultyApprovalSetting = await prisma.systemSettings.findUnique({
    where: { key: "FACULTY_UPDATE_REQUIRES_APPROVAL" },
  });
  const isFacultyApprovalEnabled = facultyApprovalSetting?.value !== "false";

  if (isFacultyApprovalEnabled && userRole === "faculty") {
    const existingGrade = await prisma.grade.findFirst({
      where: {
        studentNumber: gradeData.studentNumber,
        courseCode: gradeData.courseCode.toUpperCase(),
        academicYear: gradeData.academicYear,
        semester: gradeData.semester,
      },
    });

    if (existingGrade) {
      const pending = await prisma.pendingGradeChange.create({
        data: {
          action: "UPDATE",
          studentNumber: gradeData.studentNumber,
          gradeId: existingGrade.id,
          gradeData: {
            courseCode: gradeData.courseCode,
            creditUnit: Number(gradeData.creditUnit),
            courseTitle: gradeData.courseTitle,
            grade: gradeData.grade,
            reExam: gradeData.reExam ?? null,
            remarks: gradeData.remarks ?? "",
            instructor: gradeData.instructor,
            studentNumber: gradeData.studentNumber,
            academicYear: gradeData.academicYear,
            semester: gradeData.semester,
            uploadedBy: user?.fullName || "",
            _previous: {
              courseCode: existingGrade.courseCode,
              creditUnit: existingGrade.creditUnit,
              courseTitle: existingGrade.courseTitle,
              grade: existingGrade.grade,
              remarks: existingGrade.remarks ?? "",
              instructor: existingGrade.instructor,
            },
          },
          courseCode: gradeData.courseCode,
          academicYear: gradeData.academicYear,
          semester: gradeData.semester,
          requestedById: user.id,
          requestedByName: user?.fullName || "",
          requestedRole: userRole,
          status: "PENDING",
          changeReason: gradeData.changeReason ?? null,
        },
      });

      return {
        success: true,
        pending: true,
        pendingId: pending.id,
        message: "Grade update sent for registrar approval.",
      };
    }
  }

  // ------------------------------------------------------------------
  // admin / superuser / registrar / faculty (new) → apply immediately
  // ------------------------------------------------------------------
  await prisma.$transaction(async (prisma) => {
    // 1. Ensure the academic term exists
    await prisma.academicTerm.upsert({
      where: {
        academicYear_semester: {
          academicYear: gradeData.academicYear,
          semester: gradeData.semester,
        },
      },
      create: {
        academicYear: gradeData.academicYear,
        semester: gradeData.semester,
      },
      update: {},
    });

    // 2. Find the subject offering
    const subjectOffering = await prisma.subjectOffering.findFirst({
      where: {
        academicYear: gradeData.academicYear,
        semester: gradeData.semester,
        curriculum: {
          courseCode: gradeData.courseCode,
        },
      },
    });

    // 3. Prepare the base data for upsert
    const baseData = {
      courseTitle: gradeData.courseTitle.toUpperCase(),
      creditUnit: Number(gradeData.creditUnit),
      grade: gradeData.grade,
      reExam: gradeData.reExam ?? null,
      remarks: String(gradeData.remarks),
      instructor: gradeData.instructor,
      academicYear: gradeData.academicYear,
      semester: gradeData.semester,
    };

    // 4. Upsert the grade record with proper type handling
    if (subjectOffering) {
      await prisma.grade.upsert({
        where: {
          studentNumber_courseCode_academicYear_semester: {
            studentNumber: gradeData.studentNumber,
            courseCode: gradeData.courseCode.toUpperCase(),
            academicYear: gradeData.academicYear,
            semester: gradeData.semester,
          },
        },
        create: {
          ...baseData,
          studentNumber: gradeData.studentNumber,
          courseCode: gradeData.courseCode.toUpperCase(),
          subjectOfferingId: subjectOffering.id,
          uploadedBy: user?.fullName || "",
        },
        update: {
          ...baseData,
          subjectOfferingId: subjectOffering.id,
        },
      });
    } else {
      await prisma.grade.upsert({
        where: {
          studentNumber_courseCode_academicYear_semester: {
            studentNumber: gradeData.studentNumber,
            courseCode: gradeData.courseCode.toUpperCase(),
            academicYear: gradeData.academicYear,
            semester: gradeData.semester,
          },
        },
        create: {
          ...baseData,
          studentNumber: gradeData.studentNumber,
          courseCode: gradeData.courseCode.toUpperCase(),
          uploadedBy: user?.fullName || "",
        },
        update: baseData,
      });
    }

    // 5. Create a log entry
    await prisma.gradeLog.create({
      data: {
        studentNumber: gradeData.studentNumber,
        courseCode: gradeData.courseCode.toUpperCase(),
        courseTitle: gradeData.courseTitle.toUpperCase(),
        creditUnit: Number(gradeData.creditUnit),
        grade: gradeData.grade,
        remarks: gradeData.remarks,
        instructor: gradeData.instructor,
        academicYear: gradeData.academicYear,
        semester: gradeData.semester,
        action: "MANUAL_ENTRY",
        changeReason: gradeData.changeReason ?? null,
      },
    });
  });

  return {
    success: true,
    pending: false,
    message: "Grade added successfully.",
  };
}

type CheckExsistingGradeParams = {
  studentNumber: string;
  courseCode: string;
  academicYear: AcademicYear;
  semester: Semester;
};

export async function checkExsistingGrade({
  studentNumber,
  courseCode,
  academicYear,
  semester,
}: CheckExsistingGradeParams) {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const allowedRoles = [
    "admin",
    "superuser",
    "registrar",
    "registrar_staff",
    "faculty",
  ];
  if (!role || !allowedRoles.includes(role)) {
    throw new Error("Forbidden: insufficient permissions.");
  }

  const existing = await prisma.grade.findFirst({
    where: {
      studentNumber,
      courseCode,
      academicYear,
      semester,
    },
  });

  return !!existing;
}

// ── Bulk edit course code & course title ────────────────────────────────

export type BulkUpdateGradeCourseInfoResult = {
  success: boolean;
  updatedCount: number;
  failedCount: number;
  errors: string[];
};

export async function updateGradeCourseInfoBulk(params: {
  entries: {
    gradeId: string;
    studentNumber: string;
    courseCode: string;
    courseTitle: string;
  }[];
  academicYear: AcademicYear;
  semester: Semester;
}): Promise<BulkUpdateGradeCourseInfoResult> {
  const { entries, academicYear, semester } = params;

  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const userRole = user.publicMetadata?.role as string | undefined;
  if (
    userRole !== "admin" &&
    userRole !== "superuser" &&
    userRole !== "registrar"
  ) {
    throw new Error("Forbidden: only admin, superuser, and registrar can edit grade course info.");
  }

  if (!entries || entries.length === 0) {
    throw new Error("No entries provided.");
  }

  // Validate all entries have non-empty courseCode and courseTitle
  const errors: string[] = [];
  const validEntries: typeof entries = [];

  for (const entry of entries) {
    const code = entry.courseCode.trim().toUpperCase();
    const title = entry.courseTitle.trim().toUpperCase();

    if (!code) {
      errors.push(`Student ${entry.studentNumber}: course code cannot be empty.`);
      continue;
    }
    if (!title) {
      errors.push(`Student ${entry.studentNumber}: course title cannot be empty.`);
      continue;
    }

    validEntries.push({ ...entry, courseCode: code, courseTitle: title });
  }

  if (validEntries.length === 0) {
    return { success: false, updatedCount: 0, failedCount: entries.length, errors };
  }

  // Check for conflicts: same studentNumber + courseCode + term, different gradeId
  const conflictChecks = await Promise.all(
    validEntries.map(async (entry) => {
      const conflict = await prisma.grade.findFirst({
        where: {
          studentNumber: entry.studentNumber,
          courseCode: entry.courseCode,
          academicYear,
          semester,
          id: { not: entry.gradeId },
        },
        select: { id: true, studentNumber: true },
      });
      return conflict ? { entry, conflictStudentNumber: conflict.studentNumber } : null;
    }),
  );

  for (const conflict of conflictChecks) {
    if (conflict) {
      errors.push(
        `Student ${conflict.entry.studentNumber}: course code "${conflict.entry.courseCode}" already exists in this term.`,
      );
    }
  }

  // Remove conflicting entries
  const conflictingIds = new Set(
    conflictChecks.filter(Boolean).map((c) => c!.entry.gradeId),
  );
  const cleanEntries = validEntries.filter((e) => !conflictingIds.has(e.gradeId));

  if (cleanEntries.length === 0) {
    return { success: false, updatedCount: 0, failedCount: entries.length, errors };
  }

  // Fetch existing records for audit
  const gradeIds = cleanEntries.map((e) => e.gradeId);
  const existingGrades = await prisma.grade.findMany({
    where: { id: { in: gradeIds } },
    select: {
      id: true,
      courseCode: true,
      courseTitle: true,
      creditUnit: true,
      grade: true,
      remarks: true,
      instructor: true,
      studentNumber: true,
    },
  });

  const gradeMap = new Map(existingGrades.map((g) => [g.id, g]));

  const operations: Prisma.PrismaPromise<unknown>[] = [];
  let updatedCount = 0;

  for (const entry of cleanEntries) {
    const existing = gradeMap.get(entry.gradeId);
    if (!existing) {
      errors.push(`Student ${entry.studentNumber}: grade record not found.`);
      continue;
    }

    const oldCode = existing.courseCode;
    const oldTitle = existing.courseTitle;

    if (entry.courseCode === oldCode.toUpperCase() && entry.courseTitle === oldTitle.toUpperCase()) {
      continue; // no change
    }

    operations.push(
      prisma.grade.update({
        where: { id: entry.gradeId },
        data: { courseCode: entry.courseCode, courseTitle: entry.courseTitle },
      }),
    );

    operations.push(
      prisma.gradeLog.create({
        data: {
          studentNumber: existing.studentNumber,
          courseCode: entry.courseCode,
          courseTitle: entry.courseTitle,
          creditUnit: existing.creditUnit,
          grade: existing.grade,
          remarks: existing.remarks ?? undefined,
          instructor: existing.instructor,
          academicYear,
          semester,
          action: "UPDATED",
          isResolved: true,
          changeReason: `Course info edited from "${oldCode}" / "${oldTitle}" to "${entry.courseCode}" / "${entry.courseTitle}" by ${userRole}`,
        },
      }),
    );

    updatedCount++;
  }

  if (operations.length === 0) {
    const totalFailed = entries.length - updatedCount;
    return {
      success: totalFailed === 0,
      updatedCount,
      failedCount: totalFailed,
      errors,
    };
  }

  await prisma.$transaction(operations);

  return {
    success: true,
    updatedCount,
    failedCount: entries.length - updatedCount,
    errors,
  };
}

// ── Edit course code & course title (single) ─────────────────────────────

export type UpdateGradeCourseInfoResult = {
  success: boolean;
  message: string;
};

export async function updateGradeCourseInfo(params: {
  gradeId: string;
  courseCode: string;
  courseTitle: string;
  studentNumber: string;
  academicYear: AcademicYear;
  semester: Semester;
}): Promise<UpdateGradeCourseInfoResult> {
  const { gradeId, courseCode, courseTitle, studentNumber, academicYear, semester } = params;

  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const userRole = user.publicMetadata?.role as string | undefined;
  if (
    userRole !== "admin" &&
    userRole !== "superuser" &&
    userRole !== "registrar"
  ) {
    throw new Error("Forbidden: only admin, superuser, and registrar can edit grade course info.");
  }

  const trimmedCode = courseCode.trim().toUpperCase();
  const trimmedTitle = courseTitle.trim().toUpperCase();

  if (!trimmedCode) throw new Error("Course code cannot be empty.");
  if (!trimmedTitle) throw new Error("Course title cannot be empty.");

  // Check for uniqueness conflict with another grade record
  const existingConflict = await prisma.grade.findFirst({
    where: {
      studentNumber,
      courseCode: trimmedCode,
      academicYear,
      semester,
      id: { not: gradeId },
    },
    select: { id: true },
  });

  if (existingConflict) {
    throw new Error(
      `A grade with course code "${trimmedCode}" already exists for this student in this term.`,
    );
  }

  const existing = await prisma.grade.findUnique({
    where: { id: gradeId },
    select: { courseCode: true, courseTitle: true, creditUnit: true, grade: true, remarks: true, instructor: true },
  });

  if (!existing) throw new Error("Grade record not found.");

  const oldCourseCode = existing.courseCode;
  const oldCourseTitle = existing.courseTitle;

  await prisma.$transaction([
    prisma.grade.update({
      where: { id: gradeId },
      data: { courseCode: trimmedCode, courseTitle: trimmedTitle },
    }),
    prisma.gradeLog.create({
      data: {
        studentNumber,
        courseCode: trimmedCode,
        courseTitle: trimmedTitle,
        creditUnit: existing.creditUnit,
        grade: existing.grade,
        remarks: existing.remarks ?? undefined,
        instructor: existing.instructor,
        academicYear,
        semester,
        action: "UPDATED",
        isResolved: true,
        changeReason: `Course info edited from "${oldCourseCode}" / "${oldCourseTitle}" to "${trimmedCode}" / "${trimmedTitle}" by ${userRole}`,
      },
    }),
  ]);

  return {
    success: true,
    message: `Course info updated from "${oldCourseCode}" to "${trimmedCode}".`,
  };
}
