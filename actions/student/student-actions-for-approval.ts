"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { checkRateLimitRedis } from "@/lib/rate-limit-redis";

const clerk = await clerkClient();

export async function approveStudent(studentId: string) {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string }) || undefined;

  if (!userId || role?.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await checkRateLimitRedis({ action: "approve_student", limit: 20, windowSeconds: 60 });

  await prisma.student.update({
    where: { id: studentId },
    data: { isApproved: true },
  });

  clerk.users.updateUser(studentId, {
    publicMetadata: { role: "student", isApproved: true },
  });
}

export async function rejectStudent(studentId: string) {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string }) || undefined;

  if (!userId || role?.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await checkRateLimitRedis({ action: "reject_student", limit: 20, windowSeconds: 60 });

  await prisma.student.delete({
    where: { id: studentId },
  });

  clerk.users.deleteUser(studentId);
}

export async function bulkApproveStudents(studentIds: string[]) {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string }) || undefined;

  if (!userId || role?.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await checkRateLimitRedis({ action: "bulk_approve_students", limit: 5, windowSeconds: 300 });

  await prisma.student.updateMany({
    where: { id: { in: studentIds } },
    data: { isApproved: true },
  });

  // Update each user in Clerk
  for (const studentId of studentIds) {
    await clerk.users.updateUser(studentId, {
      publicMetadata: { role: "student", isApproved: true },
    });
  }
}

export async function bulkRejectStudents(studentIds: string[]) {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string }) || undefined;

  if (!userId || role?.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await checkRateLimitRedis({ action: "bulk_reject_students", limit: 5, windowSeconds: 300 });

  await prisma.student.deleteMany({
    where: { id: { in: studentIds } },
  });

  // Delete each user from Clerk
  for (const studentId of studentIds) {
    await clerk.users.deleteUser(studentId);
  }
}
