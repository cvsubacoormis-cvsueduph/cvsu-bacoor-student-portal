"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Pencil,
  Trash2,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Courses, Major, Semester, yearLevels } from "@prisma/client";
import { toast } from "sonner";
import {
  createCurriculumChecklist,
  deleteCurriculumChecklist,
  getCurriculumChecklistForCourse,
  updateCurriculumChecklist,
} from "@/actions/curriculum-actions";

interface CurriculumChecklist {
  id: string;
  course: Courses;
  major: Major;
  yearLevel: yearLevels;
  semester: Semester;
  courseCode: string;
  courseTitle: string;
  creditLec: number;
  creditLab: number;
  preRequisite?: string;
}

const courseOptions: Courses[] = [
  "BSIT",
  "BSCS",
  "BSCRIM",
  "BSP",
  "BSHM",
  "BSBA",
  "BSED",
];
const majorOptions: Major[] = [
  "NONE",
  "ENGLISH",
  "HUMAN_RESOURCE_MANAGEMENT",
  "MATHEMATICS",
  "MARKETING_MANAGEMENT",
];
const yearLevelOptions: yearLevels[] = ["FIRST", "SECOND", "THIRD", "FOURTH"];
const semesterOptions: Semester[] = ["FIRST", "SECOND", "MIDYEAR"];

