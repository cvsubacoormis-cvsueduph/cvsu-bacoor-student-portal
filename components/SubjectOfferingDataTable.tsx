"use client";

import { useUser } from "@clerk/nextjs";
import { SubjectOfferingToolbar } from "./subject-offering/SubjectOfferingToolbar";
import { SubjectOfferingTable } from "./subject-offering/SubjectOfferingTable";
import { useRouter, useSearchParams } from "next/navigation";
import { SubjectOffering, CurriculumChecklist } from "@prisma/client";

type SubjectOfferingWithCurriculum = SubjectOffering & {
    curriculum: CurriculumChecklist;
};

interface SubjectOfferingDataTableProps {
    data: SubjectOfferingWithCurriculum[];
    count: number;
    page: number;
    limit: number;
}

export function SubjectOfferingDataTable({
    data,
    count,
    page,
    limit,
}: SubjectOfferingDataTableProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const search = searchParams.get("search") || "";
    const academicYearFilter = searchParams.get("academicYear") || "";
    const semesterFilter = searchParams.get("semester") || "";

    const totalPages = Math.ceil(count / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, count);

    const handleSearchChange = (value: string) => {
        const params = new URLSearchParams(window.location.search);
        if (value) {
            params.set("search", value);
        } else {
            params.delete("search");
        }
        params.set("page", "1");
        router.push(`?${params.toString()}`);
    };

    const handleAcademicYearFilterChange = (value: string) => {
        const params = new URLSearchParams(window.location.search);
        if (value && value !== "ALL") {
            params.set("academicYear", value);
        } else {
            params.delete("academicYear");
        }
        params.set("page", "1");
        router.push(`?${params.toString()}`);
    };

    const handleSemesterFilterChange = (value: string) => {
        const params = new URLSearchParams(window.location.search);
        if (value && value !== "ALL") {
            params.set("semester", value);
        } else {
            params.delete("semester");
        }
        params.set("page", "1");
        router.push(`?${params.toString()}`);
    };

    const handlePageChange = (page: number) => {
        const params = new URLSearchParams(window.location.search);
        params.set("page", page.toString());
        router.push(`?${params.toString()}`);
    };

    const handleItemsPerPageChange = (value: string) => {
        const params = new URLSearchParams(window.location.search);
        params.set("limit", value);
        params.set("page", "1");
        router.push(`?${params.toString()}`);
    };

    return (
        <div className="space-y-4 h-screen">
            <h1 className="text-lg font-semibold">Subject Offerings <br /> <span className="text-gray-500 text-xs">List of all subject offered</span></h1>
            <SubjectOfferingToolbar
                searchTerm={search}
                onSearchChange={handleSearchChange}
                academicYearFilter={academicYearFilter}
                onAcademicYearFilterChange={handleAcademicYearFilterChange}
                semesterFilter={semesterFilter}
                onSemesterFilterChange={handleSemesterFilterChange}
            />

            <SubjectOfferingTable
                data={data}
                totalItems={count}
                currentPage={page}
                itemsPerPage={limit}
                totalPages={totalPages}
                startIndex={startIndex}
                endIndex={endIndex}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
            />
        </div>
    );
}
