"use server";

import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";

// ─── Validation Schemas ─────────────────────────────────────────────────

const creditedSubjectSchema = z.object({
  studentNumber: z.string().min(1, "Student number is required"),
  courseCode: z.string().min(1, "Course code is required"),
  courseTitle: z.string().min(1, "Course title is required"),
  creditUnits: z.number().int().min(0, "Credit units must be non-negative"),
  schoolName: z.string().optional(),
  notes: z.string().optional(),
});

const bulkCreditedSubjectsSchema = z.object({
  studentNumber: z.string().min(1),
  subjects: z.array(
    z.object({
      courseCode: z.string().min(1),
      courseTitle: z.string().min(1),
      creditUnits: z.number().int().min(0),
      schoolName: z.string().optional(),
      notes: z.string().optional(),
    }),
  ),
});

const removeCreditedSubjectSchema = z.object({
  id: z.string().min(1),
});

export type CreditedSubjectInput = z.infer<typeof creditedSubjectSchema>;
export type RemoveCreditedSubjectInput = z.infer<
  typeof removeCreditedSubjectSchema
>;

// ─── Auth Guard ─────────────────────────────────────────────────────────

async function requireAuthorizedRole(): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await currentUser();
  const role = (user?.publicMetadata?.role as string) || "";

  const allowedRoles = [
    "admin",
    "superuser",
    "registrar",
    "registrar_staff",
  ];
  if (!allowedRoles.includes(role)) {
    throw new Error(
      "Forbidden: Only admin, registrar, and registrar staff can manage credited subjects.",
    );
  }
}

// ─── Server Actions ─────────────────────────────────────────────────────

/**
 * Get all credited subjects for a student.
 * Also accessible by the student themselves (to view their own credited subjects).
 */
export async function getCreditedSubjects(studentNumber: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await currentUser();
  const role = (user?.publicMetadata?.role as string) || "";

  // Students can only view their own credited subjects
  if (role === "student") {
    const student = await prisma.student.findUnique({
      where: { id: userId },
      select: { studentNumber: true },
    });
    if (!student || student.studentNumber !== studentNumber) {
      throw new Error("Forbidden: You can only view your own credited subjects.");
    }
  } else {
    await requireAuthorizedRole();
  }

  const credited = await prisma.creditedSubject.findMany({
    where: { studentNumber },
    orderBy: { courseCode: "asc" },
  });

  return credited;
}

/**
 * Get the set of credited course codes for a student.
 * Returns a Set-like structure for efficient checklist merging.
 */
export async function getCreditedSubjectCodes(
  studentNumber: string,
): Promise<Map<string, { courseTitle: string; creditUnits: number }>> {
  const credited = await prisma.creditedSubject.findMany({
    where: { studentNumber },
    select: { courseCode: true, courseTitle: true, creditUnits: true },
  });

  const map = new Map<string, { courseTitle: string; creditUnits: number }>();
  for (const c of credited) {
    map.set(c.courseCode, {
      courseTitle: c.courseTitle,
      creditUnits: c.creditUnits,
    });
  }
  return map;
}

/**
 * Add a single credited subject for a student.
 */
export async function addCreditedSubject(
  input: CreditedSubjectInput,
): Promise<{ success: boolean; message: string; data?: unknown }> {
  await requireAuthorizedRole();

  const parsed = creditedSubjectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed: " + parsed.error.errors.map((e) => e.message).join(", "),
    };
  }

  const { studentNumber, courseCode, courseTitle, creditUnits, schoolName, notes } =
    parsed.data;

  // Verify student exists
  const student = await prisma.student.findUnique({
    where: { studentNumber },
  });
  if (!student) {
    return { success: false, message: "Student not found." };
  }

  // Check for duplicate
  const existing = await prisma.creditedSubject.findUnique({
    where: {
      studentNumber_courseCode: {
        studentNumber,
        courseCode: courseCode.toUpperCase(),
      },
    },
  });
  if (existing) {
    return {
      success: false,
      message: `Subject ${courseCode} is already credited for this student.`,
    };
  }

  const result = await prisma.creditedSubject.create({
    data: {
      studentNumber,
      courseCode: courseCode.toUpperCase(),
      courseTitle: courseTitle.toUpperCase(),
      creditUnits,
      schoolName: schoolName || null,
      notes: notes || null,
    },
  });

  return {
    success: true,
    message: `Credited subject "${courseCode}" added successfully.`,
    data: result,
  };
}

/**
 * Add multiple credited subjects at once (bulk operation).
 */
export async function bulkAddCreditedSubjects(
  input: z.infer<typeof bulkCreditedSubjectsSchema>,
): Promise<{ success: boolean; message: string; created: number }> {
  await requireAuthorizedRole();

  const parsed = bulkCreditedSubjectsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed: " + parsed.error.errors.map((e) => e.message).join(", "),
      created: 0,
    };
  }

  const { studentNumber, subjects } = parsed.data;

  // Verify student exists
  const student = await prisma.student.findUnique({
    where: { studentNumber },
  });
  if (!student) {
    return { success: false, message: "Student not found.", created: 0 };
  }

  // Get existing credited subject codes to skip duplicates
  const existingCodes = new Set(
    (
      await prisma.creditedSubject.findMany({
        where: { studentNumber },
        select: { courseCode: true },
      })
    ).map((c) => c.courseCode),
  );

  const toCreate = subjects.filter(
    (s) => !existingCodes.has(s.courseCode.toUpperCase()),
  );

  if (toCreate.length === 0) {
    return {
      success: true,
      message: "All subjects are already credited (no new entries).",
      created: 0,
    };
  }

  await prisma.creditedSubject.createMany({
    data: toCreate.map((s) => ({
      studentNumber,
      courseCode: s.courseCode.toUpperCase(),
      courseTitle: s.courseTitle.toUpperCase(),
      creditUnits: s.creditUnits,
      schoolName: s.schoolName || null,
      notes: s.notes || null,
    })),
  });

  return {
    success: true,
    message: `Successfully credited ${toCreate.length} subject(s).`,
    created: toCreate.length,
  };
}

/**
 * Remove a credited subject by ID.
 */
export async function removeCreditedSubject(
  input: RemoveCreditedSubjectInput,
): Promise<{ success: boolean; message: string }> {
  await requireAuthorizedRole();

  const parsed = removeCreditedSubjectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed: " + parsed.error.errors.map((e) => e.message).join(", "),
    };
  }

  const existing = await prisma.creditedSubject.findUnique({
    where: { id: parsed.data.id },
  });

  if (!existing) {
    return { success: false, message: "Credited subject record not found." };
  }

  await prisma.creditedSubject.delete({
    where: { id: parsed.data.id },
  });

  return {
    success: true,
    message: `Credited subject "${existing.courseCode}" removed successfully.`,
  };
}

/**
 * Remove all credited subjects for a student (useful when changing status away from TRANSFEREE).
 */
export async function clearCreditedSubjects(
  studentNumber: string,
): Promise<{ success: boolean; message: string }> {
  await requireAuthorizedRole();

  const count = await prisma.creditedSubject.count({
    where: { studentNumber },
  });

  if (count === 0) {
    return { success: true, message: "No credited subjects to clear." };
  }

  await prisma.creditedSubject.deleteMany({
    where: { studentNumber },
  });

  return {
    success: true,
    message: `Successfully removed ${count} credited subject(s).`,
  };
}
