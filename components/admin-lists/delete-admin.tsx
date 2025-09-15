"use client";

import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { mutate } from "swr";

export default function DeleteAdmin({ id }: { id: string }) {
  const handleDelete = async () => {
    const confirmed = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => result.isConfirmed);
    if (confirmed) {
      const response = await fetch(`/api/admin-lists?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Student deleted successfully");
        mutate("/api/admin-lists");
      } else {
        toast.error("Failed to delete admin");
      }
    }
  };

  return (
    <div>
      <button
        className="bg-red-500 hover:bg-red-700 text-white px-4 py-2 rounded-md"
        onClick={handleDelete}
      >
        Delete
      </button>
    </div>
  );
}
