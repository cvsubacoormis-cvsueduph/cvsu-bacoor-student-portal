
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { Courses } from "@prisma/client";
import { addDays, format, isAfter, isSameDay, parseISO } from "date-fns";

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
        const { course, startDate, endDate, startTime, endTime, accessDate } = body;

        const effectiveStartDate = startDate || accessDate;
        const effectiveEndDate = endDate || accessDate;

        if (!course || !effectiveStartDate || !startTime || !endTime) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const start = new Date(effectiveStartDate);
        const end = new Date(effectiveEndDate);
        let current = start;

        const results = [];

        while (!isAfter(current, end)) {
            let dayStartTime = "00:00";
            let dayEndTime = "23:59";

            if (isSameDay(current, start)) {
                dayStartTime = startTime;
            }
            if (isSameDay(current, end)) {
                dayEndTime = endTime;
            }

            const accessDate = new Date(current);

            const schedule = await prisma.courseAccessSchedule.upsert({
                where: { course_accessDate: { course, accessDate } },
                update: { startTime: dayStartTime, endTime: dayEndTime, isActive: true },
                create: { course, accessDate, startTime: dayStartTime, endTime: dayEndTime },
            });

            await redis.set(getCacheKey(course, accessDate), JSON.stringify(schedule), "EX", 300);

            results.push(schedule);
            current = addDays(current, 1);
        }

        return NextResponse.json({ message: "Schedule(s) set successfully", schedules: results });
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
        const { course, accessDate, newTaskDate, startTime, endTime, isActive } = body;

        if (!course || !accessDate) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const oldDate = new Date(accessDate);
        let newDate = oldDate;
        if (newTaskDate) {
            newDate = new Date(newTaskDate);
        }

        // Atomic update if date changed
        const schedule = await prisma.courseAccessSchedule.update({
            where: { course_accessDate: { course, accessDate: oldDate } },
            data: {
                startTime,
                endTime,
                isActive,
                accessDate: newDate
            },
        });

        // Update Redis cache (Clear old, set new)
        if (newTaskDate && !isSameDay(oldDate, newDate)) {
            await redis.del(getCacheKey(course, oldDate));
        }
        await redis.set(getCacheKey(course, newDate), JSON.stringify(schedule), "EX", 300);

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
