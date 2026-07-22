"use server";

import prisma from "@/lib/prisma";
import { AcademicYear, Major, Semester } from "@prisma/client";
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
    studentNumber: string;
    oldCourseCode: string;
    newCourseCode: string;
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
    const code = entry.newCourseCode.trim().toUpperCase();
    const title = entry.courseTitle.trim().toUpperCase();

    if (!code) {
      errors.push(`Student ${entry.studentNumber}: course code cannot be empty.`);
      continue;
    }
    if (!title) {
      errors.push(`Student ${entry.studentNumber}: course title cannot be empty.`);
      continue;
    }

    validEntries.push({ ...entry, newCourseCode: code, courseTitle: title });
  }

  if (validEntries.length === 0) {
    return { success: false, updatedCount: 0, failedCount: entries.length, errors };
  }

  // Check for conflicts: same studentNumber + newCourseCode + term,
  // but exclude the record being edited (matched by oldCourseCode).
  // We skip self-conflict by excluding the old key (studentNumber, oldCourseCode, term).
  const conflictResults: { entry: typeof validEntries[number]; studentNumber: string }[] = [];

  for (const entry of validEntries) {
    // Skip the lookup if old and new codes are the same (not a code change)
    if (entry.newCourseCode === entry.oldCourseCode.toUpperCase()) continue;

    const conflict = await prisma.grade.findFirst({
      where: {
        studentNumber: entry.studentNumber,
        courseCode: entry.newCourseCode,
        academicYear,
        semester,
      },
      select: { studentNumber: true },
    });

    if (conflict) {
      conflictResults.push({ entry, studentNumber: conflict.studentNumber });
    }
  }

  for (const c of conflictResults) {
    errors.push(
      `Student ${c.entry.studentNumber}: course code "${c.entry.newCourseCode}" already exists in this term.`,
    );
  }

  // Remove conflicting entries
  const conflictingKeys = new Set(
    conflictResults.map((c) => `${c.entry.studentNumber}::${c.entry.oldCourseCode}`),
  );
  const cleanEntries = validEntries.filter(
    (e) => !conflictingKeys.has(`${e.studentNumber}::${e.oldCourseCode}`),
  );

  if (cleanEntries.length === 0) {
    return { success: false, updatedCount: 0, failedCount: entries.length, errors };
  }

  let updatedCount = 0;
  const entriesToUpdate: { entry: typeof cleanEntries[number]; id: string }[] = [];

  for (const entry of cleanEntries) {
    const existing = await prisma.grade.findFirst({
      where: {
        studentNumber: entry.studentNumber,
        courseCode: entry.oldCourseCode,
        academicYear,
        semester,
      },
      select: { id: true, courseCode: true, courseTitle: true, creditUnit: true, grade: true, remarks: true, instructor: true },
    });

    if (!existing) {
      errors.push(`Student ${entry.studentNumber}: grade record for "${entry.oldCourseCode}" not found.`);
      continue;
    }

    const oldCode = existing.courseCode;
    const oldTitle = existing.courseTitle;

    if (entry.newCourseCode === oldCode.toUpperCase() && entry.courseTitle === oldTitle.toUpperCase()) {
      continue; // no change
    }

    entriesToUpdate.push({ entry, id: existing.id });

    updatedCount++;
  }

  if (updatedCount === 0) {
    const totalFailed = entries.length - updatedCount;
    return {
      success: totalFailed === 0,
      updatedCount,
      failedCount: totalFailed,
      errors,
    };
  }

  await prisma.$transaction(async (tx) => {
    for (const eu of entriesToUpdate) {
      const { entry } = eu;
      const existing = await tx.grade.findFirst({
        where: {
          studentNumber: entry.studentNumber,
          courseCode: entry.oldCourseCode,
          academicYear,
          semester,
        },
        select: { id: true, courseCode: true, courseTitle: true, creditUnit: true, grade: true, remarks: true, instructor: true, studentNumber: true },
      });

      if (!existing) continue;

      await tx.grade.update({
        where: { id: existing.id },
        data: { courseCode: entry.newCourseCode, courseTitle: entry.courseTitle },
      });

      await tx.gradeLog.updateMany({
        where: {
          studentNumber: existing.studentNumber,
          courseCode: entry.oldCourseCode,
          academicYear,
          semester,
        },
        data: { courseCode: entry.newCourseCode, courseTitle: entry.courseTitle },
      });

      await tx.gradeLog.create({
        data: {
          studentNumber: existing.studentNumber,
          courseCode: entry.newCourseCode,
          courseTitle: entry.courseTitle,
          creditUnit: existing.creditUnit,
          grade: existing.grade,
          remarks: existing.remarks ?? undefined,
          instructor: existing.instructor,
          academicYear,
          semester,
          action: "UPDATED",
          isResolved: true,
          changeReason: `Course info edited from "${existing.courseCode}" / "${existing.courseTitle}" to "${entry.newCourseCode}" / "${entry.courseTitle}" by ${userRole}`,
        },
      });
    }
  });

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
  studentNumber: string;
  oldCourseCode: string;
  newCourseCode: string;
  courseTitle: string;
  academicYear: AcademicYear;
  semester: Semester;
}): Promise<UpdateGradeCourseInfoResult> {
  const { studentNumber, oldCourseCode, newCourseCode, courseTitle, academicYear, semester } = params;

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

  const trimmedCode = newCourseCode.trim().toUpperCase();
  const trimmedTitle = courseTitle.trim().toUpperCase();

  if (!trimmedCode) throw new Error("Course code cannot be empty.");
  if (!trimmedTitle) throw new Error("Course title cannot be empty.");

  const existing = await prisma.grade.findFirst({
    where: {
      studentNumber,
      courseCode: oldCourseCode,
      academicYear,
      semester,
    },
    select: { id: true, courseCode: true, courseTitle: true, creditUnit: true, grade: true, remarks: true, instructor: true },
  });

  if (!existing) throw new Error("Grade record not found.");

  // Check for uniqueness conflict if the code actually changed
  if (trimmedCode !== oldCourseCode.toUpperCase()) {
    const existingConflict = await prisma.grade.findFirst({
      where: {
        studentNumber,
        courseCode: trimmedCode,
        academicYear,
        semester,
      },
      select: { id: true },
    });

    if (existingConflict) {
      throw new Error(
        `A grade with course code "${trimmedCode}" already exists for this student in this term.`,
      );
    }
  }

  const oldCode = existing.courseCode;
  const oldTitle = existing.courseTitle;

  await prisma.$transaction([
    prisma.grade.update({
      where: { id: existing.id },
      data: { courseCode: trimmedCode, courseTitle: trimmedTitle },
    }),
    // Update existing GradeLog entries so the monitoring page shows the new code/title
    prisma.gradeLog.updateMany({
      where: {
        studentNumber,
        courseCode: oldCode,
        academicYear,
        semester,
      },
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
        changeReason: `Course info edited from "${oldCode}" / "${oldTitle}" to "${trimmedCode}" / "${trimmedTitle}" by ${userRole}`,
      },
    }),
  ]);

  return {
    success: true,
    message: `Course info updated from "${oldCode}" to "${trimmedCode}".`,
  };
}
