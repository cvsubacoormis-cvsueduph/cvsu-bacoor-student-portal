"use server";

import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redis, withRedisFallback } from "@/lib/redis";
import { revalidatePath } from "next/cache";

export type ActiveUploadTerm = {
    academicYear: string;
    semester: "FIRST" | "SECOND" | "MIDYEAR";
};

const ACTIVE_UPLOAD_TERM_AY_KEY = "ACTIVE_UPLOAD_TERM_AY";
const ACTIVE_UPLOAD_TERM_SEM_KEY = "ACTIVE_UPLOAD_TERM_SEM";
const ACTIVE_UPLOAD_TERM_CACHE_AY = `cache:settings:${ACTIVE_UPLOAD_TERM_AY_KEY}:v1`;
const ACTIVE_UPLOAD_TERM_CACHE_SEM = `cache:settings:${ACTIVE_UPLOAD_TERM_SEM_KEY}:v1`;

function isSemester(value: string | null | undefined): value is "FIRST" | "SECOND" | "MIDYEAR" {
    return value === "FIRST" || value === "SECOND" || value === "MIDYEAR";
}

export async function getActiveUploadTerm(): Promise<ActiveUploadTerm | null> {
    try {
        const { userId } = await auth();
        if (!userId) return null;

        const cached = await withRedisFallback(async () => {
            const [ay, sem] = await Promise.all([
                redis.get(ACTIVE_UPLOAD_TERM_CACHE_AY),
                redis.get(ACTIVE_UPLOAD_TERM_CACHE_SEM),
            ]);
            if (ay && sem && isSemester(sem)) {
                return { academicYear: ay, semester: sem };
            }
            return null;
        });

        if (cached) return cached;

        const [aySetting, semSetting] = await Promise.all([
            prisma.systemSettings.findUnique({ where: { key: ACTIVE_UPLOAD_TERM_AY_KEY } }),
            prisma.systemSettings.findUnique({ where: { key: ACTIVE_UPLOAD_TERM_SEM_KEY } }),
        ]);

        const ay = aySetting?.value || null;
        const sem = semSetting?.value || null;

        if (!ay || !sem || !isSemester(sem)) {
            return null;
        }

        const result: ActiveUploadTerm = { academicYear: ay, semester: sem };

        // Populate cache (best-effort)
        await withRedisFallback(async () => {
            await Promise.all([
                redis.set(ACTIVE_UPLOAD_TERM_CACHE_AY, ay, "EX", SETTINGS_CACHE_TTL),
                redis.set(ACTIVE_UPLOAD_TERM_CACHE_SEM, sem, "EX", SETTINGS_CACHE_TTL),
            ]);
        });

        return result;
    } catch (error) {
        console.error("Failed to get active upload term:", error);
        return null;
    }
}

async function invalidateActiveUploadTermCache() {
    try {
        await redis.del(ACTIVE_UPLOAD_TERM_CACHE_AY);
        await redis.del(ACTIVE_UPLOAD_TERM_CACHE_SEM);
    } catch {
        // Redis failure must not break the write operation
    }
}

export async function setActiveUploadTerm(input: {
    academicYear: string;
    semester: "FIRST" | "SECOND" | "MIDYEAR";
}): Promise<{ success: boolean; message?: string }> {
    try {
        const user = await getCurrentUser();
        const userRole = (user?.publicMetadata?.role as string) || "";
        if (userRole !== "admin" && userRole !== "superuser") {
            console.error(
                `Unauthorized attempt to set active upload term by user ${user?.id} (role: ${userRole})`,
            );
            return { success: false, message: "Unauthorized" };
        }

        if (!input?.academicYear || !isSemester(input.semester)) {
            return { success: false, message: "Invalid academic year or semester." };
        }

        const termExists = await prisma.academicTerm.findUnique({
            where: {
                academicYear_semester: {
                    academicYear: input.academicYear as any,
                    semester: input.semester,
                },
            },
        });

        if (!termExists) {
            return {
                success: false,
                message: "That academic term has not been created yet.",
            };
        }

        await prisma.$transaction([
            prisma.systemSettings.upsert({
                where: { key: ACTIVE_UPLOAD_TERM_AY_KEY },
                update: { value: input.academicYear },
                create: { key: ACTIVE_UPLOAD_TERM_AY_KEY, value: input.academicYear },
            }),
            prisma.systemSettings.upsert({
                where: { key: ACTIVE_UPLOAD_TERM_SEM_KEY },
                update: { value: input.semester },
                create: { key: ACTIVE_UPLOAD_TERM_SEM_KEY, value: input.semester },
            }),
        ]);

        await invalidateActiveUploadTermCache();
        revalidatePath("/list/uploading");

        return { success: true };
    } catch (error) {
        console.error("Failed to set active upload term:", error);
        return { success: false, message: "Failed to set assigned upload term." };
    }
}

