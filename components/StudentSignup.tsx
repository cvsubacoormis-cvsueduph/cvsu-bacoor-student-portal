"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  CreateStudentSchema,
  createStudentSchema,
} from "@/lib/formValidationSchemas";
import toast from "react-hot-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import Link from "next/link";
import {
  CheckCircle,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  MapPin,
  Settings,
  User,
} from "lucide-react";
import { registerStudent } from "@/actions/student/registerStudent";
import { cn } from "@/lib/utils";
import { Progress } from "./ui/progress";
import { courseMap, formatMajor } from "@/lib/courses";

type UserSex = "MALE" | "FEMALE";
type Courses = "BSCS" | "BSIT" | "BSCRIM" | "BSP" | "BSHM" | "BSBA" | "BSED";
type Major =
  | "NONE"
  | "MARKETING_MANAGEMENT"
  | "HUMAN_RESOURCE_MANAGEMENT"
  | "ENGLISH"
  | "MATHEMATICS";
type Status = "REGULAR" | "IRREGULAR";

const steps = [
  {
    id: 1,
    title: "Personal Information",
    icon: User,
    description: "Basic personal information",
  },
  {
    id: 2,
    title: "Academic Information",
    icon: GraduationCap,
    description: "Course and academic details",
  },
  {
    id: 3,
    title: "Contact Information",
    icon: MapPin,
    description: "Contact and address details",
  },
  {
    id: 4,
    title: "Account Setup",
    icon: Settings,
    description: "Username and final setup",
  },
];

const coursesForcedNone: Courses[] = ["BSIT", "BSCS", "BSCRIM", "BSHM", "BSP"];

const courseMajorMap: Record<Courses, Major[]> = {
  BSIT: ["NONE"],
  BSCS: ["NONE"],
  BSCRIM: ["NONE"],
  BSHM: ["NONE"],
  BSP: ["NONE"],
  BSED: ["ENGLISH", "MATHEMATICS"],
  BSBA: ["MARKETING_MANAGEMENT", "HUMAN_RESOURCE_MANAGEMENT"],
};

const allAvailableMajors: Major[] = [
  "NONE",
  "HUMAN_RESOURCE_MANAGEMENT",
  "MARKETING_MANAGEMENT",
  "ENGLISH",
  "MATHEMATICS",
];

