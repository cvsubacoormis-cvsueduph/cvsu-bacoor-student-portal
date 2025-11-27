import { Status } from "@prisma/client";
import { Grades } from "./columns";
import prisma from "@/lib/prisma";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import { GradesListClient } from "./client";

async function getData(): Promise<Grades[]> {
  const students = await prisma.student.findMany({
    select: {
      id: true,
      studentNumber: true,
      firstName: true,
      lastName: true,
      middleInit: true,
      email: true,
      phone: true,
      address: true,
      course: true,
      status: true,
    },
  });

  return students.map((student) => ({
    ...student,
    studentNumber: String(student.studentNumber),
    status: student.status as Status,
    email: student.email ?? "",
    phone: student.phone ?? "",
    middleInit: student.middleInit ?? "",
    address: student.address ?? "",
  }));
}

export default async function GradesListsPage() {
  const data = await getData();

  return (
    <>
      <SignedIn>
        <GradesListClient data={data} />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
