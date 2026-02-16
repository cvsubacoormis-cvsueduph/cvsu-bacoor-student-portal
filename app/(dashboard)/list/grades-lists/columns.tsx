"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PreviewGrades } from "@/components/PreviewGrades";
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

// Helper component to get user role once
function ActionsCell({ student, role }: { student: Grades; role?: string }) {
  return (
    <div className="flex items-center space-x-2">
      {<PreviewGrades
        studentNumber={String(student.studentNumber)}
        firstName={student.firstName}
        lastName={student.lastName}
        role={role}
      />}
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
