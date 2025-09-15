"use client";

import { Button } from "./ui/button";
import { TrashIcon } from "lucide-react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";

interface DeleteStudentProps {
  id: string;
  onSuccess?: () => void; // Add this prop
}

export default function DeleteStudent({ id, onSuccess }: DeleteStudentProps) {
  const handleDelete = async () => {
    const confirmed = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });

    if (!confirmed.isConfirmed) return;

    try {
      const response = await fetch(`/api/students?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Student deleted successfully");
        onSuccess?.(); // Call the success callback
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete student");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete student"
      );
    }
  };

  return (
    <Button variant="destructive" onClick={handleDelete}>
      <TrashIcon className="mr-2 h-4 w-4" />
      Delete
    </Button>
  );
}
