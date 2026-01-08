"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";

const clerk = await clerkClient();

export async function approveStudent(studentId: string) {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string }) || undefined;

  if (!userId || role?.role !== "admin") {
    throw new Error("Unauthorized");
  }

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

  await prisma.student.delete({
    where: { id: studentId },
  });

  clerk.users.deleteUser(studentId);
}
