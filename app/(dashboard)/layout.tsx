import Menu from "@/components/Menu";
import NavBar from "@/components/NavBar";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Image from "next/image";
import { Toaster } from "sonner";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) redirect("/sign-in");

  const role = user.publicMetadata?.role as string;
  const isApproved = user.publicMetadata?.isApproved as boolean;

  if (["admin", "faculty", "registrar"].includes(role)) {
    return (
      <div className="h-screen flex">
        <div className="w-[14%] p-4">
          <Image src="/logos.png" alt="logo" width={230} height={230} />
          <Menu />
        </div>
        <div className="w-[86%] bg-[#F7F8FA] overflow-scroll">
          <NavBar />
          {children}
          <Toaster position="top-right" />
        </div>
      </div>
    );
  }

  if (!isApproved) redirect("/pending-approval");

  const student = await prisma.student.findUnique({
    where: { id: userId },
    select: { isApproved: true, course: true },
  });

  if (!student || !student.isApproved) redirect("/pending-approval");

  const nowUTC = new Date();
  const manilaDate = new Date(nowUTC.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const dateKey = manilaDate.toISOString().split("T")[0];
  const cacheKey = `course-access:${student.course}:${dateKey}`;

  let accessSchedule = null;
  const cached = await redis.get(cacheKey);
  if (cached && cached !== "NONE") accessSchedule = JSON.parse(cached);

  if (!accessSchedule) {
    const schedule = await prisma.courseAccessSchedule.findFirst({
      where: { course: student.course, accessDate: new Date(dateKey), isActive: true },
      select: { startTime: true, endTime: true },
    });

    await redis.set(cacheKey, schedule ? JSON.stringify(schedule) : "NONE", "EX", 300);
    accessSchedule = schedule;
  }


  if (accessSchedule) {

    const [startHour, startMinute] = accessSchedule.startTime.split(":").map(Number);
    const [endHour, endMinute] = accessSchedule.endTime.split(":").map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute + 5;
    const MANILA_OFFSET = 8 * 60; // 8 hours in minutes
    const currentTotalMinutesUTC = nowUTC.getUTCHours() * 60 + nowUTC.getUTCMinutes();
    let currentMinutes = currentTotalMinutesUTC + MANILA_OFFSET;

    const manilaDate = new Date(nowUTC.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const currentManilaMinutes = manilaDate.getHours() * 60 + manilaDate.getMinutes();

    if (currentManilaMinutes < startMinutes || currentManilaMinutes > endMinutes) redirect("/access-closed");
  } else {
    // No schedule for today. Check if we are in "Restricted Mode".
    const restrictionCacheKey = `course-restriction:${student.course}`;
    let isRestricted = await redis.get(restrictionCacheKey);

    if (!isRestricted) {
      const count = await prisma.courseAccessSchedule.count({
        where: { course: student.course, isActive: true },
      });
      isRestricted = count > 0 ? "TRUE" : "FALSE";
      await redis.set(restrictionCacheKey, isRestricted, "EX", 60); // Cache for 1 min
    }

    if (isRestricted === "TRUE") {
      redirect("/access-closed");
    }
    // Else: Open Access
  }

  return (
    <div className="h-screen flex">
      <div className="w-[14%] p-4">
        <Image src="/logos.png" alt="logo" width={230} height={230} />
        <Menu />
      </div>
      <div className="w-[86%] bg-[#F7F8FA] overflow-scroll">
        <NavBar />
        {children}
        <Toaster position="top-right" />
      </div>
    </div>
  );
}
