// actions/admin/admin.ts
"use server";

import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { Role, UserSex } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { AdminEntry, AdminListEntry, UserEntry } from "@/lib/types";
import { createAdminSchema } from "@/lib/formValidationSchemas";
import { z } from "zod";

const ALLOWED_ROLES = ["admin", "superuser", "faculty", "registrar"] as const;

export async function getAdminsAndUsers(): Promise<AdminListEntry[]> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized: must be signed in.");
  }
  const clerkUser = await currentUser();
  const callerRole = clerkUser?.publicMetadata?.role as string | undefined;

  if (!callerRole || !ALLOWED_ROLES.includes(callerRole as (typeof ALLOWED_ROLES)[number])) {
    throw new Error("Forbidden: insufficient permissions.");
  }

  const [admins, users] = await Promise.all([
    prisma.admin.findMany({
      orderBy: { lastName: "asc" },
    }),
    prisma.user.findMany({
      where: {
        role: {
          notIn: [Role.student],
        },
      },
      orderBy: { lastName: "asc" },
    }),
  ]);

  const adminEntries: AdminEntry[] = admins.map((a) => ({
    source: "admin",
    id: a.id,
    firstName: a.firstName,
    middleInit: a.middleInit,
    lastName: a.lastName,
    address: a.address,
    phone: a.phone,
    email: a.email,
    birthday: a.birthday,
    sex: a.sex,
    username: a.username,
    role: a.role,
  }));

  const userEntries: UserEntry[] = users.map((u) => ({
    source: "user",
    id: u.id,
    firstName: u.firstName,
    middleInit: u.middleInit,
    lastName: u.lastName,
    address: u.address,
    phone: u.phone ?? null,
    email: u.email ?? null,
    birthday: null,
    sex: u.sex,
    username: u.username,
    role: u.role,
  }));

  return [...adminEntries, ...userEntries];
}

// ─── Unified Delete ───────────────────────────────────────────────────────────

type DeleteResult = { success: boolean; error?: string };

/**
 * Deletes either an Admin or a User (faculty/registrar/etc.) from Clerk + DB.
 * - Caller must be authenticated and have role admin or superuser.
 * - Caller cannot delete their own account.
 * - `source` tells us which Prisma table to target.
 */
export async function deleteAdminOrUser(
  id: string,
  source: AdminListEntry["source"]
): Promise<DeleteResult> {
  // 1. Auth
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };

  // 2. Role check
  const caller = await currentUser();
  const callerRole = caller?.publicMetadata?.role as string | undefined;
  const ALLOWED = ["admin", "superuser"] as const;
  if (!callerRole || !ALLOWED.includes(callerRole as (typeof ALLOWED)[number])) {
    return { success: false, error: "Forbidden: insufficient permissions." };
  }

  // 3. Self-deletion guard — never allow deleting the currently signed-in account
  if (id === userId) {
    return { success: false, error: "You cannot delete your own account." };
  }

  try {
    const clerk = await clerkClient();
    // Delete from Clerk first (will throw if user doesn't exist)
    await clerk.users.deleteUser(id);

    // Delete from the correct Prisma table
    if (source === "admin") {
      await prisma.admin.delete({ where: { id } });
    } else {
      await prisma.user.delete({ where: { id } });
    }

    revalidatePath("/list/admin-lists");
    return { success: true };
  } catch (error: any) {
    console.error("[deleteAdminOrUser] error:", error);
    return { success: false, error: error.message ?? "Deletion failed. Please try again." };
  }
}

export async function getUserProfile() {
  const { userId } = await auth();

  if (!userId) {
    console.error("User ID is undefined");
    throw new Error("Unauthorized");
  }

  const admin = await prisma.admin.findUnique({
    where: { id: userId },
  });

  if (admin) {
    return {
      ...admin,
      role: Role.admin,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (user && (user.role === Role.faculty || user.role === Role.registrar)) {
    return {
      ...user,
      role: user.role,
    };
  }

  const student = await prisma.student.findUnique({
    where: { id: userId },
  });

  if (student) {
    return {
      ...student,
      role: Role.student,
    };
  }

  throw new Error("User not found in Admin, User, or Student tables");
}

export async function updateAdmin(
  id: string,
  data: {
    firstName: string;
    middleInit: string;
    lastName: string;
    username: string;
    email: string;
    address: string;
    phone: string;
    birthday: string;
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

    await prisma.admin.update({
      where: { id },
      data,
    });

    revalidatePath("/list/admin-lists");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update admin:", error);
    return { success: false, error: error.message ?? "Failed to update admin." };
  }
}

export async function createAdmin(
  data: z.infer<typeof createAdminSchema>
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };

  const result = createAdminSchema.safeParse(data);
  if (!result.success) {
    return { success: false, error: "Invalid input" };
  }

  const adminData = result.data;

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.createUser({
      username: adminData.username,
      password: adminData.password,
      firstName: adminData.firstName,
      emailAddress: [adminData.email],
      lastName: adminData.lastName,
      publicMetadata: { role: "admin" },
    });

    await prisma.admin.create({
      data: {
        id: user.id,
        firstName: adminData.firstName,
        middleInit: adminData.middleInit,
        lastName: adminData.lastName,
        username: adminData.username,
        email: adminData.email,
        address: adminData.address,
        phone: adminData.phone,
        birthday: adminData.birthday,
        sex: adminData.sex as UserSex,
      },
    });

    revalidatePath("/list/admin-lists");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating admin:", error);
    return { success: false, error: error.message ?? "An unexpected error occurred" };
  }
}


