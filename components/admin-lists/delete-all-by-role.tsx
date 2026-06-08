"use client";

import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import { deleteByRole } from "@/actions/admin/admin";
import { useState } from "react";

interface DeleteAllByRoleProps {
  role: string;
  /** Human-readable role label for the confirmation dialog, e.g. "Faculty" */
  roleLabel: string;
  /** Total count of entries that will be deleted (informational) */
  count: number;
}

export default function DeleteAllByRole({
  role,
  roleLabel,
  count,
}: DeleteAllByRoleProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAll = async () => {
    if (isDeleting) return;

    const confirmed = await Swal.fire({
      title: `Delete ALL ${roleLabel}s?`,
      html: `
        <p class="text-red-600 font-semibold">This action cannot be undone!</p>
        <p>You are about to permanently delete <strong>${count}</strong> ${roleLabel.toLowerCase()} account(s) from the system.</p>
        <p class="text-sm text-gray-500 mt-2">Your own account will be preserved.</p>
      `,
      icon: "error",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: `Yes, delete all ${roleLabel}s`,
      cancelButtonText: "Cancel",
      reverseButtons: true,
    }).then((result) => result.isConfirmed);

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const result = await deleteByRole(role);

      if (result.success) {
        const msg =
          result.deleted === 0
            ? `No ${roleLabel} accounts found to delete.`
            : `Successfully deleted ${result.deleted} ${roleLabel} account(s).`;

        await Swal.fire({
          title: result.deleted === 0 ? "Nothing to delete" : "Deleted!",
          text: msg,
          icon: result.deleted === 0 ? "info" : "success",
          timer: 3000,
        });
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to delete accounts.");
      }
    } catch (err) {
      console.error("[DeleteAllByRole] error:", err);
      toast.error("An unexpected error occurred.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDeleteAll}
      disabled={isDeleting || count === 0}
      className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      title={
        count === 0
          ? `No ${roleLabel} accounts to delete`
          : `Delete all ${count} ${roleLabel} accounts`
      }
    >
      {isDeleting ? "Deleting..." : `Delete All ${roleLabel}s`}
    </button>
  );
}
