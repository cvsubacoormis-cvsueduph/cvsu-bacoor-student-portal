import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { Courses } from "@prisma/client";

// Helper: Redis cache key
const getCacheKey = (course: string, date: Date) =>
    `course-access:${course}:${date.toISOString().split("T")[0]}`;

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const courseParam = url.searchParams.get("course");
        const course = courseParam && Object.values(Courses).includes(courseParam as Courses)
            ? (courseParam as Courses)
            : undefined;

        const schedules = await prisma.courseAccessSchedule.findMany({
            where: course ? { course } : undefined,
            orderBy: { accessDate: "asc" },
        });

        return NextResponse.json({ schedules });
    } catch (err: any) {
        console.error("❌ /api/schedules GET error:", err);
        return NextResponse.json(
            { error: err.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const { sessionClaims } = await auth();
        const role = (sessionClaims?.metadata as { role?: string })?.role;

        if (role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const body = await req.json();
        const { course, accessDate, startTime, endTime } = body;

        if (!course || !accessDate || !startTime || !endTime) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const date = new Date(accessDate);

        const schedule = await prisma.courseAccessSchedule.upsert({
            where: { course_accessDate: { course, accessDate: date } },
            update: { startTime, endTime, isActive: true },
            create: { course, accessDate: date, startTime, endTime },
        });

        // Update Redis cache
        await redis.set(getCacheKey(course, date), JSON.stringify(schedule), "EX", 300);

        return NextResponse.json({ message: "Schedule set successfully", schedule });
    } catch (err: any) {
        console.error("❌ /api/schedules POST error:", err);
        return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
    }
}

// ------------------- EDIT -------------------
export async function PUT(req: Request) {
    try {
        const { sessionClaims } = await auth();
        const role = (sessionClaims?.metadata as { role?: string })?.role;

        if (role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const body = await req.json();
        const { course, accessDate, startTime, endTime, isActive } = body;

        if (!course || !accessDate) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const date = new Date(accessDate);

        const schedule = await prisma.courseAccessSchedule.update({
            where: { course_accessDate: { course, accessDate: date } },
            data: { startTime, endTime, isActive },
        });

        // Update Redis cache
        await redis.set(getCacheKey(course, date), JSON.stringify(schedule), "EX", 300);

        return NextResponse.json({ message: "Schedule updated successfully", schedule });
    } catch (err: any) {
        console.error("❌ /api/schedules PUT error:", err);
        return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
    }
}

// ------------------- DELETE -------------------
export async function DELETE(req: Request) {
    try {
        const { sessionClaims } = await auth();
        const role = (sessionClaims?.metadata as { role?: string })?.role;

        if (role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const url = new URL(req.url);
        const courseParam = url.searchParams.get("course");
        const accessDate = url.searchParams.get("accessDate");

        if (!courseParam || !accessDate) {
            return NextResponse.json({ error: "Missing required query parameters" }, { status: 400 });
        }

        const date = new Date(accessDate);

        const course = courseParam as Courses;

        const schedule = await prisma.courseAccessSchedule.delete({
            where: { course_accessDate: { course, accessDate: date } },
        });

        // Remove from Redis cache
        await redis.del(getCacheKey(course, date));

        return NextResponse.json({ message: "Schedule deleted successfully", schedule });
    } catch (err: any) {
        console.error("❌ /api/schedules DELETE error:", err);
        return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
    }
}
