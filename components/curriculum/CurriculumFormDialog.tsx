import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CurriculumFormData } from "./types";
import {
    courseOptions,
    majorOptions,
    yearLevelOptions,
    semesterOptions,
    formatLabel,
} from "./constants";
import { Courses, Major, Semester, yearLevels } from "@prisma/client";

interface CurriculumFormDialogProps {
    mode: "create" | "edit";
    initialData?: CurriculumFormData;
    onSubmit: (data: CurriculumFormData) => Promise<boolean>;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function CurriculumFormDialog({
    mode,
    initialData,
    onSubmit,
    trigger,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
}: CurriculumFormDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState<CurriculumFormData>({
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

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : isOpen;
    const onOpenChange = isControlled ? controlledOnOpenChange : setIsOpen;

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else {
            // Reset form for create mode
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
        }
    }, [initialData, open]);

    const handleSubmit = async () => {
        const success = await onSubmit(formData);
        if (success && onOpenChange) {
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "create" ? "Create New Curriculum Item" : "Edit Curriculum Item"}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === "create"
                            ? "Add a new curriculum checklist item to the database."
                            : "Update the curriculum checklist item details."}
                    </DialogDescription>
                </DialogHeader>

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
                            value={formData.preRequisite || ""}
                            onChange={(e) =>
                                setFormData({ ...formData, preRequisite: e.target.value })
                            }
                            placeholder="e.g., IT101"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange && onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="bg-blue-700 hover:bg-blue-600"
                    >
                        {mode === "create" ? "Create" : "Update"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
