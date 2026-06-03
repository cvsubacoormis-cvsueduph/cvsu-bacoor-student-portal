"use server";

import {
  createStudentSchema,
  CreateStudentSchema,
  updateStudentSchema,
  UpdateStudentSchema,
} from "@/lib/formValidationSchemas";
import prisma from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { Courses, Major, Status, UserSex } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import crypto from "node:crypto";
import { checkRateLimitRedis } from "@/lib/rate-limit-redis";

const clerk = await clerkClient();

export async function getStudents() {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (!role || role === "student") {
    throw new Error("Forbidden: insufficient permissions");
  }
  try {
    const students = await prisma.student.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
    return { students, error: null };
  } catch (error) {
    console.error("Error fetching students:", error);
    return { students: null, error: "An unexpected error occurred" };
  }
}

export async function createStudent(data: CreateStudentSchema) {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;

  if (!userId || role !== "admin") {
    return { student: null, error: "Unauthorized" };
  }

  try {
    const result = createStudentSchema.safeParse(data);

    if (!result.success) {
      return {
        student: null,
        error: "Invalid input",
        errors: result.error.errors,
      };
    }

    const studentData = result.data;

    const clerk = await clerkClient();
    const password = crypto.randomBytes(12).toString("hex");
    const user = await clerk.users.createUser({
      username: `${studentData.studentNumber
        }${studentData.firstName.toLowerCase()}`,
      password,
      emailAddress: studentData.email ? [studentData.email] : undefined,
      firstName: studentData.firstName.toUpperCase(),
      lastName: studentData.lastName.toUpperCase(),
      publicMetadata: { role: "student" },
    });

    const createdStudent = await prisma.student.create({
      data: {
        id: user.id,
        studentNumber: studentData.studentNumber,
        username: `${studentData.studentNumber}${studentData.firstName}`,
        firstName: studentData.firstName.toUpperCase(),
        lastName: studentData.lastName.toUpperCase(),
        middleInit: studentData.middleInit?.charAt(0)?.toUpperCase(),
        email: studentData.email,
        phone: studentData.phone,
        address: studentData.address.toUpperCase(),
        sex: studentData.sex as UserSex,
        course: studentData.course as Courses,
        major: studentData.major as Major,
        status: studentData.status as Status,
        isApproved: true,
        isPasswordSet: true,
        createdAt: new Date(),
      },
    });

    revalidatePath("/students");
    return { student: createdStudent, generatedPassword: password, error: null };
  } catch (error) {
    console.error("Error creating student:", error);
    return { student: null, error: "An unexpected error occurred" };
  }
}

export async function deleteStudent(id: string) {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;

  if (!userId || role !== "admin") {
    return { student: null, error: "Unauthorized" };
  }

  await checkRateLimitRedis({ action: "delete_student", limit: 5, windowSeconds: 60 });

  try {
    if (!id) {
      return { success: false, error: "Student id is required" };
    }

    const clerk = await clerkClient();
    await clerk.users.deleteUser(id);

    await prisma.student.delete({
      where: {
        id,
      },
    });

    revalidatePath("/students");
    return { success: true, error: null };
  } catch (error) {
    console.error("Error deleting student:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function updateStudent(
  data: { id: string } & UpdateStudentSchema
) {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;

  if (!userId || role !== "admin") {
    return { student: null, error: "Unauthorized" };
  }

  try {
    // Validate the ENTIRE data object including id
    const validationResult = updateStudentSchema.safeParse(data);

    if (!validationResult.success) {
      console.error("Validation errors:", validationResult.error.errors);
      return {
        student: null,
        error: "Validation failed",
        errors: validationResult.error.errors,
      };
    }

    const { id, ...studentData } = validationResult.data;

    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        studentNumber: studentData.studentNumber,
        username: studentData.username,
        firstName: studentData.firstName,
        lastName: studentData.lastName,
        middleInit: studentData.middleInit || null,
        email: studentData.email || null,
        phone: studentData.phone || null,
        address: studentData.address,
        sex: studentData.sex,
        course: studentData.course,
        major: studentData.major === "NONE" ? null : studentData.major,
        status: studentData.status,
      },
    });


    await clerk.users.updateUser(id, {
      firstName: studentData.firstName,
      lastName: studentData.lastName,
      username: studentData.username,
    });

    revalidatePath("/students");
    return { student: updatedStudent, error: null };
  } catch (error) {
    console.error("Error updating student:", error);
    return {
      student: null,
      error: "An unexpected error occurred",
      detailedError: process.env.NODE_ENV === "development" ? error : undefined,
    };
  }
}

export async function getStudentById(id: string) {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;

  if (!userId || (role !== "student" && role !== "admin")) {
    return { student: null, error: "Unauthorized" };
  }

  if (role === "student" && id !== userId) {
    return { student: null, error: "Unauthorized: you can only view your own profile" };
  }

  try {
    const student = await prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      return { student: null, error: "Student not found" };
    }

    return { student, error: null };
  } catch (error) {
    console.error("Error fetching student:", error);
    return { student: null, error: "An unexpected error occurred" };
  }
}
