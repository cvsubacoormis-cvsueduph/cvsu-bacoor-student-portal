"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import toast from "react-hot-toast";
import { createStudent } from "@/actions/student/student";
import { createStudentSchema } from "@/lib/formValidationSchemas";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";

export default function CreateStudent() {
  const form = useForm<z.infer<typeof createStudentSchema>>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: {
      studentNumber: "",
      firstName: "",
      middleInit: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      sex: "MALE", // default value
      course: "BSIT", // default value
      major: "NONE", // default value
      status: "REGULAR", // default value
    },
  });

  async function onSubmit(values: z.infer<typeof createStudentSchema>) {
    try {
      const result = await createStudent(values);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Student created successfully!");
        form.reset();
      }
    } catch (error) {
      console.error("Form submission error", error);
      toast.error("Failed to submit the form. Please try again.");
    }
  }

  return (
    <>
      <SignedIn>
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
          {/* TOP */}
          <div className="flex items-center justify-between">
            <h1 className="hidden md:block text-lg font-semibold">
              Create Student
              <span className=" flex text-xs text-gray-500">
                Create a new student in the system.
              </span>
            </h1>
          </div>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-8 py-10"
            >
              <FormField
                control={form.control}
                name="studentNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student Number</FormLabel>
                    <FormControl>
                      <Input placeholder="19010825" type="text" {...field} />
                    </FormControl>
                    <FormDescription>
                      Student number of the student
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Firstname</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Firstname"
                            type="text"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Firstname of the student
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-4">
                  <FormField
                    control={form.control}
                    name="middleInit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Middle Initial</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Middle initial"
                            type="text"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Middle inital of the student
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-4">
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lastname</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Lastname"
                            type="text"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Lastname of the student
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="Email" type="email" {...field} />
                        </FormControl>
                        <FormDescription>
                          Email address of the student
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-6">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Contact Number"
                            type="text"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Contact Number of the student
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Address" type="text" {...field} />
                    </FormControl>
                    <FormDescription>Address of the student</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-6">
                  <FormField
                    control={form.control}
                    name="course"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Course</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Course" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="BSCS">BSCS</SelectItem>
                            <SelectItem value="BSIT">BSIT</SelectItem>
                            <SelectItem value="BSBA">BSBA</SelectItem>
                            <SelectItem value="BSHM">BSHM</SelectItem>
                            <SelectItem value="BSCRIM">BSCRIM</SelectItem>
                            <SelectItem value="BSED">BSED</SelectItem>
                            <SelectItem value="BSP">BSP</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>Course of the student</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-6">
                  <FormField
                    control={form.control}
                    name="major"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Major</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Major" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="HUMAN_RESOURCE_MANAGEMENT">
                              HUMAN RESOURCE MANAGEMENT
                            </SelectItem>
                            <SelectItem value="MARKETING_MANAGEMENT">
                              MARKETING MANAGEMENT
                            </SelectItem>
                            <SelectItem value="ENGLISH">ENGLISH</SelectItem>
                            <SelectItem value="MATHEMATICS">
                              MATHEMATICS
                            </SelectItem>
                            <SelectItem value="NONE">NONE</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Major of the student (Optional)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="REGULAR">REGULAR</SelectItem>
                        <SelectItem value="IRREGULAR">IRREGULAR</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Status of the student</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full bg-blue-700 hover:bg-blue-900"
              >
                Submit
              </Button>
            </form>
          </Form>
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
