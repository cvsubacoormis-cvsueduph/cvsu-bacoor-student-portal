"use server";

import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function getSetting(key: string): Promise<string | null> {
    try {
        const { userId } = await auth();
        if (!userId) {
            return null;
        }

        const setting = await prisma.systemSettings.findUnique({
            where: { key },
        });
        return setting?.value || null;
    } catch (error) {
        console.error(`Failed to get setting ${key}:`, error);
        return null;
    }
}

export async function setSetting(key: string, value: string): Promise<boolean> {
    try {
        const user = await currentUser();
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
        const user = await currentUser();
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