export async function clearActiveUploadTerm(): Promise<{ success: boolean }> {
    try {
        const user = await getCurrentUser();
        const userRole = (user?.publicMetadata?.role as string) || "";
        if (userRole !== "admin" && userRole !== "superuser") {
            console.error(
                `Unauthorized attempt to clear active upload term by user ${user?.id} (role: ${userRole})`,
            );
            return { success: false };
        }

        await prisma.$transaction([
            prisma.systemSettings.deleteMany({ where: { key: ACTIVE_UPLOAD_TERM_AY_KEY } }),
            prisma.systemSettings.deleteMany({ where: { key: ACTIVE_UPLOAD_TERM_SEM_KEY } }),
        ]);

        await invalidateActiveUploadTermCache();
        revalidatePath("/list/uploading");

        return { success: true };
    } catch (error) {
        console.error("Failed to clear active upload term:", error);
        return { success: false };
    }
}

// Cache TTL of 60 seconds — short enough to avoid stale access-control decisions
// (GRADES_VISIBLE_TO_STUDENTS, UPLOAD_GRADES_ENABLED, FACULTY_UPDATE_REQUIRES_APPROVAL)
// but long enough to reduce DB compute on repeated reads.
const SETTINGS_CACHE_TTL = 60;

export async function getSetting(key: string): Promise<string | null> {
    try {
        const { userId } = await auth();
        if (!userId) {
            return null;
        }

        const cacheKey = `cache:settings:${key}:v1`;

        // Try cache first — falls through to DB on Redis miss or disconnect
        const cached = await withRedisFallback(async () => {
            const raw = await redis.get(cacheKey);
            return raw ?? null;
        });

        if (cached !== null) {
            return cached;
        }

        // Cache miss — query DB
        const setting = await prisma.systemSettings.findUnique({
            where: { key },
        });
        const value = setting?.value || null;

        // Populate cache (best-effort, don't block on Redis failure)
        if (value !== null) {
            await withRedisFallback(async () => {
                await redis.set(cacheKey, value, "EX", SETTINGS_CACHE_TTL);
            });
        }

        return value;
    } catch (error) {
        console.error(`Failed to get setting ${key}:`, error);
        return null;
    }
}

export async function setSetting(key: string, value: string): Promise<boolean> {
    try {
        const user = await getCurrentUser();
        const userRole = (user?.publicMetadata?.role as string) || "";
        const isAdmin = userRole === "admin";

        if (!isAdmin) {
            console.error(`Unauthorized attempt to set setting ${key} by user ${user?.id}`);
            return false;
        }

        await prisma.systemSettings.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });

        // Invalidate cache so subsequent reads fetch fresh data
        try {
            await redis.del(`cache:settings:${key}:v1`);
        } catch {
            // Redis failure must not break the write operation
        }

        return true;
    } catch (error) {
        console.error(`Failed to set setting ${key}:`, error);
        return false;
    }
}

/**
 * Toggle grade visibility for students. Allowed roles: admin, superuser, faculty.
 * When disabled, students see a "grades are being processed" message instead of their grades.
 */
export async function toggleGradeVisibility(enabled: boolean): Promise<boolean> {
    try {
        const user = await getCurrentUser();
        const userRole = (user?.publicMetadata?.role as string) || "";
        const allowedRoles = ["admin", "superuser", "faculty"];

        if (!allowedRoles.includes(userRole)) {
            console.error(`Unauthorized attempt to toggle grade visibility by user ${user?.id} (role: ${userRole})`);
            return false;
        }

        await prisma.systemSettings.upsert({
            where: { key: "GRADES_VISIBLE_TO_STUDENTS" },
            update: { value: enabled.toString() },
            create: { key: "GRADES_VISIBLE_TO_STUDENTS", value: enabled.toString() },
        });

        // Invalidate cache so subsequent reads fetch fresh data
        try {
            await redis.del("cache:settings:GRADES_VISIBLE_TO_STUDENTS:v1");
        } catch {
            // Redis failure must not break the write operation
        }

        return true;
    } catch (error) {
        console.error("Failed to toggle grade visibility:", error);
        return false;
    }
}

/**
 * Check if grades are currently visible to students.
 * Returns true if the setting doesn't exist (defaults to visible).
 */
export async function getGradeVisibility(): Promise<boolean> {
    try {
        const setting = await getSetting("GRADES_VISIBLE_TO_STUDENTS");
        // If setting doesn't exist, default to visible (true)
        return setting !== "false";
    } catch (error) {
        console.error("Failed to get grade visibility:", error);
        // Default to visible on error to avoid locking students out
        return true;
    }
}
