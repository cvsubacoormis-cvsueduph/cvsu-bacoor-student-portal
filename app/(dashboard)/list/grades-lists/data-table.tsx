"use client";

import * as React from "react";
import {
  ColumnDef,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Search,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useRef, useState } from "react";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const;

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  totalRecords: number;
  currentPage: number;
  currentPageSize: number;
  totalPages: number;
  initialSearch?: string;
  onPageChange: (page: number, pageSize: number) => void;
  onSearchChange: (search: string) => void;
  isLoading: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  totalRecords,
  currentPage,
  currentPageSize,
  totalPages,
  initialSearch = "",
  onPageChange,
  onSearchChange,
  isLoading,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [searchValue, setSearchValue] = useState(initialSearch);
  const committedSearchRef = useRef(initialSearch);
  const isFirstMount = useRef(true);

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  useEffect(() => {
    setSearchValue(initialSearch);
    committedSearchRef.current = initialSearch;
  }, [initialSearch]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      if (searchValue !== committedSearchRef.current) {
        committedSearchRef.current = searchValue;
        onSearchChange(searchValue);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchValue, onSearchChange]);

  const table = useReactTable({
    data,
    columns,
    pageCount: totalPages || 1,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      pagination: {
        pageIndex: currentPage - 1,
        pageSize: currentPageSize,
      },
    },
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    manualPagination: true,
    manualFiltering: true,
  });

  const from = totalRecords > 0 ? (currentPage - 1) * currentPageSize + 1 : 0;
  const to = Math.min(currentPage * currentPageSize, totalRecords);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            aria-label="Search students"
            className="pl-8 w-full"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="sm:ml-auto shrink-0">
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) =>
                    column.toggleVisibility(!!value)
                  }
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative rounded-md border overflow-x-auto">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-background/50 flex items-center justify-center rounded-md">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-center whitespace-nowrap"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="text-center">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="whitespace-nowrap">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {totalRecords > 0
            ? `Showing ${from}–${to} of ${totalRecords}`
            : "No records"}
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1, currentPageSize)}
            disabled={currentPage <= 1 || isLoading}
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onPageChange(currentPage - 1, currentPageSize)
            }
            disabled={currentPage <= 1 || isLoading}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm whitespace-nowrap px-1">
            Page{" "}
            <strong>
              {totalPages > 0 ? currentPage : 0} of {totalPages}
            </strong>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onPageChange(currentPage + 1, currentPageSize)
            }
            disabled={currentPage >= totalPages || isLoading}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onPageChange(totalPages, currentPageSize)
            }
            disabled={currentPage >= totalPages || isLoading}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
          <Select
            value={String(currentPageSize)}
            onValueChange={(value) => onPageChange(1, Number(value))}
            disabled={isLoading}
          >
            <SelectTrigger
              className="h-8 w-[100px]"
              aria-label="Rows per page"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  Show {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
