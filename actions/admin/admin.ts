// actions/admin/admin.ts
"use server";

import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { Role, UserSex } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { AdminEntry, AdminListEntry, UserEntry } from "@/lib/types";
import { createAdminSchema } from "@/lib/formValidationSchemas";
import { z } from "zod";

const ALLOWED_ROLES = ["admin", "superuser", "faculty", "registrar", "registrar_staff"] as const;

const BULK_DELETE_ALLOWED_ROLES = [
  "admin",
  "superuser",
  "faculty",
  "registrar",
  "csg",
] as const;

type BulkDeleteRole = (typeof BULK_DELETE_ALLOWED_ROLES)[number];

export interface PaginatedAdminListResult {
  entries: AdminListEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getAdminsAndUsers(params?: {
  search?: string;
  role?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedAdminListResult> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized: must be signed in.");
  }
  const clerkUser = await currentUser();
  const callerRole = clerkUser?.publicMetadata?.role as string | undefined;

  if (!callerRole || !ALLOWED_ROLES.includes(callerRole as (typeof ALLOWED_ROLES)[number])) {
    throw new Error("Forbidden: insufficient permissions.");
  }

  // ── Sanitize and default pagination params ──
  const page = Math.max(1, Math.floor(params?.page ?? 1));
  const limit = Math.min(50, Math.max(1, Math.floor(params?.limit ?? 10)));
  const skip = (page - 1) * limit;
  const roleFilter = params?.role?.trim().toLowerCase();
  const searchTerm = params?.search?.trim();

  // ── Build where clauses ──
  const adminWhere: Record<string, unknown> = {};
  const userWhere: Record<string, unknown> = {
    role: { notIn: [Role.student] },
  };

  if (roleFilter) {
    adminWhere.role = roleFilter;
    userWhere.role = roleFilter;
  }

  if (searchTerm) {
    // Search across firstName, lastName, and email
    const searchFilter = {
      OR: [
        { firstName: { contains: searchTerm, mode: "insensitive" } },
        { lastName: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
      ],
    };
    Object.assign(adminWhere, searchFilter);
    // For User, merge with existing where
    const userSearch = { AND: [userWhere, searchFilter] };
    // We'll handle users differently below
  }

  // ── Execute queries ──
  const [admins, adminsTotal] = await Promise.all([
    prisma.admin.findMany({
      where: adminWhere as any,
      orderBy: { lastName: "asc" },
      skip,
      take: limit,
    }),
    prisma.admin.count({ where: adminWhere as any }),
  ]);

  // For users, build the where carefully
  let finalUserWhere: Record<string, unknown>;
  if (searchTerm) {
    finalUserWhere = {
      AND: [
        { role: { notIn: [Role.student] } },
        ...(roleFilter ? [{ role: roleFilter }] : []),
        {
          OR: [
            { firstName: { contains: searchTerm, mode: "insensitive" } },
            { lastName: { contains: searchTerm, mode: "insensitive" } },
            { email: { contains: searchTerm, mode: "insensitive" } },
          ],
        },
      ],
    };
  } else if (roleFilter) {
    finalUserWhere = { role: roleFilter };
  } else {
    finalUserWhere = { role: { notIn: [Role.student] } };
  }

  const [users, usersTotal] = await Promise.all([
    prisma.user.findMany({
      where: finalUserWhere as any,
      orderBy: { lastName: "asc" },
      skip: Math.max(0, skip - adminsTotal),
      take: Math.max(0, limit - admins.length),
    }),
    prisma.user.count({ where: finalUserWhere as any }),
  ]);

  const total = adminsTotal + usersTotal;

  // ── Map entries ──
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

  const combined = [...adminEntries, ...userEntries]
    .sort((a, b) => a.lastName.localeCompare(b.lastName))
    .slice(0, limit);

  return {
    entries: combined,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ─── Unified Delete ───────────────────────────────────────────────────────────

type DeleteResult = { success: boolean; error?: string };

// ─── Bulk Delete by Role ───────────────────────────────────────────────────────

type BulkDeleteResult = {
  success: boolean;
  error?: string;
  deleted?: number;
  skippedCurrentUser?: boolean;
};

/**
 * Deletes ALL Admin and User entries matching a given role from Clerk + DB.
 * - Caller must be authenticated and have role admin or superuser.
 * - Caller's own account is always preserved.
 * - Only non-student roles can be targeted (admin, superuser, faculty, registrar, csg).
 * - Role input is validated against the allowed set.
 */
export async function deleteByRole(
  role: string
): Promise<BulkDeleteResult> {
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

  // 3. Validate target role — only non-student roles allowed
  const normalizedRole = role.trim().toLowerCase();
  if (!BULK_DELETE_ALLOWED_ROLES.includes(normalizedRole as BulkDeleteRole)) {
    return { success: false, error: `Invalid role: "${role}". Allowed roles: ${BULK_DELETE_ALLOWED_ROLES.join(", ")}` };
  }

  try {
    // 4. Find all matching entries from both tables
    const roleEnum = normalizedRole as Role;
    const [admins, users] = await Promise.all([
      prisma.admin.findMany({ where: { role: roleEnum } }),
      prisma.user.findMany({ where: { role: roleEnum } }),
    ]);

    const allIds = [
      ...admins.map((a) => ({ id: a.id, source: "admin" as const })),
      ...users.map((u) => ({ id: u.id, source: "user" as const })),
    ];

    if (allIds.length === 0) {
      return { success: true, deleted: 0 };
    }

    const clerk = await clerkClient();
    let deleted = 0;
    let skippedCurrentUser = false;

    // 5. Delete from Clerk first, then Prisma (use transaction for Prisma)
    for (const entry of allIds) {
      // Never delete the caller
      if (entry.id === userId) {
        skippedCurrentUser = true;
        continue;
      }

      try {
        await clerk.users.deleteUser(entry.id);

        if (entry.source === "admin") {
          await prisma.admin.delete({ where: { id: entry.id } });
        } else {
          await prisma.user.delete({ where: { id: entry.id } });
        }

        deleted++;
      } catch (err) {
        console.error(`[deleteByRole] Failed to delete ${entry.id}:`, err);
        // Continue with remaining entries — best-effort deletion
      }
    }

    revalidatePath("/list/admin-lists");
    return { success: true, deleted, skippedCurrentUser };
  } catch (error: any) {
    console.error("[deleteByRole] error:", error);
    return { success: false, error: error.message ?? "Bulk deletion failed. Please try again." };
  }
}

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
  const ALLOWED_UPDATE = ["admin", "superuser"] as const;
  if (!callerRole || !ALLOWED_UPDATE.includes(callerRole as (typeof ALLOWED_UPDATE)[number])) {
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
  const { userId, sessionClaims } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "superuser") {
    return { success: false, error: "Forbidden: only superusers can create admin accounts" };
  }

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


