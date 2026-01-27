import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { AcademicYear, Semester } from "@prisma/client";

interface SubjectOfferingToolbarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    academicYearFilter: string;
    onAcademicYearFilterChange: (value: string) => void;
    semesterFilter: string;
    onSemesterFilterChange: (value: string) => void;
}

export function SubjectOfferingToolbar({
    searchTerm,
    onSearchChange,
    academicYearFilter,
    onAcademicYearFilterChange,
    semesterFilter,
    onSemesterFilterChange,
}: SubjectOfferingToolbarProps) {
    const [value, setValue] = useState(searchTerm);

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

    return (
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex flex-1 gap-2 items-center flex-wrap">
                <div className="relative flex-1 max-w-sm min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                        placeholder="Search subject..."
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select
                    value={academicYearFilter}
                    onValueChange={onAcademicYearFilterChange}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Academic Year" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Academic Years</SelectItem>
                        {Object.values(AcademicYear).map((ay) => (
                            <SelectItem key={ay} value={ay}>
                                {ay.replace(/_/g, " ")}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={semesterFilter} onValueChange={onSemesterFilterChange}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Semester" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Semesters</SelectItem>
                        {Object.values(Semester).map((sem) => (
                            <SelectItem key={sem} value={sem}>
                                {sem}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
