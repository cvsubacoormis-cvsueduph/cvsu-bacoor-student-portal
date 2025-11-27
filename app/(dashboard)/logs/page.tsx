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
        <div className="p-4 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Failed Upload Logs</h1>
            </div>
            <LogsTable initialLogs={logs} />
        </div>
    );
}
