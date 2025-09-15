import { CurriculumDataTable } from "@/components/CurriculumDataTable";
import React from "react";

export default function CurriculumPage() {
  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-semibold">
          Curriculum Checklist{" "}
          <span className=" flex text-xs text-gray-500">
            Lists of curriculums
          </span>
        </h1>
      </div>
      <CurriculumDataTable />
    </div>
  );
}