export function CurriculumDataTable() {
  const [data, setData] = useState<CurriculumChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CurriculumChecklist | null>(
    null
  );

  const [formData, setFormData] = useState<Omit<CurriculumChecklist, "id">>({
    course: "BSIT",
    major: "NONE",
    yearLevel: "FIRST",
    semester: "FIRST",
    courseCode: "",
    courseTitle: "",
    creditLec: 0,
    creditLab: 0,
    preRequisite: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getCurriculumChecklistForCourse();
        setData(
          res.map((item) => ({
            ...item,
            preRequisite: item.preRequisite || undefined,
          }))
        );
      } catch (err) {
        toast.error("Failed to fetch curriculum checklist");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredData = data.filter(
    (item) =>
      item.courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.courseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.course.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.major.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const resetForm = () => {
    setFormData({
      course: "BSIT",
      major: "NONE",
      yearLevel: "FIRST",
      semester: "FIRST",
      courseCode: "",
      courseTitle: "",
      creditLec: 0,
      creditLab: 0,
      preRequisite: "",
    });
  };

  const handleCreate = async () => {
    try {
      const newItem = await createCurriculumChecklist(formData);
      setData([
        ...data,
        { ...newItem, preRequisite: newItem.preRequisite || undefined },
      ]);
      setIsCreateDialogOpen(false);
      resetForm();
      toast("Curriculum item created successfully");
    } catch (err) {
      toast("Failed to create item");
    }
  };

  const handleEdit = (item: CurriculumChecklist) => {
    setEditingItem(item);
    setFormData({
      course: item.course,
      major: item.major,
      yearLevel: item.yearLevel,
      semester: item.semester,
      courseCode: item.courseCode,
      courseTitle: item.courseTitle,
      creditLec: item.creditLec,
      creditLab: item.creditLab,
      preRequisite: item.preRequisite || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingItem) return;
    try {
      const updatedItem = await updateCurriculumChecklist({
        id: editingItem.id,
        ...formData,
        preRequisite: formData.preRequisite || undefined,
      });
      setData(
        data.map((item) =>
          item.id === updatedItem.id
            ? {
                ...updatedItem,
                preRequisite: updatedItem.preRequisite || undefined,
              }
            : item
        )
      );
      setIsEditDialogOpen(false);
      setEditingItem(null);
      resetForm();
      toast("Curriculum item updated successfully");
    } catch (err) {
      toast("Failed to update item");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCurriculumChecklist(id);
      setData(data.filter((item) => item.id !== id));
      toast("Curriculum item deleted successfully");
    } catch (err) {
      toast("Failed to delete item");
    }
  };

  const formatLabel = (value: string) => {
    return value
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="space-y-6 h-screen">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search curriculum..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={resetForm}
              className="bg-blue-700 hover:bg-blue-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Curriculum
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Curriculum Item</DialogTitle>
              <DialogDescription>
                Add a new curriculum checklist item to the database.
              </DialogDescription>
            </DialogHeader>
            <CurriculumForm formData={formData} setFormData={setFormData} />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                className="bg-blue-700 hover:bg-blue-600"
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Programs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(data.map((item) => item.course)).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.reduce(
                (sum, item) => sum + item.creditLec + item.creditLab,
                0
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Majors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(data.map((item) => item.major)).size}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show</span>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={handleItemsPerPageChange}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">entries</span>
        </div>

        <div className="text-sm text-muted-foreground">
          Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)}{" "}
          of {filteredData.length} entries
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course Code</TableHead>
                  <TableHead>Course Title</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Major</TableHead>
                  <TableHead>Year Level</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Pre-requisite</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No curriculum items found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.courseCode}
                      </TableCell>
                      <TableCell>{item.courseTitle}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.course}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {formatLabel(item.major)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatLabel(item.yearLevel)}</TableCell>
                      <TableCell>{formatLabel(item.semester)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>Lec: {item.creditLec}</div>
                          <div>Lab: {item.creditLab}</div>
                        </div>
                      </TableCell>
                      <TableCell>{item.preRequisite || "None"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(item)}
                          >
                            <Pencil className="h-4 w-4 text-blue-700" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-red-700" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Are you sure?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will
                                  permanently delete the curriculum item &ldquo;
                                  {item.courseCode} - {item.courseTitle}&quot;
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(item.id)}
                                  className="bg-red-600 focus:ring-red-600 hover:bg-red-500"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber: number;
                if (totalPages <= 5) {
                  pageNumber = i + 1;
                } else if (currentPage <= 3) {
                  pageNumber = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + i;
                } else {
                  pageNumber = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNumber}
                    variant={currentPage === pageNumber ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNumber)}
                    className="w-10 bg-blue-700 text-white hover:bg-blue-600 hover:text-white"
                  >
                    {pageNumber}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Curriculum Item</DialogTitle>
            <DialogDescription>
              Update the curriculum checklist item details.
            </DialogDescription>
          </DialogHeader>
          <CurriculumForm formData={formData} setFormData={setFormData} />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              className="bg-blue-700 hover:bg-blue-600"
            >
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Form component for create/edit operations
function CurriculumForm({
  formData,
  setFormData,
}: {
  formData: Omit<CurriculumChecklist, "id">;
  setFormData: (data: Omit<CurriculumChecklist, "id">) => void;
}) {
  const formatLabel = (value: string) => {
    return value
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="courseCode">Course Code</Label>
        <Input
          id="courseCode"
          value={formData.courseCode}
          onChange={(e) =>
            setFormData({ ...formData, courseCode: e.target.value })
          }
          placeholder="e.g., IT101"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="courseTitle">Course Title</Label>
        <Input
          id="courseTitle"
          value={formData.courseTitle}
          onChange={(e) =>
            setFormData({ ...formData, courseTitle: e.target.value })
          }
          placeholder="e.g., Introduction to IT"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="course">Program</Label>
        <Select
          value={formData.course}
          onValueChange={(value: Courses) =>
            setFormData({ ...formData, course: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {courseOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="major">Major</Label>
        <Select
          value={formData.major}
          onValueChange={(value: Major) =>
            setFormData({ ...formData, major: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {majorOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {formatLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="yearLevel">Year Level</Label>
        <Select
          value={formData.yearLevel}
          onValueChange={(value: yearLevels) =>
            setFormData({ ...formData, yearLevel: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearLevelOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {formatLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="semester">Semester</Label>
        <Select
          value={formData.semester}
          onValueChange={(value: Semester) =>
            setFormData({ ...formData, semester: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {semesterOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {formatLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="creditLec">Lecture Credits</Label>
        <Input
          id="creditLec"
          type="number"
          min="0"
          value={formData.creditLec}
          onChange={(e) =>
            setFormData({
              ...formData,
              creditLec: Number.parseInt(e.target.value) || 0,
            })
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="creditLab">Laboratory Credits</Label>
        <Input
          id="creditLab"
          type="number"
          min="0"
          value={formData.creditLab}
          onChange={(e) =>
            setFormData({
              ...formData,
              creditLab: Number.parseInt(e.target.value) || 0,
            })
          }
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="preRequisite">Pre-requisite (Optional)</Label>
        <Input
          id="preRequisite"
          value={formData.preRequisite}
          onChange={(e) =>
            setFormData({ ...formData, preRequisite: e.target.value })
          }
          placeholder="e.g., IT101"
        />
      </div>
    </div>
  );
}
