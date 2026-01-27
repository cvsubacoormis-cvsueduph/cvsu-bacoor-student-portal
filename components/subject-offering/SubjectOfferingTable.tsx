import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { SubjectOffering, CurriculumChecklist } from "@prisma/client";

type SubjectOfferingWithCurriculum = SubjectOffering & {
    curriculum: CurriculumChecklist;
};

interface SubjectOfferingTableProps {
    data: SubjectOfferingWithCurriculum[];
    totalItems: number;
    currentPage: number;
    itemsPerPage: number;
    totalPages: number;
    startIndex: number;
    endIndex: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (value: string) => void;
}

export function SubjectOfferingTable({
    data,
    totalItems,
    currentPage,
    itemsPerPage,
    totalPages,
    startIndex,
    endIndex,
    onPageChange,
    onItemsPerPageChange,
}: SubjectOfferingTableProps) {
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
                    Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of{" "}
                    {totalItems} entries
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
                                    <TableHead>Academic Year</TableHead>
                                    <TableHead>Semester</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={5}
                                            className="text-center py-8 text-muted-foreground"
                                        >
                                            No subject offerings found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">
                                                {item.curriculum.courseCode}
                                            </TableCell>
                                            <TableCell>{item.curriculum.courseTitle}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {item.academicYear.replace(/_/g, " ")}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{item.semester}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {item.isActive ? (
                                                    <div className="flex items-center text-green-600">
                                                        <CheckCircle className="w-4 h-4 mr-1" />
                                                        Active
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center text-red-600">
                                                        <XCircle className="w-4 h-4 mr-1" />
                                                        Inactive
                                                    </div>
                                                )}
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
        </div>
    );
}
