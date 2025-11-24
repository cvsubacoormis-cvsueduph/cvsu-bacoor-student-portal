"use client";

import { useUser } from "@clerk/nextjs";
import { CurriculumSkeleton } from "./skeleton/CurriculumSkeleton";
import { useCurriculumData } from "./curriculum/hooks/useCurriculumData";
import { useCurriculumFilters } from "./curriculum/hooks/useCurriculumFilters";
import { CurriculumStats } from "./curriculum/CurriculumStats";
import { CurriculumToolbar } from "./curriculum/CurriculumToolbar";
import { CurriculumTable } from "./curriculum/CurriculumTable";

export function CurriculumDataTable() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role;
  const isAdmin = role === "admin";

  const { data, loading, createItem, updateItem, deleteItem } = useCurriculumData();
  const {
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
  } = useCurriculumFilters(data);

  if (loading) {
    return <CurriculumSkeleton />;
  }

  return (
    <div className="space-y-6 h-screen">
      <CurriculumToolbar
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        isAdmin={isAdmin}
        onCreate={createItem}
      />

      <CurriculumStats data={data} />

      <CurriculumTable
        data={paginatedData}
        totalItems={filteredData.length}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        totalPages={totalPages}
        startIndex={startIndex}
        endIndex={endIndex}
        isAdmin={isAdmin}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handleItemsPerPageChange}
        onUpdate={updateItem}
        onDelete={deleteItem}
      />
    </div>
  );
}
