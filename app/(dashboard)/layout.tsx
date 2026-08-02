import NavBar from "@/components/NavBar";
import { Toaster } from "sonner";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { SidebarProvider } from "@/components/SidebarProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/Sidebar";
import MobileSidebar from "@/components/MobileSidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, sessionClaims } = await auth();

  if (!userId || !sessionClaims) redirect("/sign-in");

  const role = (sessionClaims.metadata as { role?: string })?.role as string;
  const isApproved = (sessionClaims.metadata as { isApproved?: boolean })?.isApproved as boolean;

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

  // TODO(timezone): The block below uses a fragile `toLocaleString` + `new Date(string)`
  // pattern that silently depends on the server running in UTC. It works on Vercel but
  // will produce wrong access-window decisions on any non-UTC host. The `accessDate`
  // comparison via `new Date(dateKey)` also parses the YYYY-MM-DD string as UTC midnight
  // rather than Manila midnight, causing off-by-one issues near the day boundary.
  //
  // Recommended fix: replace the manual offset math with `date-fns-tz`:
  //   import { formatInTimeZone, toZonedTime } from "date-fns-tz";
  //   const manilaNow = toZonedTime(new Date(), "Asia/Manila");
  //   const dateKey = formatInTimeZone(new Date(), "Asia/Manila", "yyyy-MM-dd");
  //   const currentManilaMinutes = manilaNow.getHours() * 60 + manilaNow.getMinutes();
  //
  // Revisit if: (a) you migrate off Vercel, (b) a student reports being locked out near
  // midnight Manila time, or (c) you need to support multiple timezones.
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
