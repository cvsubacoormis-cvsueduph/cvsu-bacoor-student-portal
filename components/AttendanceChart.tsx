"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis } from "recharts";
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
import AttendanceChartSkeleton from "./skeleton/AttendanceChartSkeleton";
import { allCourses, courseColors } from "@/lib/utils";

const chartConfig = {
  desktop: {
    label: "Students",
    color: "#1d4ed8",
  },
} satisfies ChartConfig;

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase">
              {data.course}
            </span>
            <span className="font-bold">
              {data.desktop}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface CourseData {
  course: string;
  _count: {
    course: number;
  };
}

export default function AttendanceChart() {
  const [chartData, setChartData] = useState<
    { course: string; desktop: number }[]
  >([]);
  const [popularCourse, setPopularCourse] = useState("N/A");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChartData() {
      try {
        const res = await fetch("/api/courses-total");
        const json: { data: CourseData[] } = await res.json();

        const fetchedMap: { [course: string]: number } = {};
        json.data.forEach((item) => {
          fetchedMap[item.course] = item._count.course;
        });

        const formattedData = allCourses.map((course) => ({
          course,
          desktop: fetchedMap[course] || 0,
        }));

        setChartData(formattedData);

        let maxCount = -1;
        let maxCourse = "N/A";
        formattedData.forEach((item) => {
          if (item.desktop > maxCount) {
            maxCount = item.desktop;
            maxCourse = item.course;
          }
        });
        setPopularCourse(maxCourse);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchChartData();
  }, []);

  return (
    <div className="w-full">
      <Card>
        <CardHeader>
          <CardTitle className="text-md">Courses</CardTitle>
          <CardDescription className="text-start text-xs">
            Total number of students based on courses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <AttendanceChartSkeleton />
          ) : (
            <ChartContainer config={chartConfig}>
              <BarChart
                accessibilityLayer
                data={chartData}
                margin={{ top: 20 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="course"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(0, 6)}
                />
                <ChartTooltip
                  cursor={false}
                  content={<CustomTooltip />}
                />
                <Bar
                  dataKey="desktop"
                  radius={8}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={courseColors[entry.course] || "#1d4ed8"}
                    />
                  ))}
                  <LabelList
                    position="top"
                    offset={12}
                    className="fill-foreground"
                    fontSize={12}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="flex gap-2 font-medium leading-none">
            Most Popular Course:{" "}
            <span className="italic underline">{popularCourse}</span>{" "}
            <TrendingUp className="h-4 w-4 text-blue-700" />{" "}
            {/* Updated to blue-700 */}
          </div>
          <div className="leading-none text-muted-foreground">
            Showing total number of students per course
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
