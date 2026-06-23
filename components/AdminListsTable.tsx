"use client";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { getAdminsAndUsers } from "@/actions/admin/admin";
import UpdateAdminDialog from "./forms/update-admin-form";
import UpdateUserDialog from "./forms/update-user-form";
import DeleteEntry from "./admin-lists/delete-entry";
import DeleteAllByRole from "./admin-lists/delete-all-by-role";
import type { AdminListEntry } from "@/lib/types";
import { useEffect, useState, useCallback } from "react";

const ROLE_OPTIONS = [
  { value: "ALL", label: "All Roles" },
  { value: "admin", label: "Admin" },
  { value: "superuser", label: "Superuser" },
  { value: "faculty", label: "Faculty" },
  { value: "registrar", label: "Registrar" },
  { value: "registrar_staff", label: "Registrar Staff" },
  { value: "csg", label: "CSG" },
] as const;

const roleBadgeClass: Record<string, string> = {
  admin: "bg-blue-100 text-blue-700",
  superuser: "bg-purple-100 text-purple-700",
  faculty: "bg-green-100 text-green-700",
  registrar: "bg-yellow-100 text-yellow-700",
  registrar_staff: "bg-amber-100 text-amber-700",
  csg: "bg-orange-100 text-orange-700",
};

function roleToLabel(role: string): string {
  const found = ROLE_OPTIONS.find((r) => r.value === role);
  return found?.label ?? role.charAt(0).toUpperCase() + role.slice(1);
}

export default function AdminListsTable() {
  const { user } = useUser();
  const callerRole = user?.publicMetadata?.role as string | undefined;

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<AdminListEntry[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const limit = 10;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(false);
    try {
      const result = await getAdminsAndUsers({
        search: searchQuery || undefined,
        role: roleFilter !== "ALL" ? roleFilter : undefined,
        page,
        limit,
      });

      setEntries(result.entries);
      setTotalPages(result.totalPages);
      setTotalCount(result.total);
    } catch {
      setFetchError(true);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, roleFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, roleFilter]);

  const showActions = callerRole === "admin" || callerRole === "superuser";
  const isRoleFilterActive = roleFilter !== "ALL";

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  if (fetchError) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-red-500">
          Failed to load data. You may not have permission to view this page.
        </p>
      </div>
    );
  }

  // Build pagination page numbers
  const getPageNumbers = (): (number | "ellipsis")[] => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("ellipsis");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div>
      {/* ── Search, Filter & Bulk Delete Controls ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mt-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-[250px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name or email..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Role Filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Result count */}
          {!isLoading && (
            <span className="text-sm text-gray-500 whitespace-nowrap">
              {totalCount} result{totalCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Delete All by Role — only when role filter is active */}
        {showActions && isRoleFilterActive && (
          <DeleteAllByRole
            role={roleFilter}
            roleLabel={roleToLabel(roleFilter)}
            count={totalCount}
          />
        )}
      </div>

      {/* ── Table ── */}
      <Table className="w-full mt-4">
        <TableCaption>
          All administrators and staff (excluding students).
        </TableCaption>
        <TableHeader>
          <TableRow className="text-left text-gray-500 text-sm">
            <TableHead className="text-left">Name</TableHead>
            <TableHead className="text-center">Role</TableHead>
            <TableHead className="text-center">Address</TableHead>
            <TableHead className="text-center">Phone</TableHead>
            <TableHead className="text-center">Email</TableHead>
            {showActions && (
              <TableHead className="text-center">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            /* Skeleton loading rows */
            Array.from({ length: limit }).map((_, i) => (
              <TableRow key={`skel-${i}`}>
                <TableCell>
                  <Skeleton className="h-4 w-[180px]" />
                </TableCell>
                <TableCell className="text-center">
                  <Skeleton className="h-4 w-[80px] mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Skeleton className="h-4 w-[120px] mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Skeleton className="h-4 w-[100px] mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Skeleton className="h-4 w-[150px] mx-auto" />
                </TableCell>
                {showActions && (
                  <TableCell className="text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <Skeleton className="h-8 w-14" />
                      <Skeleton className="h-8 w-14" />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          ) : entries.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={showActions ? 6 : 5}
                className="text-center py-12 text-gray-500"
              >
                {searchQuery || isRoleFilterActive
                  ? "No results match your filters."
                  : "No administrators or staff available."}
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => {
              const roleLower = (entry.role as string).toLowerCase();
              const badgeClass =
                roleBadgeClass[roleLower] ?? "bg-gray-100 text-gray-700";

              return (
                <TableRow key={entry.id}>
                  <TableCell className="text-left">
                    {entry.firstName}{" "}
                    {entry.middleInit
                      ? `${entry.middleInit.charAt(0)}. `
                      : ""}
                    {entry.lastName}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}
                    >
                      {entry.role.charAt(0).toUpperCase() +
                        entry.role.slice(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {entry.address}
                  </TableCell>
                  <TableCell className="text-center">
                    {entry.phone ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {entry.email ?? "—"}
                  </TableCell>
                  {showActions && (
                    <TableCell className="text-center">
                      <div className="flex items-center gap-2 justify-center">
                        {entry.source === "admin" ? (
                          <UpdateAdminDialog admin={entry as any} />
                        ) : (
                          <UpdateUserDialog user={entry} />
                        )}
                        <DeleteEntry
                          id={entry.id}
                          source={entry.source}
                          currentUserId={user?.id ?? ""}
                        />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* ── Pagination ── */}
      {!isLoading && totalPages > 1 && (
        <Pagination className="mt-4 cursor-pointer">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => handlePageChange(page - 1)}
                className={
                  page <= 1 ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>

            {getPageNumbers().map((pageNum, idx) =>
              pageNum === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={pageNum}>
                  <PaginationLink
                    isActive={pageNum === page}
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <PaginationNext
                onClick={() => handlePageChange(page + 1)}
                className={
                  page >= totalPages
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
