"use server";

import prisma from "@/lib/prisma";
import { auth, clerkClient } from "@clerk/nextjs/server";
import crypto from "crypto";

export type GradeRecord = {
  courseCode: string;
  courseTitle: string;
  creditUnit: number;
  grade: string;
  reExam: string | null;
  remarks: string;
  instructor: string;
};

export type CogVerificationInput = {
  studentNumber: string;
  firstName: string;
  lastName: string;
  middleInit?: string;
  course: string;
  major: string;
  grades: GradeRecord[];
  academicYear: string;
  semester: string;
  yearLevel: string;
  gpa: string;
  totalSubjects: number;
  totalCredits: number;
  totalCreditsEarned: number;
  purpose: string;
};

/**
 * Stores a COG verification record and returns the integrity hash.
 * The hash is used in the QR code URL: /verify/[hash]
 * Only the authenticated student (for their own) or admin/registrar can create records.
 */
export async function storeCogVerification(input: CogVerificationInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const role = user.publicMetadata?.role as string | undefined;

  if (
    !role ||
    !["admin", "registrar", "registrar_staff", "superuser", "student"].includes(role)
  ) {
    throw new Error(
      "Forbidden: You do not have permission to generate COG verifications",
    );
  }

  // If student, verify they're generating for themselves
  if (role === "student") {
    const student = await prisma.student.findUnique({
      where: { id: userId },
    });
    if (!student || student.studentNumber !== input.studentNumber) {
      throw new Error("Forbidden: You can only generate COGs for yourself");
    }
  }

  // Generate a deterministic hash from the grade data
  const normalizedGrades = input.grades.map((g) => ({
    c: g.courseCode,
    g: g.grade,
    r: g.reExam,
    u: g.creditUnit,
    rm: g.remarks,
  }));
  const data = JSON.stringify(normalizedGrades);
  const hash = crypto.createHash("sha256").update(data).digest("hex").toUpperCase();

  const studentName = `${input.lastName}, ${input.firstName}${
    input.middleInit ? " " + input.middleInit : ""
  }`;

  // Upsert: if same grades are generated again, update the timestamp
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

  await prisma.cogVerification.upsert({
    where: { hash },
    update: {
      generatedAt: now,
      generatedBy: userId,
      purpose: input.purpose,
      expiresAt,
      isRevoked: false, // Re-issuing un-revokes if previously revoked
    },
    create: {
      hash,
      studentNumber: input.studentNumber,
      studentName,
      course: input.course,
      major: input.major || "NONE",
      academicYear: input.academicYear || "",
      semester: input.semester || "",
      yearLevel: input.yearLevel || "",
      gpa: input.gpa,
      totalSubjects: input.totalSubjects,
      totalCredits: input.totalCredits,
      totalCreditsEarned: input.totalCreditsEarned,
      grades: JSON.stringify(input.grades),
      purpose: input.purpose || "",
      generatedBy: userId,
      expiresAt,
    },
  });

  return { hash };
}

/**
 * Revokes a COG verification so it shows as invalid.
 * Only admin, registrar, faculty, or superuser can revoke.
 */
export async function revokeCogVerification(hash: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const role = user.publicMetadata?.role as string | undefined;

  if (!role || !["admin", "registrar", "registrar_staff", "faculty", "superuser"].includes(role)) {
    throw new Error("Forbidden: You do not have permission to revoke verifications");
  }

  await prisma.cogVerification.update({
    where: { hash },
    data: { isRevoked: true },
  });

  return { success: true };
}
