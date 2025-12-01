import { getFailedLogs } from "@/actions/logs";
import { LogsTable } from "@/components/LogsTable";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function LogsPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const { searchParams } = props;
    const resolved = await searchParams;

    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const filters = {
        search: typeof resolved.search === "string" ? resolved.search : undefined,
        academicYear:
            typeof resolved.academicYear === "string"
                ? resolved.academicYear
                : undefined,
        semester:
            typeof resolved.semester === "string" ? resolved.semester : undefined,
    };

    const logs = await getFailedLogs(filters);

    return (
        <div className="flex-1 m-4 mt-0">
            <div className="bg-white p-4 rounded-md mb-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="mb-8">
                        <h1 className="text-lg font-semibold">Failed Upload Logs</h1>
                        <p className="text-xs text-gray-500 font-semibold">
                            Lists of Failed Upload Logs
                        </p>
                    </div>
                </div>
                <LogsTable initialLogs={logs} />
            </div>
        </div>
    );
}
