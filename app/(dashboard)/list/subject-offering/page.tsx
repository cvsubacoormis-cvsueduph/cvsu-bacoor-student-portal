import { SubjectOfferingDataTable } from "@/components/SubjectOfferingDataTable";
import { getSubjectOfferings } from "@/actions/subject-offering";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SubjectOfferingPage({ searchParams }: PageProps) {
  const { page, limit, search, academicYear, semester } = await searchParams;

  const p = page ? parseInt(page as string) : 1;
  const l = limit ? parseInt(limit as string) : 10;

  const { data, count } = await getSubjectOfferings({
    page: p,
    limit: l,
    search: search as string,
    academicYear: academicYear as string,
    semester: semester as string,
  });

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <SubjectOfferingDataTable
        data={data}
        count={count}
        page={p}
        limit={l}
      />
    </div>
  );
}
