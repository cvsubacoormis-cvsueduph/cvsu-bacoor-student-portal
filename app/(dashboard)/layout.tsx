import Menu from "@/components/Menu";
import NavBar from "@/components/NavBar";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Image from "next/image";
import { Toaster } from "sonner";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    redirect("/sign-in");
  }
  const role = user?.publicMetadata?.role as string;
  const isApproved = user?.publicMetadata?.isApproved as boolean;

  if (role === "admin" || "faculty" || "registrar") {
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
  if (!isApproved) {
    redirect("/pending-approval");
  }

  const student = await prisma.student.findUnique({
    where: { id: userId },
    select: { isApproved: true },
  });

  if (!student?.isApproved) {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { isApproved: false },
    });
    redirect("/pending-approval");
  }

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
