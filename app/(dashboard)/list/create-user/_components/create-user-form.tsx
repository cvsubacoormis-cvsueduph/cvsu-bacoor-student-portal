"use client";

import type React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";
import { Loader2, Mail, Phone, MapPin, Download, Copy, Check, AlertTriangle } from "lucide-react";
import { createUser } from "@/actions/user/user-action";
import { createUserSchema, type CreateUserFormValues } from "@/schemas/user-schema";
import * as XLSX from "xlsx";

interface CreatedUserResult {
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  generatedPassword: string;
}

export function CreateUserForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [createdUserResult, setCreatedUserResult] = useState<CreatedUserResult | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      firstName: "",
      lastName: "",
      middleInit: "",
      email: "",
      phone: "",
      address: "",
      sex: undefined,
      role: "faculty",
    },
  });

  const onSubmit = async (values: CreateUserFormValues) => {
    setIsLoading(true);

    try {
      const result = await createUser(values);

      if (result.error) {
        toast.error(result.error);

        // Handle field specific errors from backend
        if (result.details) {
          Object.entries(result.details).forEach(([key, messages]) => {
            if (messages && messages.length > 0) {
              form.setError(key as keyof CreateUserFormValues, { message: messages[0] });
            }
          });
        }
        return;
      }

      toast.success(
        `User ${values.firstName} ${values.lastName} created successfully!`
      );

      // Store the generated password result for display/download
      if (result.generatedPassword) {
        setCreatedUserResult({
          username: result.user.username,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          email: result.user.email ?? undefined,
          generatedPassword: result.generatedPassword,
        });
      }

      form.reset();
    } catch (error) {
      toast.error("Failed to create user. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!createdUserResult) return;
    try {
      await navigator.clipboard.writeText(createdUserResult.generatedPassword);
      setPasswordCopied(true);
      toast.success("Password copied to clipboard!");
      setTimeout(() => setPasswordCopied(false), 2000);
    } catch {
      toast.error("Failed to copy password.");
    }
  };

  const handleDownloadCredentials = () => {
    if (!createdUserResult) return;
    const data = [
      {
        Username: createdUserResult.username,
        "First Name": createdUserResult.firstName,
        "Last Name": createdUserResult.lastName,
        Email: createdUserResult.email || "",
        Password: createdUserResult.generatedPassword,
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Credentials");
    XLSX.writeFile(
      workbook,
      `credentials-${createdUserResult.username}.xlsx`
    );
  };

  const handleCreateAnother = () => {
    setCreatedUserResult(null);
    setPasswordCopied(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-bold">Create New User</CardTitle>
        <CardDescription className="text-sm">
          Add a new faculty member or registrar to the system (Manual Entry)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Basic Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="faculty">Faculty</SelectItem>
                          <SelectItem value="registrar">Registrar</SelectItem>
                          <SelectItem value="registrar_staff">Registrar Staff</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        <Input placeholder="M.I." maxLength={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="sex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sex *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sex" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Contact Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            type="email"
                            placeholder="Enter email address"
                            className="pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Enter phone number"
                            className="pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Textarea
                          placeholder="Enter complete address"
                          className="pl-10 min-h-[80px]"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
              >
                Reset
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="min-w-[120px] bg-blue-700 hover:bg-blue-900 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create User"
                )}
              </Button>
            </div>
          </form>
        </Form>

        {/* Generated Credentials Display */}
        {createdUserResult && (
          <div className="mt-8 border-t pt-6">
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-800">
                    User Created — Save These Credentials
                  </h4>
                  <p className="text-sm text-amber-700 mt-1">
                    This generated password will <strong>not</strong> be shown
                    again. Please copy or download it now.
                  </p>
                </div>
              </div>

              {/* User Info Summary */}
              <div className="bg-white rounded-md border border-amber-200 p-4 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Name:</span>{" "}
                    <span className="font-medium">
                      {createdUserResult.firstName} {createdUserResult.lastName}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Username:</span>{" "}
                    <span className="font-medium">
                      {createdUserResult.username}
                    </span>
                  </div>
                  {createdUserResult.email && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Email:</span>{" "}
                      <span className="font-medium">
                        {createdUserResult.email}
                      </span>
                    </div>
                  )}
                </div>

                {/* Password Display */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-gray-500 text-sm">Password:</span>
                  <code className="bg-gray-100 px-3 py-1.5 rounded text-sm font-mono text-gray-900 select-all border border-gray-200">
                    {createdUserResult.generatedPassword}
                  </code>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant={passwordCopied ? "default" : "outline"}
                  onClick={handleCopyPassword}
                  className="text-sm"
                >
                  {passwordCopied ? (
                    <>
                      <Check className="mr-1.5 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-4 w-4" />
                      Copy Password
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadCredentials}
                  className="text-sm"
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Download Credentials (.xlsx)
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleCreateAnother}
                  className="text-sm ml-auto"
                >
                  Create Another User
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
