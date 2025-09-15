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
import { Admin } from "@prisma/client";
import useSWR from "swr";
import { useUser } from "@clerk/nextjs";
import DeleteAdmin from "./admin-lists/delete-admin";
import UpdateAdminDialog from "./forms/update-admin-form";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminListsTable() {
  const { user, isLoaded } = useUser();

  // Ensure the user is loaded and fetch the role from public or private metadata
  const role = isLoaded ? user?.publicMetadata?.role : undefined;

  const {
    data: adminListsData,
    error,
    isLoading,
  } = useSWR<Admin[]>("/api/admin-lists", fetcher);

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-4 text-gray-500">Loading...</p>
      </div>
    );

  if (error) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500"></div>
        <p className="ml-4 text-red-500">Failed to load data</p>
      </div>
    );
  }

  const adminLists = adminListsData || [];

  return (
    <div>
      {adminLists.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500">No administrator available.</p>
        </div>
      ) : (
        <Table className="w-full mt-4">
          <TableCaption>A list of your recent administrators.</TableCaption>
          <TableHeader>
            <TableRow className="text-left text-gray-500 text-sm">
              <TableHead className="text-left">Name</TableHead>
              <TableHead className="text-center">Address</TableHead>
              <TableHead className="text-center">Phone</TableHead>
              <TableHead className="text-center">Email</TableHead>
              {role === "superuser" && (
                <TableHead className="text-center">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {adminListsData &&
              adminListsData.map((adminData) => (
                <TableRow key={adminData.id}>
                  <TableCell className="text-left">
                    {adminData.firstName}{" "}
                    {adminData.middleInit?.charAt(0) || ""} {adminData.lastName}
                  </TableCell>
                  <TableCell className="text-center">
                    {adminData.address}
                  </TableCell>
                  <TableCell className="text-center">
                    {adminData.phone}
                  </TableCell>
                  <TableCell className="text-center">
                    {adminData.email}
                  </TableCell>
                  <TableCell className="text-right">
                    {role === "superuser" && (
                      <div className="flex items-center gap-2 justify-center">
                        <UpdateAdminDialog admin={adminData} />
                        <DeleteAdmin id={adminData.id} />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
