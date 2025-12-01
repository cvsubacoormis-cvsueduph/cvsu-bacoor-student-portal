import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CurriculumFormData } from "./types";
import { CurriculumFormDialog } from "./CurriculumFormDialog";
import { useEffect, useState } from "react";

interface CurriculumToolbarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    isAdmin: boolean;
    onCreate: (data: CurriculumFormData) => Promise<boolean>;
}

export function CurriculumToolbar({
    searchTerm,
    onSearchChange,
    isAdmin,
    onCreate,
}: CurriculumToolbarProps) {
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
            <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                    placeholder="Search curriculum..."
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="pl-10"
                />
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
