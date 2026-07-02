"use client";

import { Suspense, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  useGradeApprovals,
  type PendingChange,
} from "@/components/grades/hooks/useGradeApprovals";
import { GradeApprovalCard } from "@/components/grades/GradeApprovalCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Loader2,
  CheckCircle,
  RefreshCw,
  Search,
  CheckCheck,
} from "lucide-react";

const ALLOWED_ROLES = ["admin", "superuser", "registrar"];

/**
 * Build a compact page-number list with ellipsis for large page counts.
 * Example: [1, "ellipsis", 4, 5, 6, "ellipsis", 20]
 */
function getPageNumbers(
  currentPage: number,
  totalPages: number,
): (number | "ellipsis")[] {
  const pages: (number | "ellipsis")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("ellipsis");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
  }
  return pages;
}

function GradeApprovalsContent() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // ── Read pagination from URL (source of truth) ──
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.max(
    1,
    parseInt(searchParams.get("pageSize") || "10", 10),
  );

  const {
    pendingChanges,
    loading,
    error,
    processingIds,
    processingAll,
    searchQuery,
    setSearchQuery,
    expandedStudents,
    groupedChanges,
    filteredStudentNumbers,
    fetchPending,
    handleApprove,
    handleBulkApprove,
    handleApproveAll,
    handleReject,
    toggleStudent,
    total,
    totalPages,
  } = useGradeApprovals({ page, pageSize });

  // ── URL sync helpers ──
  const updateURL = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage < 1 || newPage > totalPages) return;
      updateURL({ page: String(newPage) });
    },
    [totalPages, updateURL],
  );

  const handlePageSizeChange = useCallback(
    (newPageSize: number) => {
      updateURL({ pageSize: String(newPageSize), page: "1" });
    },
    [updateURL],
  );

  // ── Access denied ──
  if (role && !ALLOWED_ROLES.includes(role)) {
    return (
      <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-red-600">Access Denied</h2>
          <p className="text-gray-600 mt-2">
            Only registrars and admins can review grade changes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">Grade Change Approvals</h1>
          <span className="text-xs text-gray-500 font-semibold">
            Review and approve/reject grade changes submitted by faculty and
            registrar staff
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!loading && total > 0 && (
            <Button
              size="sm"
              onClick={handleApproveAll}
              disabled={processingAll || loading}
              className="bg-green-600 hover:bg-green-700 flex items-center gap-1.5"
            >
              {processingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5" />
              )}
              <span>Approve All</span>
              <Badge
                variant="secondary"
                className="ml-0.5 bg-white/20 text-white text-[10px] px-1.5 py-0"
              >
                {total}
              </Badge>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPending}
            disabled={loading || processingAll}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Search ── */}
      {!loading && pendingChanges.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search within this page..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && pendingChanges.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto text-green-300 mb-3" />
            <p className="text-lg font-medium">No pending changes</p>
            <p className="text-sm">All grade submissions have been reviewed.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Grade approval cards ── */}
      {!loading && pendingChanges.length > 0 && (
        <div className="space-y-4">
          {filteredStudentNumbers.length === 0 && searchQuery && (
            <p className="text-center text-gray-500 py-8">
              No students match &ldquo;{searchQuery}&rdquo;
            </p>
          )}

          {filteredStudentNumbers.map((studentNumber) => (
            <GradeApprovalCard
              key={studentNumber}
              studentNumber={studentNumber}
              changes={groupedChanges[studentNumber]}
              isExpanded={expandedStudents.has(studentNumber)}
              processingIds={processingIds}
              onToggle={toggleStudent}
              onBulkApprove={handleBulkApprove}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>
              Page {page} of {totalPages}
            </span>
            <span className="text-gray-300">|</span>
            <span>{total} total pending</span>
            <select
              className="ml-2 border border-gray-200 rounded px-2 py-1 text-xs bg-white"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={30}>30 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>

          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => handlePageChange(page - 1)}
                  className={
                    page <= 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>

              {getPageNumbers(page, totalPages).map((pageNum, idx) =>
                pageNum === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      isActive={pageNum === page}
                      onClick={() => handlePageChange(pageNum)}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}

              <PaginationItem>
                <PaginationNext
                  onClick={() => handlePageChange(page + 1)}
                  className={
                    page >= totalPages
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

export default function GradeApprovalsPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0 flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <GradeApprovalsContent />
    </Suspense>
  );
}
