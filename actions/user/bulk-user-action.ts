"use server";

import prisma from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { UserSex, Role } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { bulkUserSchema } from "@/schemas/user-schema";
import crypto from "node:crypto";
import { checkRateLimitRedis } from "@/lib/rate-limit-redis";

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
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin" && role !== "superuser") {
    throw new Error("Forbidden: insufficient permissions.");
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

  await checkRateLimitRedis({
    action: "bulk_create_users",
    limit: 3,
    windowSeconds: 300,
  });

  const clerk = await clerkClient();
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as string[],
    createdUsers: [] as { username: string; generatedPassword: string }[],
  };

  // Unique batch prefix so placeholder emails never collide across uploads
  const batchId = Date.now().toString(36);

  for (const [index, formData] of validUsers.entries()) {
    try {
      const password = crypto.randomBytes(8).toString("hex").slice(0, 8);

      // Clerk requires an email identifier. When the user hasn't provided one,
      // use a placeholder so they can fill in their real email later.
      const clerkEmail =
        formData.email || `placeholder_${batchId}_${index + 1}@gmail.com`;

      // Create user in Clerk
      const clerkUser = await clerk.users.createUser({
        username: formData.username,
        firstName: formData.firstName,
        lastName: formData.lastName,
        emailAddress: [clerkEmail],
        password,
      });

      // Create user in DB — store real email (null when not provided) so users
      // see an empty field and can fill it in themselves later
      await prisma.user.create({
        data: {
          id: clerkUser.id,
          username: formData.username,
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleInit: formData.middleInit,
          email: formData.email || null,
          phone: formData.phone || null,
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
      results.createdUsers.push({
        username: formData.username,
        generatedPassword: password,
      });
    } catch (error: any) {
      results.failed++;
      console.error(`Failed to create user ${formData.username}:`, error);

      let errorMessage = error.message || "Failed to create user";
      if (error.errors && error.errors.length > 0) {
        errorMessage = error.errors[0].message;
      }

      results.errors.push(
        `Row ${index + 1} (${formData.username}): ${errorMessage}`,
      );
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
