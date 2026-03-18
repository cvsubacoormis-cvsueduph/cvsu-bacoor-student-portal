"use server";

import prisma from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { UserSex, Role } from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createUserSchema } from "@/schemas/user-schema";

const ALLOWED_ROLES = ["admin", "superuser"] as const;

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

export async function updateUser(
  id: string,
  data: {
    firstName: string;
    middleInit?: string;
    lastName: string;
    username: string;
    email?: string;
    phone?: string;
    address: string;
    sex: UserSex;
  }
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };

  const caller = await currentUser();
  const callerRole = caller?.publicMetadata?.role as string | undefined;
  if (!callerRole || !ALLOWED_ROLES.includes(callerRole as (typeof ALLOWED_ROLES)[number])) {
    return { success: false, error: "Forbidden: insufficient permissions." };
  }

  try {
    const clerk = await clerkClient();
    await clerk.users.updateUser(id, {
      firstName: data.firstName,
      lastName: data.lastName,
    });

    await prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        middleInit: data.middleInit || null,
        lastName: data.lastName,
        username: data.username,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address,
        sex: data.sex,
      },
    });

    revalidatePath("/list/admin-lists");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update user:", error);
    return { success: false, error: error.message ?? "Failed to update user." };
  }
}
