import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminsAndUsers } from "@/actions/admin/admin";
import { auth, currentUser } from "@clerk/nextjs/server";
import UpdateAdminDialog from "./forms/update-admin-form";
import UpdateUserDialog from "./forms/update-user-form";
import DeleteEntry from "./admin-lists/delete-entry";
import { redirect } from "next/navigation";
import { AdminListEntry } from "@/lib/types";

const roleBadgeClass: Record<string, string> = {
  admin: "bg-blue-100 text-blue-700",
  superuser: "bg-purple-100 text-purple-700",
  faculty: "bg-green-100 text-green-700",
  registrar: "bg-yellow-100 text-yellow-700",
  csg: "bg-orange-100 text-orange-700",
};

export default async function AdminListsTable() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const clerkUser = await currentUser();
  const callerRole = clerkUser?.publicMetadata?.role as string | undefined;

  let entries: AdminListEntry[] = [];
  let fetchError = false;

  try {
    entries = await getAdminsAndUsers();
  } catch {
    fetchError = true;
  }

  if (fetchError) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-red-500">
          Failed to load data. You may not have permission to view this page.
        </p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-gray-500">No administrators or staff available.</p>
      </div>
    );
  }

  const showActions = callerRole === "admin" || callerRole === "superuser";

  return (
    <Table className="w-full mt-4">
      <TableCaption>All administrators and staff (excluding students).</TableCaption>
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
        {entries.map((entry) => {
          const roleLower = (entry.role as string).toLowerCase();
          const badgeClass =
            roleBadgeClass[roleLower] ?? "bg-gray-100 text-gray-700";

          return (
            <TableRow key={entry.id}>
              <TableCell className="text-left">
                {entry.firstName}{" "}
                {entry.middleInit ? `${entry.middleInit.charAt(0)}. ` : ""}
                {entry.lastName}
              </TableCell>
              <TableCell className="text-center">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}
                >
                  {entry.role.charAt(0).toUpperCase() + entry.role.slice(1)}
                </span>
              </TableCell>
              <TableCell className="text-center">{entry.address}</TableCell>
              <TableCell className="text-center">{entry.phone ?? "—"}</TableCell>
              <TableCell className="text-center">{entry.email ?? "—"}</TableCell>
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
                      currentUserId={userId!}
                    />
                  </div>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
