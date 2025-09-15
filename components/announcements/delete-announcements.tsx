import { Button } from "@/components/ui/button";
import { TrashIcon } from "lucide-react";
import toast from "react-hot-toast";
import { mutate } from "swr";
import Swal from "sweetalert2";

export default function DeleteAnnouncements({ id }: { id: number }) {
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
      const response = await fetch(`/api/announcements?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Announcement deleted successfully");
        mutate("/api/announcements");
      } else {
        toast.error("Failed to delete announcements");
      }
    }
  };
  return (
    <Button className="bg-red-700 hover:bg-red-900" onClick={handleDelete}>
      <TrashIcon className="mr-2 h-4 w-4" />
      Delete
    </Button>
  );
}
