import { Status } from "@prisma/client";
import { Grades } from "./columns";
import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { GradesListClient } from "./client";
import { checkRateLimit } from "@/lib/rate-limit-postgres";
import { z } from "zod";
import { redirect } from "next/navigation";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";

// Input validation schema
const searchParamsSchema = z.object({
  page: z.coerce.number().int().positive().max(10000).optional().default(1),
  pageSize: z.coerce.number().int().positive().min(1).max(100).optional().default(10),
  search: z.string().max(100).optional().default(""),
});

interface GetDataParams {
  page: number;
  pageSize: number;
  search?: string;
}

async function getData({ page, pageSize, search }: GetDataParams): Promise<{
  data: Grades[];
  total: number;
}> {
  const skip = (page - 1) * pageSize;

  // Build search filter with sanitized input
  const searchFilter = search
    ? {
      OR: [
        { studentNumber: { contains: search, mode: "insensitive" as const } },
        { firstName: { contains: search, mode: "insensitive" as const } },
        { lastName: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    }
    : {};

  // Get total count for pagination
  const total = await prisma.student.count({
    where: searchFilter,
  });

  // Get paginated data
  const students = await prisma.student.findMany({
    where: searchFilter,
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
    skip,
    take: pageSize,
    orderBy: {
      studentNumber: "asc",
    },
  });

  const data = students.map((student) => ({
    ...student,
    studentNumber: String(student.studentNumber),
    status: student.status as Status,
    email: student.email ?? "",
    phone: student.phone ?? "",
    middleInit: student.middleInit ?? "",
    address: student.address ?? "",
  }));

  return { data, total };
}

export default async function GradesListsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; search?: string }>;
}) {
  // Authentication check
  const { userId } = await auth();
  const user = await (currentUser());

  if (!userId) {
    return <RedirectToSignIn />;
  }
  const role = (user?.publicMetadata as { role?: string })?.role;

  const allowedRoles = ["admin", "faculty", "registrar"];
  if (!allowedRoles.includes(role || "")) {
    redirect("/");
  }
  try {
    await checkRateLimit({
      action: "grades-list-view",
      limit: 30,
      windowSeconds: 60,
    });
  } catch (error: any) {
    if (error.code === "RATE_LIMIT_EXCEEDED") {
      return (
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
          <div className="text-center p-8">
            <h2 className="text-xl font-bold text-red-600">Rate Limit Exceeded</h2>
            <p className="text-gray-600 mt-2">{error.message}</p>
            <p className="text-sm text-gray-500 mt-4">Please try again in a moment.</p>
          </div>
        </div>
      );
    }
    throw error;
  }

  // Parse and validate search parameters
  const params = await searchParams;
  const validationResult = searchParamsSchema.safeParse(params);

  if (!validationResult.success) {
    // Invalid parameters - redirect to default page
    redirect("/list/grades-lists");
  }

  const { page, pageSize, search } = validationResult.data;

  // Fetch data with validated parameters
  try {
    const { data, total } = await getData({ page, pageSize, search });

    return (
      <>
        <SignedIn>
          <GradesListClient
            data={data}
            total={total}
            page={page}
            pageSize={pageSize}
          />
        </SignedIn>
        <SignedOut>
          <RedirectToSignIn />
        </SignedOut>
      </>
    );
  } catch (error) {
    console.error("Error fetching grades list:", error);
    return (
      <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-red-600">Error Loading Grades</h2>
          <p className="text-gray-600 mt-2">
            Failed to load the grades list. Please try again later.
          </p>
        </div>
      </div>
    );
  }
}
