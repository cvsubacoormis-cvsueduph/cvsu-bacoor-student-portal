"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, EyeIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import GenerateCOGAdmin from "@/components/GenerateCOGForAdmin";

export type Grades = {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  middleInit: string;
  email: string | null;
  phone: string;
  address: string;
  course: "BSIT" | "BSCS" | "BSBA" | "BSHM" | "BSP" | "BSCRIM" | "BSED";
  status: "REGULAR" | "IRREGULAR" | "TRANSFEREE" | "NOT_ANNOUNCED" | "RETURNEE";
};

function ActionsCell({ student, role }: { student: Grades; role?: string }) {
  const params = new URLSearchParams({
    firstName: student.firstName,
    lastName: student.lastName,
  });
  return (
    <div className="flex items-center space-x-2">
      <Link href={`/list/grades-lists/${student.studentNumber}?${params.toString()}`}>
        <Button variant="outline" className="border-none rounded-full" size="icon">
          <EyeIcon className="w-4 h-4" />
        </Button>
      </Link>
      {role !== "faculty" && <GenerateCOGAdmin studentId={student.id} />}
    </div>
  );
}

// Create columns with role passed as parameter
export function createColumns(role?: string): ColumnDef<Grades>[] {
  const allColumns: ColumnDef<Grades>[] = [
    {
      accessorKey: "studentNumber",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Student Number
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
    },
    {
      accessorKey: "firstName",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            First Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
    },
    {
      accessorKey: "lastName",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Last Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
    },
    {
      accessorKey: "middleInit",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            M.I
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
    },
    {
      accessorKey: "email",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Email
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
    },
    {
      accessorKey: "phone",
      header: "Phone Number",
    },
    {
      accessorKey: "address",
      header: "Address",
    },
    {
      accessorKey: "course",
      header: "Course",
    },
    {
      accessorKey: "status",
      header: "Status",
    },
    {
      accessorKey: "actions",
      header: "Actions",
      id: "actions",
      cell: ({ row }) => <ActionsCell student={row.original} role={role} />,
    },
  ];

  return allColumns;
}

// Default export for backward compatibility
export const columns = createColumns();
