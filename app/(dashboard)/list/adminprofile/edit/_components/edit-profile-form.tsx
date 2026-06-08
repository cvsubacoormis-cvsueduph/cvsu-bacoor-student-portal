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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import toast from "react-hot-toast";
import { Loader2, ArrowLeft, Mail, Phone, MapPin, User, Shield } from "lucide-react";
import { updateOwnProfile } from "@/actions/user/update-own-profile";
import {
  updateOwnProfileSchema,
  type UpdateOwnProfileFormValues,
} from "@/schemas/user-schema";
import Link from "next/link";

interface ProfileData {
  username: string;
  firstName: string;
  lastName: string;
  middleInit: string | null;
  email: string | null;
  phone: string | null;
  address: string;
  sex: string;
  role: string;
}

interface EditProfileFormProps {
  profile: ProfileData;
}

export function EditProfileForm({ profile }: EditProfileFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<UpdateOwnProfileFormValues>({
    resolver: zodResolver(updateOwnProfileSchema),
    defaultValues: {
      email: profile.email || "",
      phone: profile.phone || "",
      address: profile.address || "",
      middleInit: profile.middleInit || "",
    },
  });

  const onSubmit = async (values: UpdateOwnProfileFormValues) => {
    setIsLoading(true);
    try {
      const result = await updateOwnProfile(values);
      if (result.success) {
        toast.success("Profile updated successfully!");
      } else {
        toast.error(result.error || "Failed to update profile.");
      }
    } catch {
      toast.error("Server error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Back link */}
      <Link
        href="/list/adminprofile"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Profile
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold">Edit Your Profile</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Update your contact information. Name and role are managed by the
            administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Read-only fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border">
                <ReadOnlyField
                  icon={<User className="h-4 w-4" />}
                  label="Username"
                  value={profile.username}
                />
                <ReadOnlyField
                  icon={<Shield className="h-4 w-4" />}
                  label="Role"
                  value={profile.role}
                  badge
                />
                <ReadOnlyField label="First Name" value={profile.firstName} />
                <ReadOnlyField label="Last Name" value={profile.lastName} />
                <ReadOnlyField
                  label="Sex"
                  value={profile.sex}
                  badge
                />
              </div>

              {/* Editable fields */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Mail className="h-4 w-4" />
                        Email
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="your.email@school.edu"
                          type="email"
                          disabled={isLoading}
                          {...field}
                        />
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
                      <FormLabel className="flex items-center gap-1.5">
                        <Phone className="h-4 w-4" />
                        Phone
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="09XXXXXXXXX"
                          type="tel"
                          disabled={isLoading}
                          {...field}
                        />
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
                        <Input
                          placeholder="A"
                          maxLength={1}
                          disabled={isLoading}
                          className="max-w-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" />
                        Address
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Your full address"
                          rows={3}
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-700 hover:bg-blue-900 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

/** Small helper for read-only profile fields */
function ReadOnlyField({
  icon,
  label,
  value,
  badge = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  badge?: boolean;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-gray-500 flex items-center gap-1">
        {icon}
        {label}
      </span>
      {badge ? (
        <Badge variant="secondary" className="capitalize">
          {value}
        </Badge>
      ) : (
        <p className="text-sm font-medium text-gray-900">{value || "—"}</p>
      )}
    </div>
  );
}
