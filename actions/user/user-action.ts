"use server";

import prisma from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { UserSex, Role } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";

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
  const clerk = await clerkClient();
  try {
    const cleanedFirstName = formData.firstName
      .toLowerCase()
      .replace(/\s+/g, "");

    const password =
      formData.role === "faculty"
        ? `cvsubacoorfaculty${cleanedFirstName}`
        : `cvsubacooregistrar${cleanedFirstName}`;

    const clerkUser = await clerk.users.createUser({
      username: formData.username,
      firstName: formData.firstName,
      lastName: formData.lastName,
      emailAddress: formData.email ? [formData.email] : undefined,
      password: password,
    });

    const user = await prisma.user.create({
      data: {
        id: clerkUser.id,
        username: formData.username,
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleInit: formData.middleInit,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        sex: formData.sex,
        role: formData.role,
        isApproved: true,
      },
    });

    await clerk.users.updateUserMetadata(clerkUser.id, {
      publicMetadata: {
        role: formData.role,
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
