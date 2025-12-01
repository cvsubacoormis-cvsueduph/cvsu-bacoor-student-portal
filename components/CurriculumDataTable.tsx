"use client";

import { useUser } from "@clerk/nextjs";
import { CurriculumStats } from "./curriculum/CurriculumStats";
import { CurriculumToolbar } from "./curriculum/CurriculumToolbar";
import { CurriculumTable } from "./curriculum/CurriculumTable";
import { CurriculumChecklist, CurriculumFormData } from "./curriculum/types";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  createCurriculumChecklist,
  deleteCurriculumChecklist,
  updateCurriculumChecklist,
} from "@/actions/curriculum-actions";

interface CurriculumDataTableProps {
  data: CurriculumChecklist[];
  count: number;
  page: number;
  limit: number;
}

export function CurriculumDataTable({
  data,
  count,
  page,
  limit,
}: CurriculumDataTableProps) {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = user?.publicMetadata?.role;
  const isAdmin = role === "admin";

  const search = searchParams.get("search") || "";

  const totalPages = Math.ceil(count / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, count);

  const createItem = async (formData: CurriculumFormData) => {
    try {
      await createCurriculumChecklist(formData);
      toast("Curriculum item created successfully");
      router.refresh();
      return true;
    } catch (err) {
      toast("Failed to create item");
      return false;
    }
  };

  const updateItem = async (id: string, formData: CurriculumFormData) => {
    try {
      await updateCurriculumChecklist({
        id,
        ...formData,
        preRequisite: formData.preRequisite || undefined,
      });
      toast("Curriculum item updated successfully");
      router.refresh();
      return true;
    } catch (err) {
      toast("Failed to update item");
      return false;
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await deleteCurriculumChecklist(id);
      toast("Curriculum item deleted successfully");
      router.refresh();
      return true;
    } catch (err) {
      toast("Failed to delete item");
      return false;
    }
  };

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

  return (
    <div className="space-y-6 h-screen">
      <CurriculumToolbar
        searchTerm={search}
        onSearchChange={handleSearchChange}
        isAdmin={isAdmin}
        onCreate={createItem}
      />

      <CurriculumStats data={data} />

      <CurriculumTable
        data={data}
        totalItems={count}
        currentPage={page}
        itemsPerPage={limit}
        totalPages={totalPages}
        startIndex={startIndex}
        endIndex={endIndex}
        isAdmin={isAdmin}
        onUpdate={updateItem}
        onDelete={deleteItem}
      />
    </div>
  );
}
