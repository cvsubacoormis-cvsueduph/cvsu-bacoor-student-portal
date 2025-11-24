import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { CurriculumChecklist, CurriculumFormData } from "./types";
import { formatLabel } from "./constants";
import { CurriculumFormDialog } from "./CurriculumFormDialog";
import { useState } from "react";

interface CurriculumTableProps {
    data: CurriculumChecklist[];
    totalItems: number;
    currentPage: number;
    itemsPerPage: number;
    totalPages: number;
    startIndex: number;
    endIndex: number;
    isAdmin: boolean;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (value: string) => void;
    onUpdate: (id: string, data: CurriculumFormData) => Promise<boolean>;
    onDelete: (id: string) => Promise<boolean>;
}

export function CurriculumTable({
    data,
    totalItems,
    currentPage,
    itemsPerPage,
    totalPages,
    startIndex,
    endIndex,
    isAdmin,
    onPageChange,
    onItemsPerPageChange,
    onUpdate,
    onDelete,
}: CurriculumTableProps) {
    const [editingItem, setEditingItem] = useState<CurriculumChecklist | null>(null);

    const handleEditClick = (item: CurriculumChecklist) => {
        setEditingItem(item);
    };

    const handleEditSubmit = async (formData: CurriculumFormData) => {
        if (editingItem) {
            const success = await onUpdate(editingItem.id, formData);
            if (success) {
                setEditingItem(null);
            }
            return success;
        }
        return false;
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Show</span>
                    <Select
                        value={itemsPerPage.toString()}
                        onValueChange={onItemsPerPageChange}
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
                    Showing {startIndex + 1} to {Math.min(endIndex, totalItems)}{" "}
                    of {totalItems} entries
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
                                    {isAdmin && (
                                        <TableHead className="text-right">Actions</TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={9}
                                            className="text-center py-8 text-muted-foreground"
                                        >
                                            No curriculum items found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data.map((item) => (
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
                                            {isAdmin && (
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEditClick(item)}
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
                                                                        permanently delete the curriculum item
                                                                        &ldquo;
                                                                        {item.courseCode} - {item.courseTitle}&quot;
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => onDelete(item.id)}
                                                                        className="bg-red-600 focus:ring-red-600 hover:bg-red-500"
                                                                    >
                                                                        Delete
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            )}
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
                            onClick={() => onPageChange(currentPage - 1)}
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
                                        onClick={() => onPageChange(pageNumber)}
                                        className={
                                            currentPage === pageNumber
                                                ? "w-10 bg-blue-700 text-white hover:bg-blue-600 hover:text-white"
                                                : "w-10"
                                        }
                                    >
                                        {pageNumber}
                                    </Button>
                                );
                            })}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Edit Dialog */}
            <CurriculumFormDialog
                mode="edit"
                initialData={editingItem || undefined}
                open={!!editingItem}
                onOpenChange={(open) => !open && setEditingItem(null)}
                onSubmit={handleEditSubmit}
            />
        </div>
    );
}
