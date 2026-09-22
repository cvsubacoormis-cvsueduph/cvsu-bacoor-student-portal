"use server";

import prisma from "@/lib/prisma";
import { redis, withRedisFallback } from "@/lib/redis";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { z } from "zod";

// ─── Validation Schemas ─────────────────────────────────────────────────

const creditedSubjectSchema = z.object({
  studentNumber: z.string().min(1, "Student number is required"),
  courseCode: z.string().min(1, "Course code is required"),
  courseTitle: z.string().min(1, "Course title is required"),
  creditUnits: z.number().int().min(0, "Credit units must be non-negative"),
  schoolName: z.string().optional(),
  notes: z.string().optional(),
  // Details of the subject as taken at the previous school. Free text, because
  // other institutions use grade scales that are not necessarily 1.00–5.00
  // (e.g. "A", "B+", "90"), so a numeric scale must not be enforced here.
  grade: z.string().max(50, "Grade is too long").optional(),
  remarks: z.string().max(200, "Remarks are too long").optional(),
  instructor: z.string().max(200, "Instructor name is too long").optional(),
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
      grade: z.string().max(50, "Grade is too long").optional(),
      remarks: z.string().max(200, "Remarks are too long").optional(),
      instructor: z.string().max(200, "Instructor name is too long").optional(),
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

/**
 * Normalises an optional free-text field for storage.
 *
 * Whitespace-only input means "not provided" and is stored as NULL rather than
 * an empty string, so the UI can distinguish empty from filled with a simple
 * truthiness check.
 */
function cleanText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function requireAuthorizedRole(): Promise<void> {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const role = (sessionClaims?.metadata as { role?: string })?.role || "";

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
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const role = (sessionClaims?.metadata as { role?: string })?.role || "";

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
 * Redis key for a student's credited-course map.
 *
 * Single source of truth: the reader and the invalidators both go through this,
 * so a rename cannot silently leave mutations writing to a stale cache.
 */
function creditedCodesCacheKey(studentNumber: string): string {
  return `cache:creditedCodes:${studentNumber}:v1`;
}

/**
 * Drops the cached credited-course map for a student.
 *
 * {@link getCreditedSubjectCodes} caches for 600s, so without this the
 * curriculum checklist can keep showing a subject as "Not Taken" for up to ten
 * minutes after it was credited (or the reverse, after a removal).
 */
async function invalidateCreditedCodesCache(
  studentNumber: string,
): Promise<void> {
  await withRedisFallback(async () => {
    await redis.del(creditedCodesCacheKey(studentNumber));
  });
}

/**
 * Get the map of credited course codes for a student — keyed by courseCode.
 * Returns a plain Record (JSON-safe) so it can be serialized across server-action boundaries.
 */
export async function getCreditedSubjectCodes(
  studentNumber: string,
): Promise<Record<string, { courseTitle: string; creditUnits: number }>> {
  // ── Redis cache (TTL 600s — credits don't change often) ──────────────────
  const cacheKey = creditedCodesCacheKey(studentNumber);

  const cached = await withRedisFallback(async () => {
    const raw = await redis.get(cacheKey);
    return raw
      ? (JSON.parse(
          raw,
        ) as Record<string, { courseTitle: string; creditUnits: number }>)
      : null;
  });

  if (cached) {
    return cached;
  }
  // ──────────────────────────────────────────────────────────────────────────

  const credited = await prisma.creditedSubject.findMany({
    where: { studentNumber },
    select: { courseCode: true, courseTitle: true, creditUnits: true },
  });

  const map: Record<string, { courseTitle: string; creditUnits: number }> = {};
  for (const c of credited) {
    map[c.courseCode] = {
      courseTitle: c.courseTitle,
      creditUnits: c.creditUnits,
    };
  }

  // Populate cache (fire-and-forget; Redis failure won't block)
  await withRedisFallback(async () => {
    await redis.set(cacheKey, JSON.stringify(map), "EX", 600);
  });

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

  const {
    studentNumber,
    courseCode,
    courseTitle,
    creditUnits,
    schoolName,
    notes,
    grade,
    remarks,
    instructor,
  } = parsed.data;

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
      schoolName: cleanText(schoolName),
      notes: cleanText(notes),
      grade: cleanText(grade),
      remarks: cleanText(remarks),
      instructor: cleanText(instructor),
    },
  });

  await invalidateCreditedCodesCache(studentNumber);

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
      schoolName: cleanText(s.schoolName),
      notes: cleanText(s.notes),
      grade: cleanText(s.grade),
      remarks: cleanText(s.remarks),
      instructor: cleanText(s.instructor),
    })),
  });

  await invalidateCreditedCodesCache(studentNumber);

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

  await invalidateCreditedCodesCache(existing.studentNumber);

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

  await invalidateCreditedCodesCache(studentNumber);

  return {
    success: true,
    message: `Successfully removed ${count} credited subject(s).`,
  };
}
