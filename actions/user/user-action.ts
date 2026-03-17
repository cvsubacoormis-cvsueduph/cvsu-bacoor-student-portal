"use server";

import prisma from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { UserSex, Role } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { createUserSchema } from "@/schemas/user-schema";

export async function createUser(formData: {
  username: string;
  firstName: string;
  lastName: string;
  middleInit?: string;
  email?: string;
  phone?: string;
  address: string;
  sex: UserSex;
  role: Role;
}) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const parsed = createUserSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      error: "Invalid input data",
      details: parsed.error.flatten().fieldErrors,
    };
  }

  const validData = parsed.data;

  const clerk = await clerkClient();
  try {
    const cleanedFirstName = validData.firstName
      .toLowerCase()
      .replace(/\s+/g, "");

    const password =
      validData.role === "faculty"
        ? `cvsubacoorfaculty${cleanedFirstName}`
        : `cvsubacoorregistrar${cleanedFirstName}`;

    const clerkUser = await clerk.users.createUser({
      username: validData.username,
      firstName: validData.firstName,
      lastName: validData.lastName,
      emailAddress: validData.email ? [validData.email] : undefined,
      password: password,
    });

    const user = await prisma.user.create({
      data: {
        id: clerkUser.id,
        username: validData.username,
        firstName: validData.firstName,
        lastName: validData.lastName,
        middleInit: validData.middleInit,
        email: validData.email,
        phone: validData.phone,
        address: validData.address,
        sex: validData.sex,
        role: validData.role,
        isApproved: true,
      },
    });

    await clerk.users.updateUserMetadata(clerkUser.id, {
      publicMetadata: {
        role: validData.role,
        isApproved: true,
      },
    });

    revalidatePath("/users");

    return {
      success: true,
      user,
      generatedPassword: password,
    };
  } catch (error: any) {
    console.error("Failed to create user:", error);

    if (error.errors) {
      const clerkError = error.errors[0];
      return {
        error: clerkError.message || "Failed to create user in Clerk",
      };
    }

    return {
      error: error.message || "Failed to create user. Please try again.",
    };
  }
}
