export const dynamic = "force-dynamic";
export const revalidate = 60;

import { getStudentData } from "@/actions/getStudentData";
import StudentProfile from "@/components/StudentProfile";

export default async function StudentProfilePage() {
  const data = await getStudentData();

  return (
    <main className="min-h-[100dvh] w-full py-6 md:py-10">
      <div className="px-4 md:px-8">
        <StudentProfile data={data} />
      </div>
    </main>
  );
}
