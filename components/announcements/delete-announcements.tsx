import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TrashIcon } from "lucide-react";
import { toast } from "sonner";
import { mutate } from "swr";

export default function DeleteAnnouncements({ id }: { id: number }) {
  const handleDelete = async () => {
    const response = await fetch(`/api/announcements?id=${id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      toast.success("Announcement deleted successfully");
      mutate(
        (key) => typeof key === "string" && key.startsWith("/api/announcements"),
        undefined,
        { revalidate: true }
      );
    } else {
      toast.error("Failed to delete announcements");
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className="bg-red-700 hover:bg-red-900">
          <TrashIcon className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            announcement from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-red-700 hover:bg-red-900"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
