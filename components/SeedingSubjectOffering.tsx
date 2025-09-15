"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Play, CheckCircle, XCircle, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { seedSubjectOffering } from "@/actions/subject-offering/seedSubjectOffering";
import { AcademicYear } from "@prisma/client";

type AcademicYears =
  | "AY_2024_2025"
  | "AY_2025_2026"
  | "AY_2026_2027"
  | "AY_2027_2028"
  | "AY_2028_2029"
  | "AY_2029_2030"
  | "AY_2030_2031"
  | "AY_2031_2032"
  | "AY_2032_2033"
  | "AY_2033_2034"
  | "AY_2034_2035"
  | "AY_2035_2036"
  | "AY_2036_2037"
  | "AY_2037_2038"
  | "AY_2038_2039"
  | "AY_2039_2040";
type Semester = "FIRST" | "SECOND" | "MIDYEAR";
type Courses = "BSIT" | "BSCS" | "BSCRIM" | "BSP" | "BSHM" | "BSED" | "BSBA";
type Major =
  | "NONE"
  | "ENGLISH"
  | "MATHEMATICS"
  | "MARKETING_MANAGEMENT"
  | "HUMAN_RESOURCE_MANAGEMENT";

interface CourseMajorConfig {
  course: Courses;
  majors: Major[];
  enabled: boolean;
}

interface SeedLog {
  id: string;
  type: "success" | "info" | "warning" | "error";
  message: string;
  timestamp: Date;
}

const initialCourseMajorConfig: CourseMajorConfig[] = [
  { course: "BSIT", majors: ["NONE"], enabled: true },
  { course: "BSCS", majors: ["NONE"], enabled: true },
  { course: "BSCRIM", majors: ["NONE"], enabled: true },
  { course: "BSP", majors: ["NONE"], enabled: true },
  { course: "BSHM", majors: ["NONE"], enabled: true },
  { course: "BSED", majors: ["ENGLISH", "MATHEMATICS"], enabled: true },
  {
    course: "BSBA",
    majors: ["MARKETING_MANAGEMENT", "HUMAN_RESOURCE_MANAGEMENT"],
    enabled: true,
  },
];

const academicYears: AcademicYears[] = [
  "AY_2024_2025",
  "AY_2025_2026",
  "AY_2026_2027",
  "AY_2027_2028",
  "AY_2028_2029",
  "AY_2029_2030",
  "AY_2030_2031",
  "AY_2031_2032",
  "AY_2032_2033",
  "AY_2033_2034",
  "AY_2034_2035",
  "AY_2035_2036",
  "AY_2036_2037",
  "AY_2037_2038",
  "AY_2038_2039",
  "AY_2039_2040",
];

const availableMajors: Record<Courses, Major[]> = {
  BSIT: ["NONE"],
  BSCS: ["NONE"],
  BSCRIM: ["NONE"],
  BSP: ["NONE"],
  BSHM: ["NONE"],
  BSED: ["NONE", "ENGLISH", "MATHEMATICS"],
  BSBA: ["NONE", "MARKETING_MANAGEMENT", "HUMAN_RESOURCE_MANAGEMENT"],
};

