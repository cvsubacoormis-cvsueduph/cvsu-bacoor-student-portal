import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurriculumChecklist } from "./types";

interface CurriculumStatsProps {
    data: CurriculumChecklist[];
}

export function CurriculumStats({ data }: CurriculumStatsProps) {
    return (
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
    );
}
