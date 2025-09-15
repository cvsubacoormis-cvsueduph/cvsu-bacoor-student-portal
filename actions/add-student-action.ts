"use server";

import { CreateStudentSchema } from "@/lib/formValidationSchemas";
import prisma from "@/lib/prisma";
import { Courses, Major, Status, UserSex } from "@prisma/client";
import { mutate } from "swr";
import { auth } from "@clerk/nextjs/server";

export async function createStudentAction(data: CreateStudentSchema) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  try {
    const student = await prisma.student.create({
      data: {
        studentNumber: data.studentNumber,
        username: `${data.studentNumber}${data.firstName}`,
        status: data.status as Status,
        course: data.course as Courses,
        major: (data?.major as Major) ?? "",
        firstName: data.firstName,
        lastName: data.lastName,
        middleInit: data?.middleInit,
        email: data?.email,
        // birthday: new Date(data.birthday),
        phone: String(data.phone),
        address: data.address,
        sex: data.sex as UserSex,
      },
    });

    mutate("/api/students");
    return student;
  } catch (error) {
    console.error("Error adding student:", error);
    throw new Error("An unexpected error occurred while adding the student.");
  }
}

export async function createBulkStudentsAction(
  students: CreateStudentSchema[]
) {
  try {
    for (const student of students) {
      await createStudentAction(student);
    }
    mutate("/api/students");
  } catch (error) {
    console.log(error);
  }
}
