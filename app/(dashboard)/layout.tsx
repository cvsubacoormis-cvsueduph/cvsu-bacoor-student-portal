import Menu from "@/components/Menu";
import NavBar from "@/components/NavBar";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Image from "next/image";
import { Toaster } from "sonner";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    redirect("/sign-in");
  }

  const role = user.publicMetadata?.role as string;
  const isApproved = user.publicMetadata?.isApproved as boolean;

  /**
   * ============================
   * ADMIN / FACULTY / REGISTRAR
   * ============================
   */
  if (["admin", "faculty", "registrar"].includes(role)) {
    return (
      <div className="h-screen flex">
        {/* LEFT */}
        <div className="w-[14%] md:w-[8%] lg:w-[16%] xl:w-[14%] p-4">
          <div className="mb-2 flex items-center">
            <Image src="/logos.png" alt="logo" width={230} height={230} />
          </div>
          <Menu />
        </div>

        {/* RIGHT */}
        <div className="w-[86%] md:w-[92%] lg:w-[84%] xl:w-[86%] bg-[#F7F8FA] overflow-scroll">
          <NavBar />
          {children}
          <Toaster position="top-right" />
          <SpeedInsights />
        </div>
      </div>
    );
  }

  /**
   * ============================
   * STUDENT APPROVAL CHECK
   * ============================
   */
  if (!isApproved) {
    redirect("/pending-approval");
  }

  const student = await prisma.student.findUnique({
    where: { id: userId },
    select: {
      isApproved: true,
      course: true,
    },
  });

  if (!student || student.isApproved === false) {
    redirect("/pending-approval");
  }

  /**
   * ============================
   * COURSE / DATE / TIME ACCESS
   * ============================
   */

  // Manila time
  const now = new Date();
  const manilaNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );

  const dateKey = manilaNow.toISOString().split("T")[0];
  const cacheKey = `course-access:${student.course}:${dateKey}`;

  let accessSchedule: {
    startTime: string;
    endTime: string;
  } | null = null;

  // 1️⃣ Try Redis
  const cached = await redis.get(cacheKey);
  if (cached && cached !== "NONE") {
    accessSchedule = JSON.parse(cached);
  }

  // 2️⃣ Fallback to DB
  if (!accessSchedule) {
    const schedule = await prisma.courseAccessSchedule.findFirst({
      where: {
        course: student.course,
        accessDate: new Date(dateKey),
        isActive: true,
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    await redis.set(
      cacheKey,
      schedule ? JSON.stringify(schedule) : "NONE",
      "EX",
      300 // 5 minutes cache
    );

    accessSchedule = schedule;
  }

  // 3️⃣ No schedule = blocked
  if (!accessSchedule) {
    redirect("/access-closed");
  }

  // 4️⃣ Time validation
  const currentMinutes =
    manilaNow.getHours() * 60 + manilaNow.getMinutes();

  const [startHour, startMinute] = accessSchedule.startTime
    .split(":")
    .map(Number);
  const [endHour, endMinute] = accessSchedule.endTime
    .split(":")
    .map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute + 5; // grace period

  if (
    currentMinutes < startMinutes ||
    currentMinutes > endMinutes
  ) {
    redirect("/access-closed");
  }

  /**
   * ============================
   * STUDENT DASHBOARD UI
   * ============================
   */
  return (
    <div className="h-screen flex">
      {/* LEFT */}
      <div className="w-[14%] md:w-[8%] lg:w-[16%] xl:w-[14%] p-4">
        <div className="mb-2 flex items-center">
          <Image src="/logos.png" alt="logo" width={230} height={230} />
        </div>
        <Menu />
      </div>

      {/* RIGHT */}
      <div className="w-[86%] md:w-[92%] lg:w-[84%] xl:w-[86%] bg-[#F7F8FA] overflow-scroll">
        <NavBar />
        {children}
        <Toaster position="top-right" />
        <SpeedInsights />
      </div>
    </div>
  );
}
