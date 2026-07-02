"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Eye, MoreHorizontal, Printer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import GenerateCOGAdmin from "@/components/GenerateCOGForAdmin";
import { useState } from "react";

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
  major: string | null;
  status: "REGULAR" | "IRREGULAR" | "TRANSFEREE" | "NOT_ANNOUNCED" | "RETURNEE";
};

function ActionsCell({ student, role }: { student: Grades; role?: string }) {
  const [cogOpen, setCogOpen] = useState(false);

  const params = new URLSearchParams({
    firstName: student.firstName,
    lastName: student.lastName,
    course: student.course,
    major: student.major ?? "",
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            aria-label="Open actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link
              href={`/list/grades-lists/${student.studentNumber}?${params.toString()}`}
            >
              <Eye className="mr-2 h-4 w-4" />
              View Grades
            </Link>
          </DropdownMenuItem>
          {role !== "faculty" && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setCogOpen(true);
              }}
            >
              <Printer className="mr-2 h-4 w-4" />
              Generate COG
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {role !== "faculty" && (
        <GenerateCOGAdmin
          studentId={student.id}
          open={cogOpen}
          onOpenChange={setCogOpen}
        />
      )}
    </>
  );
}

export function createColumns(role?: string): ColumnDef<Grades>[] {
  return [
    {
      accessorKey: "studentNumber",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Student Number
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    },
    {
      accessorKey: "firstName",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          First Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    },
    {
      accessorKey: "lastName",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Last Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    },
    {
      accessorKey: "middleInit",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          M.I
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Email
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
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
}

export const columns = createColumns();
