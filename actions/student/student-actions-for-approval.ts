"use server";
import { AccountApprovedEmail } from "@/components/AccountApprovedEmail";
import AccountRejectedEmail from "@/components/AccountRejectedEmail";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { Resend } from "resend";

// const resend = new Resend(process.env.RESEND_API_KEY);

export async function approveStudent(studentId: string) {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string }) || undefined;

  if (!userId || role?.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await prisma.student.update({
    where: { id: studentId },
    data: { isApproved: true },
  });

  // await resend.emails.send({
  //   from: "University Admin <no-reply@yourdomain.com>",
  //   to: "cvsubacoor.mis@cvsu.edu.ph",
  //   subject: "Your account has been approved",
  //   react: AccountApprovedEmail({
  //     studentName: "John Doe",
  //     studentNumber: "123456789",
  //     loginUrl: "http://localhost:3000/",
  //     universityName: "Cavite State University Bacoor City Campus",
  //   }),
  // });
}

export async function rejectStudent(studentId: string) {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string }) || undefined;

  if (!userId || role?.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await prisma.student.update({
    where: { id: studentId },
    data: { isApproved: false },
  });

  // await resend.emails.send({
  //   to: "cvsubacoor.mis@cvsu.edu.ph",
  //   from: "noreply@example.com", // doesn’t have to be real
  //   subject: "Test email",
  //   react: AccountRejectedEmail({
  //     studentName: "John Doe",
  //     studentNumber: "123456789",
  //     loginUrl: "http://localhost:3000/",
  //     universityName: "Cavite State University Bacoor City Campus",
  //   }),
  // });
}
