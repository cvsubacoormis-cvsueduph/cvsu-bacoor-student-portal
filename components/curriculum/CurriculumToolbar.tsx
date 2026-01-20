import { Search, Plus, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CurriculumFormData } from "./types";
import { CurriculumFormDialog } from "./CurriculumFormDialog";
import { useEffect, useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Courses } from "@prisma/client";
import { getCurriculumForExport } from "@/actions/curriculum-actions";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface CurriculumToolbarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    isAdmin: boolean;
    onCreate: (data: CurriculumFormData) => Promise<boolean>;
    courseFilter: string;
    onCourseFilterChange: (value: string) => void;
}

export function CurriculumToolbar({
    searchTerm,
    onSearchChange,
    isAdmin,
    onCreate,
    courseFilter,
    onCourseFilterChange,
}: CurriculumToolbarProps) {
    const [value, setValue] = useState(searchTerm);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        setValue(searchTerm);
    }, [searchTerm]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (value !== searchTerm) {
                onSearchChange(value);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [value, onSearchChange, searchTerm]);

    const handleDownload = async () => {
        try {
            setIsExporting(true);
            const data = await getCurriculumForExport(courseFilter);

            const exportData = data.map((item) => ({
                "Course Code": item.courseCode,
                "Course Title": item.courseTitle,
                "Lec Units": item.creditLec,
                "Lab Units": item.creditLab,
                "Pre-requisite": item.preRequisite || "NONE",
                "Year Level": item.yearLevel,
                Semester: item.semester,
                Course: item.course,
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Curriculum");

            const fileName = `Curriculum_${courseFilter || "ALL"}_${new Date().toISOString().split("T")[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);

            toast.success("Curriculum downloaded successfully");
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Failed to download curriculum");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex flex-1 gap-2 items-center">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                        placeholder="Search curriculum..."
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select
                    value={courseFilter}
                    onValueChange={onCourseFilterChange}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by Course" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Courses</SelectItem>
                        {Object.values(Courses).map((course) => (
                            <SelectItem key={course} value={course}>
                                {course}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleDownload}
                    disabled={isExporting}
                    title="Download Excel"
                >
                    <Download className="h-4 w-4" />
                </Button>
            </div>

            {isAdmin && (
                <CurriculumFormDialog
                    mode="create"
                    onSubmit={onCreate}
                    trigger={
                        <Button className="bg-blue-700 hover:bg-blue-600">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Curriculum
                        </Button>
                    }
                />
            )}
        </div>
    );
}
