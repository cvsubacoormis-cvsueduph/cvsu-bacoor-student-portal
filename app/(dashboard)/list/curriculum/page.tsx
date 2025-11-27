import { CurriculumDataTable } from "@/components/CurriculumDataTable";
import prisma from "@/lib/prisma";
import { CurriculumChecklist } from "@/components/curriculum/types";
import { Prisma } from "@prisma/client";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CurriculumPage({ searchParams }: PageProps) {
  const { page, limit, search } = await searchParams;

  const p = page ? parseInt(page as string) : 1;
  const l = limit ? parseInt(limit as string) : 10;
  const skip = (p - 1) * l;

  const query: Prisma.CurriculumChecklistWhereInput = {};

  if (search) {
    query.OR = [
      { courseTitle: { contains: search as string, mode: "insensitive" } },
      { courseCode: { contains: search as string, mode: "insensitive" } },
    ];
  }

  const [data, count] = await prisma.$transaction([
    prisma.curriculumChecklist.findMany({
      where: query,
      take: l,
      skip: skip,
      orderBy: { courseCode: "asc" },
    }),
    prisma.curriculumChecklist.count({ where: query }),
  ]);

  const formattedData: CurriculumChecklist[] = data.map((item) => ({
    ...item,
    preRequisite: item.preRequisite || undefined,
  }));

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-semibold">
          Curriculum Checklist{" "}
          <span className=" flex text-xs text-gray-500">
            Lists of curriculums
          </span>
        </h1>
      </div>
      <CurriculumDataTable
        data={formattedData}
        count={count}
        page={p}
        limit={l}
      />
    </div>
  );
}
