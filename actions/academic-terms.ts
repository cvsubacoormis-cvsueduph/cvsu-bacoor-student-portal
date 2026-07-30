"use server";

import prisma from "@/lib/prisma";
import { redis, withRedisFallback } from "@/lib/redis";
import { AcademicYear, Semester } from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function createAcademicTerm(data: {
    academicYear: AcademicYear;
    semester: Semester;
}) {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
        return { success: false, message: "Unauthorized" };
    }

    const callerRole = (sessionClaims?.metadata as { role?: string })?.role;
    const ALLOWED = ["admin", "superuser", "registrar"] as const;
    if (!callerRole || !ALLOWED.includes(callerRole as (typeof ALLOWED)[number])) {
        return { success: false, message: "Forbidden: insufficient permissions." };
    }

    try {
        const existingTerm = await prisma.academicTerm.findUnique({
            where: {
                academicYear_semester: {
                    academicYear: data.academicYear,
                    semester: data.semester,
                },
            },
        });

        if (existingTerm) {
            return { success: false, message: "Academic Term already exists." };
        }

        await prisma.academicTerm.create({
            data: {
                academicYear: data.academicYear,
                semester: data.semester,
            },
        });

        // Invalidate cache so subsequent reads pick up the new term
        try {
            await redis.del("cache:academicTerms:v1");
        } catch {
            // Redis failure should not break the write operation
        }

        revalidatePath("/list/subject-offering");
        return { success: true, message: "Academic Term created successfully." };
    } catch (error) {
        console.error("Failed to create academic term:", error);
        return { success: false, message: "Failed to create academic term." };
    }
}

export async function getAllAcademicTerms() {
    const { userId } = await auth();
    if (!userId) {
        throw new Error("Unauthorized");
    }

    try {
        // Try Redis cache first (TTL: 1 hour — academic terms change at most once per semester)
        const cached = await withRedisFallback(async () => {
            const raw = await redis.get("cache:academicTerms:v1");
            return raw ? JSON.parse(raw) : null;
        }, null);
        if (cached) return cached;

        const terms = await prisma.academicTerm.findMany({
            orderBy: [
                { academicYear: "desc" },
                { semester: "desc" }, // Sort semester conceptually if possible, existing enum might be tricky but this is fine
            ],
        });

        // Cache for 1 hour (fire-and-forget; Redis failure won't block response)
        withRedisFallback(async () => {
            await redis.set("cache:academicTerms:v1", JSON.stringify(terms), "EX", 3600);
        });

        return terms;
    } catch (error) {
        console.error("Failed to fetch academic terms:", error);
        return [];
    }
}
