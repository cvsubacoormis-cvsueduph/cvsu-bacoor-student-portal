"use client";

import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import { deleteAdminOrUser } from "@/actions/admin/admin";
import { AdminListEntry } from "@/lib/types";

interface DeleteEntryProps {
  id: string;
  source: AdminListEntry["source"];
  /** The Clerk ID of the currently signed-in user — passed from the server component */
  currentUserId: string;
}

export default function DeleteEntry({ id, source, currentUserId }: DeleteEntryProps) {
  const router = useRouter();

  const isSelf = id === currentUserId;

  const handleDelete = async () => {
    if (isSelf) {
      toast.error("You cannot delete your own account.");
      return;
    }

    const confirmed = await Swal.fire({
      title: "Are you sure?",
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => result.isConfirmed);

    if (!confirmed) return;

    const result = await deleteAdminOrUser(id, source);

    if (result.success) {
      toast.success("Deleted successfully");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to delete");
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isSelf}
      title={isSelf ? "You cannot delete your own account" : "Delete"}
      className={`px-4 py-2 rounded-md text-white text-sm transition-colors ${isSelf
        ? "bg-gray-300 cursor-not-allowed opacity-50"
        : "bg-red-500 hover:bg-red-700 cursor-pointer"
        }`}
    >
      Delete
    </button>
  );
}