export default function SeedingSubjectOffering() {
  const [academicYear, setAcademicYear] =
    useState<AcademicYears>("AY_2025_2026");
  const [semester, setSemester] = useState<Semester>("FIRST");
  const [courseMajorConfig, setCourseMajorConfig] = useState<
    CourseMajorConfig[]
  >(initialCourseMajorConfig);
  const [manualOverrides, setManualOverrides] = useState<string>("");
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedLogs, setSeedLogs] = useState<SeedLog[]>([]);

  const addLog = (type: SeedLog["type"], message: string) => {
    const newLog: SeedLog = {
      id: crypto.randomUUID(),
      type,
      message,
      timestamp: new Date(),
    };
    setSeedLogs((prev) => [newLog, ...prev]);
  };

  const toggleCourseEnabled = (index: number) => {
    setCourseMajorConfig((prev) =>
      prev.map((config, i) =>
        i === index ? { ...config, enabled: !config.enabled } : config
      )
    );
  };

  const updateCourseMajors = (courseIndex: number, majors: Major[]) => {
    setCourseMajorConfig((prev) =>
      prev.map((config, i) =>
        i === courseIndex ? { ...config, majors } : config
      )
    );
  };

  const handleMajorToggle = (courseIndex: number, major: Major) => {
    const currentMajors = courseMajorConfig[courseIndex].majors;
    const newMajors = currentMajors.includes(major)
      ? currentMajors.filter((m) => m !== major)
      : [...currentMajors, major];

    updateCourseMajors(
      courseIndex,
      newMajors.length > 0 ? newMajors : ["NONE"]
    );
  };

  // Simulate the seeding process
  const handleSeed = async () => {
    setIsSeeding(true);
    setSeedLogs([]);
    addLog("info", `🚀 Starting seed for ${academicYear} - ${semester}...`);

    const selectedMap = courseMajorConfig
      .filter((c) => c.enabled)
      .reduce<Record<Courses, Major[]>>(
        (acc, curr) => {
          acc[curr.course] = curr.majors;
          return acc;
        },
        {} as Record<Courses, Major[]>
      );

    try {
      const responseLogs = await seedSubjectOffering({
        academicYear: academicYear as AcademicYear,
        semester,
        courseMajorMap: selectedMap,
        manualOverrides: manualOverrides
          .split("\n")
          .map((line) => line.trim())
          .filter((code) => code.length > 0),
      });

      responseLogs.forEach((log) => {
        addLog(log.type as SeedLog["type"], log.message);
      });
    } catch (err) {
      addLog("error", "❌ Seeding failed. Check the server logs for details.");
    }

    setIsSeeding(false);
  };

  const getLogIcon = (type: SeedLog["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Subject Offering Seed Configuration</CardTitle>
              <CardDescription>
                Configure the parameters for seeding subject offerings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="academic-year">Academic Year</Label>
                  <Select
                    value={academicYear}
                    onValueChange={(value: AcademicYears) =>
                      setAcademicYear(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="semester">Semester</Label>
                  <Select
                    value={semester}
                    onValueChange={(value: Semester) => setSemester(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIRST">First Semester</SelectItem>
                      <SelectItem value="SECOND">Second Semester</SelectItem>
                      <SelectItem value="MIDYEAR">Midyear</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Course & Major Configuration</CardTitle>
              <CardDescription>
                Select which courses and majors to include in the seeding
                process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="space-y-4">
                  {courseMajorConfig.map((config, index) => (
                    <div
                      key={config.course}
                      className="space-y-3 p-4 border rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={config.enabled}
                            onCheckedChange={() => toggleCourseEnabled(index)}
                            className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                          />
                          <Label className="font-medium">{config.course}</Label>
                        </div>
                        <Badge
                          className={
                            config.enabled ? "bg-blue-700" : "bg-red-700"
                          }
                        >
                          {config.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>

                      {config.enabled && (
                        <div className="space-y-2">
                          <Label className="text-sm text-muted-foreground">
                            Majors:
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {availableMajors[config.course].map((major) => (
                              <div
                                key={major}
                                className="flex items-center space-x-1"
                              >
                                <Checkbox
                                  checked={config.majors.includes(major)}
                                  onCheckedChange={() =>
                                    handleMajorToggle(index, major)
                                  }
                                  className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                                />
                                <Label className="text-sm">
                                  {major === "NONE"
                                    ? "No Major"
                                    : major.replace(/_/g, " ")}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manual Overrides</CardTitle>
              <CardDescription>
                Enter course codes (one per line) to force include in this
                semester
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter course codes here (one per line)&#10;Example:&#10;MATH101&#10;ENG201"
                value={manualOverrides}
                onChange={(e) => setManualOverrides(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          <Button
            onClick={handleSeed}
            disabled={isSeeding}
            className="w-full bg-blue-700 hover:bg-blue-900"
            size="lg"
          >
            {isSeeding ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Seeding in Progress...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Seeding Process
              </>
            )}
          </Button>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Seeding Results</CardTitle>
              <CardDescription>
                Real-time logs from the seeding process
              </CardDescription>
            </CardHeader>
            <CardContent>
              {seedLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No seeding activity yet. Click &quot;Start Seeding
                  Process&quot; to begin.
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {seedLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/50"
                      >
                        {getLogIcon(log.type)}
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-mono">{log.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This UI simulates the seeding process. In a real implementation,
              this would connect to your Prisma database and execute the actual
              seeding logic.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