export default function StudentSignup() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const form = useForm<CreateStudentSchema>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: {
      studentNumber: "",
      username: "",
      firstName: "",
      lastName: "",
      middleInit: "",
      email: "",
      phone: "",
      address: "",
      sex: "" as UserSex,
      course: "BSIT" as Courses, // Initial default set to one of the forced NONE courses
      major: "NONE" as Major,
      status: "REGULAR",
      password: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  const { watch, setValue } = form;
  const watchedCourse = watch("course");
  const watchedMajor = watch("major");

  useEffect(() => {
    if (coursesForcedNone.includes(watchedCourse)) {
      if (watchedMajor !== "NONE") {
        setValue("major", "NONE");
      }
    } else if (watchedCourse === "BSED" || watchedCourse === "BSBA") {
      const validMajors = courseMajorMap[watchedCourse];
      if (
        !validMajors.includes(watchedMajor as Major) ||
        watchedMajor === "NONE"
      ) {
        setValue("major", validMajors[0]);
      }
    }
  }, [watchedCourse, setValue, watchedMajor]);

  const validateStep = async (step: number): Promise<boolean> => {
    const fieldsToValidate: (keyof CreateStudentSchema)[] = [];

    switch (step) {
      case 1:
        fieldsToValidate.push("firstName", "lastName", "sex");
        break;
      case 2:
        fieldsToValidate.push("course", "studentNumber");

        if (!coursesForcedNone.includes(watchedCourse)) {
          fieldsToValidate.push("major");
        }
        break;
      case 3:
        fieldsToValidate.push("address", "email");
        break;
      case 4:
        fieldsToValidate.push("username", "password", "confirmPassword");
        break;
    }

    return await form.trigger(fieldsToValidate);
  };

  const nextStep = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function onSubmit(values: z.infer<typeof createStudentSchema>) {
    try {
      setLoading(true);
      const response = await registerStudent(values);

      if (response.success) {
        toast.success("Student registered successfully!");
        form.reset();
        setCurrentStep(1);
      } else {
        response.errors.forEach((msg: string) => {
          toast.error(msg);
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  const progress = (currentStep / steps.length) * 100;
  const getValidMajorsForCourse = (): Major[] => {
    return courseMajorMap[watchedCourse] || ["NONE"];
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span className="text-blue-600">
            Step {currentStep} of {steps.length}
          </span>
          <span className="text-blue-600">
            {Math.round(progress)}% Complete
          </span>
        </div>
        <Progress
          value={progress}
          className="[&>*]:bg-blue-700 h-2 mt-2
        "
        />
      </div>

      <div className="flex justify-between">
        {steps.map((step) => {
          const Icon = step.icon;
          const isCompleted = currentStep > step.id;

          return (
            <div key={step.id} className="flex flex-col items-center space-y-2">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                  "border-blue-500 text-blue-500 bg-blue-100"
                )}
              >
                {isCompleted ? (
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                ) : (
                  <Icon className="w-5 h-5 text-blue-500" />
                )}
              </div>
              <div className="text-center">
                <p className="text-xs font-medium">{step.title}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {steps[currentStep - 1].title}
          </CardTitle>
          <CardDescription>
            {steps[currentStep - 1].description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {currentStep === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter first name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter last name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="middleInit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Middle Initial</FormLabel>
                        <FormControl>
                          <Input placeholder="M" maxLength={1} {...field} />
                        </FormControl>
                        <FormDescription>
                          Optional middle initial
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sex"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sex *</FormLabel>
                        <FormControl>
                          <Select
                            {...field}
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select sex" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MALE">Male</SelectItem>
                              <SelectItem value="FEMALE">Female</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {currentStep === 2 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="studentNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Student Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="19010825" {...field} />
                        </FormControl>
                        <FormDescription>
                          Your unique student identification number
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="course"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Course *</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select course" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(courseMajorMap).map((course) => (
                                <SelectItem key={course} value={course}>
                                  {course}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="major"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Major{" "}
                            {coursesForcedNone.includes(watchedCourse)
                              ? "(Optional)"
                              : "*"}
                          </FormLabel>
                          <FormControl>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select major" />
                              </SelectTrigger>
                              <SelectContent>
                                {getValidMajorsForCourse().map((major) => (
                                  <SelectItem key={major} value={major}>
                                    {formatMajor(major)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>
                            {coursesForcedNone.includes(watchedCourse)
                              ? "Major is automatically set to NONE for this course."
                              : "Select your major - this field is required"}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your full address"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Your current residential address
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email address *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter email address"
                              type="email"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Please use an active email address
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone number *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter phone number"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Your contact phone number
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter username" {...field} />
                        </FormControl>
                        <FormDescription>
                          This will be used to log into your student portal
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                {...field}
                                placeholder="Enter password"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-2 top-1/2 -translate-y-1/2"
                                onClick={() => setShowPassword((prev) => !prev)}
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Must be at least 8 characters with uppercase,
                            lowercase, and number
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                {...field}
                                placeholder="Confirm password"
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Re-enter your password to confirm
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Registration Summary</h4>
                    <div className="text-sm space-y-1 text-muted-foreground">
                      <p>
                        <strong>Name:</strong> {watch("firstName") || ""}{" "}
                        {watch("middleInit") || ""} {watch("lastName") || ""}
                      </p>
                      <p>
                        <strong>Student Number:</strong>{" "}
                        {watch("studentNumber") || "Not provided"}
                      </p>
                      <p>
                        <strong>Course:</strong>{" "}
                        {courseMap(
                          watch("course")?.replace(/_/g, " ") || "Not selected"
                        )}
                      </p>
                      <p>
                        <strong>Major:</strong>{" "}
                        {formatMajor(
                          watch("major")?.replace(/_/g, " ") || "None"
                        )}
                      </p>
                      <p>
                        <strong>Username:</strong>{" "}
                        {watch("username") || "Not set"}
                      </p>
                      <p>
                        <strong>Password:</strong>{" "}
                        {watch("password") ? "••••••••" : "Not set"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 1 || loading}
          className="bg-white hover:bg-gray-100"
        >
          Previous
        </Button>

        {currentStep < steps.length ? (
          <Button
            onClick={nextStep}
            className="bg-blue-700 hover:bg-blue-600"
            disabled={loading}
          >
            Next
          </Button>
        ) : (
          <Button
            className="bg-blue-700 hover:bg-blue-600"
            onClick={form.handleSubmit(onSubmit)}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Registration"
            )}
          </Button>
        )}
      </div>
      <div className="text-center text-sm mt-4 text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in">
          {" "}
          <p className="no-underline font-medium hover:underline text-blue-600">
            Login
          </p>{" "}
        </Link>
      </div>
    </div>
  );
}
