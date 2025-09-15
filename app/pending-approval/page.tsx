import { WaitingApproval } from "@/components/WaitingForApproval";
import React from "react";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";

export default async function PendingApprovalPage() {
  const { userId } = await auth();

  if (!userId) {
    return redirect("/");
  }

  const student = await prisma.student.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      middleInit: true,
      status: true,
      isPasswordSet: true,
      isApproved: true,
    },
  });

  if (!student) {
    return redirect("/");
  }

  const user = {
    id: student.id,
    email: student?.email || "",
    name: `${student.firstName} ${student.middleInit} ${student.lastName}`,
    status: student.status,
    hasPassword: student.isPasswordSet,
    isApproved: student.isApproved,
  };

  return (
    <div>
      <WaitingApproval user={user} />
    </div>
  );
}
