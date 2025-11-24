
import { useState, useEffect, useMemo } from "react";
import { Grade } from "@/lib/types";

export function useStudentPagination(grades: Grade[], initialRowsPerPage = 5) {
  const [pageIndex, setPageIndex] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

  const totalGrades = grades.length;
  const totalPages = Math.max(1, Math.ceil(totalGrades / rowsPerPage));

  useEffect(() => {
    const nextTotalPages = Math.max(1, Math.ceil(totalGrades / rowsPerPage));
    if (pageIndex > nextTotalPages - 1) setPageIndex(nextTotalPages - 1);
  }, [totalGrades, rowsPerPage, pageIndex]);

  const pagedGrades = useMemo(() => {
    const start = pageIndex * rowsPerPage;
    const end = Math.min(start + rowsPerPage, totalGrades);
    return grades.slice(start, end);
  }, [grades, pageIndex, rowsPerPage, totalGrades]);

  const start = pageIndex * rowsPerPage;
  const end = Math.min(start + rowsPerPage, totalGrades);

  return {
    pageIndex,
    setPageIndex,
    rowsPerPage,
    setRowsPerPage,
    totalGrades,
    totalPages,
    pagedGrades,
    start,
    end,
  };
}
