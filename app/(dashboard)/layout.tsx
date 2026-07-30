import NavBar from "@/components/NavBar";
import { Toaster } from "sonner";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { SidebarProvider } from "@/components/SidebarProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/Sidebar";
import MobileSidebar from "@/components/MobileSidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  const user = await getCurrentUser();

  if (!userId || !user) redirect("/sign-in");

  const role = user.publicMetadata?.role as string;
  const isApproved = user.publicMetadata?.isApproved as boolean;

  if (["admin", "faculty", "registrar", "registrar_staff"].includes(role)) {
    return (
      <TooltipProvider>
        <SidebarProvider>
          <div className="h-screen flex overflow-hidden">
            <MobileSidebar role={role} />
            <div className="hidden lg:block">
              <Sidebar role={role} />
            </div>
            <div className="flex-1 bg-[#F7F8FA] overflow-y-auto flex flex-col min-w-0">
              <NavBar />
              {children}
              <Toaster position="top-right" />
            </div>
          </div>
        </SidebarProvider>
      </TooltipProvider>
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
    const currentMinutes = currentTotalMinutesUTC + MANILA_OFFSET;

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
    <TooltipProvider>
      <SidebarProvider>
        <div className="h-screen flex overflow-hidden">
          <MobileSidebar role={role} />
          <div className="hidden lg:block">
            <Sidebar role={role} />
          </div>
          <div className="flex-1 overflow-hidden flex flex-col min-w-0">
            <NavBar />
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
            <Toaster position="top-right" />
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
