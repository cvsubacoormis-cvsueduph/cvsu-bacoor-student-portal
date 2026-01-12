"use client";

import { useUser } from "@clerk/nextjs";
import { createColumns, Grades } from "./columns";
import { DataTable } from "./data-table";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

interface GradesListClientProps {
    data: Grades[];
    total: number;
    page: number;
    pageSize: number;
}

export function GradesListClient({ data, total, page, pageSize }: GradesListClientProps) {
    const { user } = useUser();
    const role = user?.publicMetadata?.role as string | undefined;
    const columns = createColumns(role);

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const updateURL = useCallback((updates: { page?: number; pageSize?: number; search?: string }) => {
        const params = new URLSearchParams(searchParams.toString());

        if (updates.page !== undefined) {
            params.set('page', String(updates.page));
        }
        if (updates.pageSize !== undefined) {
            params.set('pageSize', String(updates.pageSize));
        }
        if (updates.search !== undefined) {
            if (updates.search) {
                params.set('search', updates.search);
                params.set('page', '1'); // Reset to page 1 on search
            } else {
                params.delete('search');
            }
        }

        startTransition(() => {
            router.push(`${pathname}?${params.toString()}`);
        });
    }, [pathname, router, searchParams]);

    const handlePageChange = useCallback((newPage: number, newPageSize: number) => {
        updateURL({ page: newPage, pageSize: newPageSize });
    }, [updateURL]);

    const handleSearchChange = useCallback((search: string) => {
        updateURL({ search });
    }, [updateURL]);

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
            <h1 className="hidden md:block text-lg font-semibold">Grades Lists</h1>
            <span className="text-xs flex text-gray-500 font-semibold">
                List of grades
            </span>
            <div className="container mx-auto">
                <DataTable
                    columns={columns}
                    data={data}
                    totalRecords={total}
                    currentPage={page}
                    currentPageSize={pageSize}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    onSearchChange={handleSearchChange}
                    isLoading={isPending}
                />
            </div>
        </div>
    );
}
