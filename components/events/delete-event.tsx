import { Button } from "@/components/ui/button";
import { TrashIcon } from "lucide-react";
import toast from "react-hot-toast";
import { mutate } from "swr";
import Swal from "sweetalert2";

export default function DeleteEvent({ id }: { id: number }) {
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
      const response = await fetch(`/api/events?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Event deleted successfully");
        mutate("/api/events");
      } else {
        toast.error("Failed to delete event");
      }
    }
  };
  return (
    <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-500">
      <TrashIcon className="mr-2 h-4 w-4" />
      Delete
    </Button>
  );
}
