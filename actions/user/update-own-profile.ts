"use server";

import prisma from "@/lib/prisma";
import { clerkClient, auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { updateOwnProfileSchema } from "@/schemas/user-schema";

const ALLOWED_ROLES = ["faculty", "registrar"] as const;

export async function updateOwnProfile(formData: {
  email?: string;
  phone?: string;
  address: string;
  middleInit?: string;
}) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const caller = await currentUser();
  const callerRole = caller?.publicMetadata?.role as string | undefined;
  if (!callerRole || !ALLOWED_ROLES.includes(callerRole as (typeof ALLOWED_ROLES)[number])) {
    return {
      success: false,
      error: "Only faculty and registrar users can edit their own profile.",
    };
  }

  const parsed = updateOwnProfileSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    };
  }

  const validData = parsed.data;

  try {
    // Update Prisma
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: validData.email || null,
        phone: validData.phone || null,
        address: validData.address,
        middleInit: validData.middleInit || null,
      },
    });

    // Sync email with Clerk — create or update the email address
    if (validData.email) {
      try {
        const clerk = await clerkClient();
        const clerkUser = await clerk.users.getUser(userId);
        const existingEmails = clerkUser.emailAddresses;
        const primaryEmail = existingEmails.find(
          (e) => e.id === clerkUser.primaryEmailAddressId
        );

        if (existingEmails.length === 0) {
          // No emails yet — create as primary, skip verification (admin-trusted context)
          await clerk.emailAddresses.createEmailAddress({
            userId,
            emailAddress: validData.email,
            primary: true,
            verified: true,
          });
        } else if (!primaryEmail || primaryEmail.emailAddress !== validData.email) {
          // Email differs from primary — add new verified email and promote it
          const newEmail = await clerk.emailAddresses.createEmailAddress({
            userId,
            emailAddress: validData.email,
            verified: true,
          });
          await clerk.users.updateUser(userId, {
            primaryEmailAddressID: newEmail.id,
          });
        }
      } catch (clerkError) {
        // Non-fatal: Prisma already succeeded. Log for debugging.
        console.warn("Failed to sync email with Clerk:", clerkError);
      }
    }

    revalidatePath("/list/adminprofile");
    revalidatePath("/list/adminprofile/edit");

    return { success: true };
  } catch (error: any) {
    console.error("Failed to update own profile:", error);
    return { success: false, error: error.message || "Failed to update profile." };
  }
}
