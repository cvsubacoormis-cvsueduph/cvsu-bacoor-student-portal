"use client";

import { useUser } from "@clerk/nextjs";
import { createColumns, Grades } from "./columns";
import { DataTable } from "./data-table";

interface GradesListClientProps {
    data: Grades[];
}

export function GradesListClient({ data }: GradesListClientProps) {
    const { user } = useUser();
    const role = user?.publicMetadata?.role as string | undefined;
    const columns = createColumns(role);

    return (
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
            <h1 className="hidden md:block text-lg font-semibold">Grades Lists</h1>
            <span className="text-xs flex text-gray-500 font-semibold">
                List of grades
            </span>
            <div className="container mx-auto">
                <DataTable columns={columns} data={data} />
            </div>
        </div>
    );
}
