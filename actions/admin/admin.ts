"use server";

import { auth } from "@clerk/nextjs/server";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

export async function getUserProfile() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  // First check if the user is an Admin
  const admin = await prisma.admin.findUnique({
    where: { id: userId },
  });

  if (admin) {
    return {
      ...admin,
      role: Role.admin,
      birthday: admin.birthday, // already a String in your schema
    };
  }

  // Then check if they are Faculty or Registrar in User table
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (user && (user.role === Role.faculty || user.role === Role.registrar)) {
    return {
      ...user,
      role: user.role,
    };
  }

  // Then check if they are a Student
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
