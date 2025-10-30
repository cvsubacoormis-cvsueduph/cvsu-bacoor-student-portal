"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  createStudentSchema,
  CreateStudentSchema,
} from "@/lib/formValidationSchemas";
import { clerkClient } from "@clerk/nextjs/server";

const clerk = await clerkClient();

export async function registerStudent(formData: CreateStudentSchema) {
  const parsed = createStudentSchema.safeParse(formData);

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors
        ? Object.values(parsed.error.flatten().fieldErrors).flat()
        : ["Invalid student data"],
    };
  }

  const data = parsed.data;

  const errors: string[] = [];

  const existingStudentNumber = await prisma.student.findUnique({
    where: { studentNumber: data.studentNumber },
  });

  if (existingStudentNumber) {
    errors.push("Student number already exists");
  }

  const existingUsername = await prisma.student.findUnique({
    where: { username: data.username },
  });

  if (existingUsername) {
    errors.push("Username already exists");
  }

  const existingEmail = await prisma.student.findFirst({
    where: { email: data.email },
  });

  if (existingEmail) {
    errors.push("Email already exists");
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  try {
    const user = await clerk.users.createUser({
      username: data.username,
      password: data.password,
      firstName: data.firstName.toUpperCase(),
      emailAddress: data.email ? [data.email] : [],
      lastName: data.lastName.toUpperCase(),
      publicMetadata: { role: "student", isApproved: false },
    });

    const student = await prisma.student.create({
      data: {
        id: user.id,
        studentNumber: data.studentNumber,
        username: data.username,
        firstName: data.firstName.toUpperCase(),
        lastName: data.lastName.toUpperCase(),
        middleInit: data.middleInit?.toUpperCase().charAt(0) || null,
        email: data.email,
        phone: data.phone,
        address: data.address,
        sex: data.sex,
        course: data.course,
        major: data.major,
        status: data.status,
        isPasswordSet: true,
        isApproved: false,
        createdAt: new Date(),
      },
    });

    revalidatePath("/");
    return { success: true, student };
  } catch (error: any) {
    // Clerk returns an array of errors under `errors`
    if (error?.errors && Array.isArray(error.errors)) {
      const clerkErrors = error.errors.map(
        (e: any) => e.longMessage || e.message
      );
      return { success: false, errors: clerkErrors };
    }

    console.error("Unexpected error in registerStudent:", error);
    return { success: false, errors: ["An unexpected error occurred."] };
  }
}
