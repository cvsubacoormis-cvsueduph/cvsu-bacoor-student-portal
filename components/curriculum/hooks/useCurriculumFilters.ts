import { useState, useMemo } from "react";
import { CurriculumChecklist } from "../types";

export function useCurriculumFilters(data: CurriculumChecklist[]) {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const filteredData = useMemo(() => {
        return data.filter(
            (item) =>
                item.courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.courseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.course.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.major.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data, searchTerm]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        setCurrentPage(1);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number(value));
        setCurrentPage(1);
    };

    return {
        searchTerm,
        currentPage,
        itemsPerPage,
        totalPages,
        startIndex,
        endIndex,
        filteredData,
        paginatedData,
        handleSearchChange,
        handlePageChange,
        handleItemsPerPageChange,
    };
}
