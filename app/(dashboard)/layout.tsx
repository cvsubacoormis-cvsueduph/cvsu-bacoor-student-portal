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
  if (["admin", "faculty", "registrar"].includes(role)) {
    return renderLayout(children);
  }

  const student = await prisma.student.findUnique({
    where: { id: userId },
    select: {
      isApproved: true,
      course: true,
    },
  });

  if (!student) {
    redirect("/sign-in");
  }

  if (!student.isApproved) {
    redirect("/pending-approval");
  }

  const now = new Date();
  const manilaNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );

  const todayKey = manilaNow.toISOString().split("T")[0];
  const cacheKey = `course-access:${student.course}:${todayKey}`;

  let schedule: {
    startTime: string;
    endTime: string;
  } | null = null;

  const cached = await redis.get(cacheKey);

  if (cached && cached !== "NONE") {
    schedule = JSON.parse(cached);
  }

  if (!schedule) {
    const dbSchedule = await prisma.courseAccessSchedule.findFirst({
      where: {
        course: student.course,
        accessDate: new Date(todayKey),
        isActive: true,
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    await redis.set(
      cacheKey,
      dbSchedule ? JSON.stringify(dbSchedule) : "NONE",
      "EX",
      300
    );

    schedule = dbSchedule;
  }

  if (!schedule) {
    redirect("/access-closed");
  }
  const currentMinutes =
    manilaNow.getHours() * 60 + manilaNow.getMinutes();

  const [startHour, startMinute] = schedule.startTime
    .split(":")
    .map(Number);
  const [endHour, endMinute] = schedule.endTime
    .split(":")
    .map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute + 5;

  let hasAccess = false;

  if (startMinutes <= endMinutes) {
    hasAccess =
      currentMinutes >= startMinutes &&
      currentMinutes <= endMinutes;
  } else {
    hasAccess =
      currentMinutes >= startMinutes ||
      currentMinutes <= endMinutes;
  }

  if (!hasAccess) {
    redirect("/access-closed");
  }

  return renderLayout(children);
}

function renderLayout(children: React.ReactNode) {
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
