"use client";

import { useParams, useSearchParams } from "next/navigation";
import PreviewGrade from "@/components/PreviewGrade";

export default function StudentGradesPage() {
    const { studentNumber } = useParams<{ studentNumber: string }>();
    const searchParams = useSearchParams();

    const firstName = searchParams.get("firstName") ?? "";
    const lastName = searchParams.get("lastName") ?? "";

    return (
        <PreviewGrade
            studentNumber={studentNumber}
            firstName={firstName}
            lastName={lastName}
        />
    );
}
