"use server";

import prisma from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

export type MyGradeChange = {
  id: string;
  action: string;
  studentNumber: string;
  gradeData: Record<string, unknown>;
  gradeId: string | null;
  courseCode: string | null;
  academicYear: string;
  semester: string;
  requestedById: string;
  requestedByName: string;
  requestedRole: string;
  status: string;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

export async function getMyGradeChanges(): Promise<MyGradeChange[]> {
  const user = await currentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const role = user.publicMetadata?.role as string | undefined;
  const allowedRoles = [
    "admin",
    "superuser",
    "registrar",
    "registrar_staff",
    "faculty",
  ];
  if (!role || !allowedRoles.includes(role)) {
    throw new Error("Forbidden: insufficient permissions.");
  }

  const changes = await prisma.pendingGradeChange.findMany({
    where: {
      requestedById: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return changes.map((c) => ({
    ...c,
    academicYear: c.academicYear ?? "",
    semester: c.semester ?? "",
    gradeData: c.gradeData as Record<string, unknown>,
    createdAt: c.createdAt.toISOString(),
    reviewedAt: c.reviewedAt?.toISOString() ?? null,
  }));
}
