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

export async function getStudents() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
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
    const user = await clerk.users.createUser({
      username: `${
        studentData.studentNumber
      }${studentData.firstName.toLowerCase()}`,
      password: `cvsubacoor${studentData.firstName.toLowerCase()}${
        studentData.studentNumber
      }`,
      emailAddress: [studentData.email] as string[] | undefined,
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
    return { student: createdStudent, error: null };
  } catch (error) {
    console.error("Error creating student:", error);
    return { student: null, error: "An unexpected error occurred" };
  }
}

export async function deleteStudent(id: string) {
  try {
    if (!id) {
      return { success: false, error: "Student id is required" };
    }

    const clerk = await clerkClient();
    await clerk.users.deleteUser(id);

    const deleteStudent = await prisma.student.delete({
      where: {
        id,
      },
    });

    if (!deleteStudent) {
      return { success: false, error: "Student not found" };
    }

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
  try {
    console.log("Incoming data:", data);

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

    console.log("Updating student with:", { id, studentData });

    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        studentNumber: studentData.studentNumber,
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
