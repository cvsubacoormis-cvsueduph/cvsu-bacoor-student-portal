// lib/checkStudentApproval.ts
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function checkStudentApproval() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return { isLoggedIn: false, isApproved: false, role: null };
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role ?? null;

  if (role !== "student") {
    return { isLoggedIn: true, isApproved: true, role }; // skip approval for non-students
  }

  try {
    const student = await prisma.student.findUnique({
      where: { id: userId },
      select: { isApproved: true },
    });

    return {
      isLoggedIn: true,
      isApproved: student?.isApproved ?? false,
      role,
    };
  } catch (error) {
    console.error("Error checking student approval:", error);
    return { isLoggedIn: true, isApproved: false, role };
  }
}
