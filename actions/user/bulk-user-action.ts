"use server";

import prisma from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { UserSex, Role } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { bulkUserSchema } from "@/schemas/user-schema";

export interface BulkUserPayload {
  username: string;
  firstName: string;
  lastName: string;
  middleInit?: string;
  email?: string;
  phone?: string;
  address: string;
  sex: UserSex;
  role: Role;
}

export async function bulkCreateUsers(usersData: BulkUserPayload[]) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const parsed = bulkUserSchema.safeParse(usersData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed for one or more users",
      details: parsed.error.flatten().fieldErrors,
    };
  }

  const validUsers = parsed.data;

  const clerk = await clerkClient();
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const [index, formData] of validUsers.entries()) {
    try {
      const cleanedFirstName = formData.firstName
        .toLowerCase()
        .replace(/\s+/g, "");

      const password =
        formData.role === "faculty"
          ? `cvsubacoorfaculty${cleanedFirstName}`
          : `cvsubacoorregistrar${cleanedFirstName}`;

      // Create user in Clerk
      const clerkUser = await clerk.users.createUser({
        username: formData.username,
        firstName: formData.firstName,
        lastName: formData.lastName,
        emailAddress: formData.email ? [formData.email] : undefined,
        password: password,
      });

      // Create user in DB
      await prisma.user.create({
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

      // Update Clerk metadata
      await clerk.users.updateUserMetadata(clerkUser.id, {
        publicMetadata: {
          role: formData.role,
          isApproved: true,
        },
      });

      results.successful++;
    } catch (error: any) {
      results.failed++;
      console.error(`Failed to create user ${formData.username}:`, error);
      
      let errorMessage = error.message || "Failed to create user";
      if (error.errors && error.errors.length > 0) {
        errorMessage = error.errors[0].message;
      }
      
      results.errors.push(`Row ${index + 1} (${formData.username}): ${errorMessage}`);
    }
  }

  if (results.successful > 0) {
    revalidatePath("/users");
    revalidatePath("/list/create-user");
  }

  return {
    success: true,
    data: results,
  };
}
