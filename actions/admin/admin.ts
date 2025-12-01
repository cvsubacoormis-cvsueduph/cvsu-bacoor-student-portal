// actions/admin/admin.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function getUserProfile() {
  const { userId } = await auth();

  if (!userId) {
    console.error("User ID is undefined");
    throw new Error("Unauthorized");
  }

  const admin = await prisma.admin.findUnique({
    where: { id: userId },
  });

  if (admin) {
    return {
      ...admin,
      role: Role.admin,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (user && (user.role === Role.faculty || user.role === Role.registrar)) {
    return {
      ...user,
      role: user.role,
    };
  }

  const student = await prisma.student.findUnique({
    where: { id: userId },
  });

  if (student) {
    return {
      ...student,
      role: Role.student,
    };
  }

  throw new Error("User not found in Admin, User, or Student tables");
}
