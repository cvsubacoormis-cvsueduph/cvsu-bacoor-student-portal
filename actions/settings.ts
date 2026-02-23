"use server";

import prisma from "@/lib/prisma";

export async function getSetting(key: string): Promise<string | null> {
    try {
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
