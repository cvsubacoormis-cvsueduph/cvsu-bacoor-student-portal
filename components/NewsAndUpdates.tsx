"use client";

import { useState, useEffect } from "react";
import { Pencil, Plus, PlusCircle, Trash2 } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "@clerk/nextjs";
import { toast } from "react-hot-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { HashLoader } from "react-spinners";
import { NewsAndUpdatesSkeleton } from "./skeleton/NewsAndUpdatesSkeleton";

export function NewsAndUpdates() {
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [readMoreModalOpen, setReadMoreModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<NewsUpdate | null>(null);
  const [newsItems, setNewsItems] = useState<NewsUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] =
    useState<NewsUpdate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form state for editing announcements
  const [editAnnouncementTitle, setEditAnnouncementTitle] = useState("");
  const [editAnnouncementContent, setEditAnnouncementContent] = useState("");
  const [editAnnouncementCategory, setEditAnnouncementCategory] = useState("");
  const [editAnnouncementImportant, setEditAnnouncementImportant] =
    useState(false);

  const { user } = useUser();
  const role = user?.publicMetadata.role;

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch("/api/news");
        const data = await response.json();

        if (response.ok) {
          setNewsItems(data);
        } else {
          toast.error("Failed to load news");
        }
      } catch (error) {
        toast.error("Error loading news");
        console.log(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNews();
  }, []);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(newsItems.length / itemsPerPage);

  // Form state
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState("");
  const [newAnnouncementContent, setNewAnnouncementContent] = useState("");
  const [newAnnouncementCategory, setNewAnnouncementCategory] =
    useState("Academic");
  const [newAnnouncementImportant, setNewAnnouncementImportant] =
    useState(false);

  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const handleReadMore = (announcement: NewsUpdate) => {
    setSelectedAnnouncement(announcement);
    setReadMoreModalOpen(true);
  };

  // Handle opening the edit modal
  const handleEditClick = (announcement: NewsUpdate) => {
    setSelectedAnnouncement(announcement);
    setEditAnnouncementTitle(announcement.title);
    setEditAnnouncementContent(announcement.description);
    setEditAnnouncementCategory(announcement.category);
    setEditAnnouncementImportant(announcement.important || false);
    setIsEditModalOpen(true);
  };

  // Handle opening the delete confirmation dialog
  const handleDeleteClick = (announcement: NewsUpdate) => {
    setAnnouncementToDelete(announcement);
    setDeleteDialogOpen(true);
  };

  const handlePostAnnouncement = async () => {
    try {
      const response = await fetch("/api/news", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newAnnouncementTitle,
          content: newAnnouncementContent,
          category: newAnnouncementCategory,
          important: newAnnouncementImportant,
          date: currentDate,
          author: user
            ? `${user.firstName?.charAt(0).toUpperCase()}${user.firstName?.slice(1).toLowerCase()} ${user.lastName?.charAt(0).toUpperCase()}${user.lastName?.slice(1).toLowerCase()}`
            : "Admin User",
        }),
      });

      if (response.ok) {
        const newAnnouncement = await response.json();

        if (newAnnouncementImportant) {
          setNewsItems([newAnnouncement, ...newsItems]);
        } else {
          const importantItems = newsItems.filter((item) => item.important);
          const regularItems = newsItems.filter((item) => !item.important);
          setNewsItems([...importantItems, newAnnouncement, ...regularItems]);
        }

        toast.success("News posted successfully");

        setNewAnnouncementTitle("");
        setNewAnnouncementContent("");
        setNewAnnouncementCategory("Academic");
        setNewAnnouncementImportant(false);
        setIsPostModalOpen(false);
        setCurrentPage(1);
      } else {
        toast.error("Failed to post News");
      }
    } catch (error) {
      toast.error("Error posting News");
      console.log(error);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedAnnouncement) return;

    const updatedAnnouncements = newsItems.map((item) => {
      if (item.id === selectedAnnouncement.id) {
        return {
          ...item,
          title: editAnnouncementTitle,
          description: editAnnouncementContent,
          category: editAnnouncementCategory,
          important: editAnnouncementImportant,
          lastEdited: currentDate,
        };
      }
      return item;
    });

    try {
      const response = await fetch(`/api/news/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedAnnouncement.id,
          title: editAnnouncementTitle,
          description: editAnnouncementContent,
          category: editAnnouncementCategory,
          important: editAnnouncementImportant,
          author: user?.firstName + " " + user?.lastName || "Admin User",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update announcement");
      }

      setNewsItems(updatedAnnouncements);
      toast.success("Announcement updated successfully");

      // Reset form state
      setEditAnnouncementTitle("");
      setEditAnnouncementContent("");
      setEditAnnouncementCategory("Academic");
      setEditAnnouncementImportant(false);
      setIsEditModalOpen(false);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error updating announcement:", error);
      toast.error("Failed to update announcement");
    }
  };

  // Handle deleting an announcement
  const handleDeleteAnnouncement = async () => {
    if (!announcementToDelete) return;

    const updatedAnnouncements = newsItems.filter(
      (item) => item.id !== announcementToDelete.id
    );
    setNewsItems(updatedAnnouncements);

    try {
      const response = await fetch(`/api/news/`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: announcementToDelete.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete announcement");
      }

      toast.success("Announcement deleted successfully");
    } catch (error) {
      console.error("Error deleting announcement:", error);
      toast.error("Failed to delete announcement");
    }

    // Adjust current page if needed (e.g., if we deleted the last item on the last page)
    const newTotalPages = Math.ceil(updatedAnnouncements.length / itemsPerPage);
    if (currentPage > newTotalPages && newTotalPages > 0) {
      setCurrentPage(newTotalPages);
    }

    setDeleteDialogOpen(false);
    setAnnouncementToDelete(null);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = newsItems.slice(indexOfFirstItem, indexOfLastItem);

  const importantItems = currentItems.filter((item) => item.important);
  const regularItems = currentItems.filter((item) => !item.important);

  if (isLoading) {
    return <NewsAndUpdatesSkeleton />;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">News & Updates</CardTitle>
            <CardDescription>
              Latest news and updates from university
            </CardDescription>
          </div>
          {role === "admin" && (
            <Button
              className="bg-blue-600 hover:bg-blue-500"
              onClick={() => setIsPostModalOpen(true)}
            >
              <PlusCircle className="h-4 w-4" /> Create News
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {importantItems.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="bg-amber-100 text-amber-700 hover:bg-amber-100"
                      >
                        Important
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-bold">{item.title}</h3>
                  </div>
                  {(role === "admin" || role === "superuser") && (
                    <div className="flex space-x-2">
                      <Button
                        className="bg-blue-600 hover:bg-blue-500"
                        onClick={() => handleEditClick(item)}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        className="bg-red-600 hover:bg-red-500"
                        onClick={() => handleDeleteClick(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-sm">
                  {item.description.length > 200
                    ? `${item.description.substring(0, 200)}...`
                    : item.description}
                </p>
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="text-xs text-muted-foreground break-words">
                    Posted by: {item.author}
                    {item.updatedAt && (
                      <span className="ml-1 block sm:inline">
                        (Edited: {new Date(item.updatedAt).toLocaleDateString()}
                        )
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-500 text-white w-full sm:w-auto"
                    onClick={() => handleReadMore(item)}
                  >
                    Read More
                  </Button>
                </div>
              </div>
            ))}

            {regularItems.map((item, index, filteredItems) => (
              <div key={item.id} className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={getBadgeStyles(item.category)}
                      >
                        {item.category}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="mt-1 text-lg font-medium">{item.title}</h3>
                  </div>
                  {(role === "admin" || role === "superuser") && (
                    <div className="flex space-x-2">
                      <Button
                        className="bg-blue-600 hover:bg-blue-500"
                        onClick={() => handleEditClick(item)}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        className="bg-red-600 hover:bg-red-500"
                        onClick={() => handleDeleteClick(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-sm">
                  {item.description.length > 200
                    ? `${item.description.substring(0, 200)}...`
                    : item.description}
                </p>
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="text-xs text-muted-foreground break-words">
                    Posted by: {item.author}
                    {item.updatedAt && (
                      <span className="ml-1 block sm:inline">
                        (Edited: {new Date(item.updatedAt).toLocaleDateString()}
                        )
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-500 text-white w-full sm:w-auto"
                    onClick={() => handleReadMore(item)}
                  >
                    Read More
                  </Button>
                </div>
                {index !== filteredItems.length - 1 && (
                  <Separator className="mt-4" />
                )}
              </div>
            ))}
            {/* Show message when no announcements */}
            {currentItems.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                No News to display.
              </div>
            )}
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {indexOfFirstItem + 1}-
                {Math.min(indexOfLastItem, newsItems.length)} of{" "}
                {newsItems.length} News
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Previous Page</span>
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Next Page</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isPostModalOpen} onOpenChange={setIsPostModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Post News and Updates</DialogTitle>
            <DialogDescription>
              Create a news and updates to share with students.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newAnnouncementTitle}
                onChange={(e) => setNewAnnouncementTitle(e.target.value)}
                placeholder="Announcement title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={newAnnouncementCategory}
                onValueChange={setNewAnnouncementCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Academic">Academic</SelectItem>
                  <SelectItem value="Events">Events</SelectItem>
                  <SelectItem value="Facilities">Facilities</SelectItem>
                  <SelectItem value="Wellness">Wellness</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={newAnnouncementContent}
                onChange={(e) => setNewAnnouncementContent(e.target.value)}
                placeholder="News content"
                className="min-h-[100px]"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="important"
                checked={newAnnouncementImportant}
                onChange={(e) => setNewAnnouncementImportant(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="important">Mark as important</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="bg-red-600 hover:bg-red-500 text-white"
              onClick={() => setIsPostModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePostAnnouncement}
              className="bg-blue-600 hover:bg-blue-500"
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Announcement Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
            <DialogDescription>
              Update the announcement details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editAnnouncementTitle}
                onChange={(e) => setEditAnnouncementTitle(e.target.value)}
                placeholder="Announcement title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-category">Category</Label>
              <Select
                value={editAnnouncementCategory}
                onValueChange={setEditAnnouncementCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Academic">Academic</SelectItem>
                  <SelectItem value="Events">Events</SelectItem>
                  <SelectItem value="Facilities">Facilities</SelectItem>
                  <SelectItem value="Wellness">Wellness</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                value={editAnnouncementContent}
                onChange={(e) => setEditAnnouncementContent(e.target.value)}
                placeholder="Announcement content"
                className="min-h-[100px]"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-important"
                checked={editAnnouncementImportant}
                onChange={(e) => setEditAnnouncementImportant(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="edit-important">Mark as important</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              className="bg-blue-700 hover:bg-blue-900"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete this announcement?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              announcement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAnnouncement}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={readMoreModalOpen} onOpenChange={setReadMoreModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          {selectedAnnouncement && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      selectedAnnouncement.important
                        ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
                        : getBadgeStyles(selectedAnnouncement.category)
                    }
                  >
                    {selectedAnnouncement.important
                      ? "Important"
                      : selectedAnnouncement.category}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(
                      selectedAnnouncement.createdAt
                    ).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <DialogTitle className="mt-2">
                  {selectedAnnouncement.title}
                </DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm">{selectedAnnouncement.description}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                Posted by: {selectedAnnouncement.author}
              </div>
              <DialogFooter>
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => setReadMoreModalOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface NewsUpdate {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  category: string;
  author: string;
  important?: boolean;
}

function getBadgeStyles(category: string) {
  switch (category) {
    case "Academic":
      return "bg-blue-50 text-blue-700 hover:bg-blue-50";
    case "Events":
      return "bg-purple-50 text-purple-700 hover:bg-purple-50";
    case "Facilities":
      return "bg-green-50 text-green-700 hover:bg-green-50";
    case "Wellness":
      return "bg-rose-50 text-rose-700 hover:bg-rose-50";
    default:
      return "bg-gray-50 text-gray-700 hover:bg-gray-50";
  }
}
