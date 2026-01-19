"use client";

import * as React from "react";
import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { Label, Legend, Pie, PieChart } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import CountChartSkeleton from "./skeleton/CountChartSkeleton";

const chartConfig = {
  male: {
    label: "Male",
    color: "#1d4ed8",
  },
  female: {
    label: "Female",
    color: "#f472b6",
  },
} satisfies ChartConfig;

export default function AdminPage() {
  const [chartData, setChartData] = React.useState<
    { sex: string; count: number; fill: string }[]
  >([]);
  const [totalVisitors, setTotalVisitors] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/total-students-male-female");
        if (!response.ok) throw new Error("Failed to fetch data");

        const data = await response.json();
        setChartData([
          { sex: "MALE", count: data.maleCount, fill: "#1d4ed8" },
          { sex: "FEMALE", count: data.femaleCount, fill: "#f472b6" },
        ]);
        setTotalVisitors(data.total);
      } catch (error) {
        console.error("Error fetching student data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const mostStudents = useMemo(() => {
    if (chartData.length === 0) return "NONE";
    if (chartData[0].count === chartData[1].count) return "EQUAL";
    return chartData[0].count > chartData[1].count ? "MALE" : "FEMALE";
  }, [chartData]);

  if (loading) return <CountChartSkeleton />;

  return (
    <div className="w-full">
      <Card className="flex flex-col">
        <CardHeader className="pb-0">
          <CardTitle className="text-md font-semibold">
            Total number of students
          </CardTitle>
          <CardDescription className="text-start text-xs">
            Total number of students by gender
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0 mt-28">
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[600px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="sex"
                innerRadius={60}
                strokeWidth={5}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-3xl font-bold"
                          >
                            {totalVisitors.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-muted-foreground"
                          >
                            Students
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ marginTop: 8, marginBottom: 8 }}
              />
            </PieChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col gap-2 text-sm">
          <div className="flex items-start gap-2 font-medium leading-none">
            Most number of the students is{" "}
            <span className="underline italic">{mostStudents}</span>{" "}
            <TrendingUp className="h-4 w-4 text-blue-700" />
          </div>
          <div className="leading-none text-muted-foreground">
            Showing total students in the database
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
