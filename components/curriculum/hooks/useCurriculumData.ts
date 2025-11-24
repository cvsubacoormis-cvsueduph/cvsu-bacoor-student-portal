import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    createCurriculumChecklist,
    deleteCurriculumChecklist,
    getCurriculumChecklistForCourse,
    updateCurriculumChecklist,
} from "@/actions/curriculum-actions";
import { CurriculumChecklist, CurriculumFormData } from "../types";

export function useCurriculumData() {
    const [data, setData] = useState<CurriculumChecklist[]>([]);
    const [loading, setLoading] = useState(true);

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

    const createItem = async (formData: CurriculumFormData) => {
        try {
            const newItem = await createCurriculumChecklist(formData);
            setData((prev) => [
                ...prev,
                { ...newItem, preRequisite: newItem.preRequisite || undefined },
            ]);
            toast("Curriculum item created successfully");
            return true;
        } catch (err) {
            toast("Failed to create item");
            return false;
        }
    };

    const updateItem = async (id: string, formData: CurriculumFormData) => {
        try {
            const updatedItem = await updateCurriculumChecklist({
                id,
                ...formData,
                preRequisite: formData.preRequisite || undefined,
            });
            setData((prev) =>
                prev.map((item) =>
                    item.id === updatedItem.id
                        ? {
                            ...updatedItem,
                            preRequisite: updatedItem.preRequisite || undefined,
                        }
                        : item
                )
            );
            toast("Curriculum item updated successfully");
            return true;
        } catch (err) {
            toast("Failed to update item");
            return false;
        }
    };

    const deleteItem = async (id: string) => {
        try {
            await deleteCurriculumChecklist(id);
            setData((prev) => prev.filter((item) => item.id !== id));
            toast("Curriculum item deleted successfully");
            return true;
        } catch (err) {
            toast("Failed to delete item");
            return false;
        }
    };

    return {
        data,
        loading,
        createItem,
        updateItem,
        deleteItem,
    };
}
