"use client";

import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";
import { Loader2, User, Mail, Phone, MapPin } from "lucide-react";
import { createUser } from "@/actions/user/user-action";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";

type UserSex = "MALE" | "FEMALE";
type Role = "faculty" | "registrar";

interface CreateUserForm {
  username: string;
  firstName: string;
  lastName: string;
  middleInit?: string;
  email?: string;
  phone?: string;
  address: string;
  sex: UserSex | "";
  role: Role;
}

export default function CreateUserPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<CreateUserForm>({
    username: "",
    firstName: "",
    lastName: "",
    middleInit: "",
    email: "",
    phone: "",
    address: "",
    sex: "",
    role: "faculty",
  });

  const [errors, setErrors] = useState<Partial<CreateUserForm>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<CreateUserForm> = {};

    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.address.trim()) {
      newErrors.address = "Address is required";
    }

    if (!formData.sex) {
      newErrors.sex = "Sex is required" as any;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (formData.phone && !/^[\d\s\-+$$$$]+$/.test(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Form Validation Failed");
      return;
    }

    setIsLoading(true);

    try {
      // Call the server action
      const result = await createUser({
        username: formData.username,
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleInit: formData.middleInit,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address,
        sex: formData.sex as UserSex, // Cast to UserSex since we've validated it's not empty
        role: formData.role,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        `User ${formData.firstName} ${formData.lastName} created successfully!`
      );

      // Reset form
      setFormData({
        username: "",
        firstName: "",
        lastName: "",
        middleInit: "",
        email: "",
        phone: "",
        address: "",
        sex: "",
        role: "faculty",
      });
    } catch (error) {
      toast.error("Failed to create user. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof CreateUserForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <>
      <SignedIn>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className=" px-4">
            <div className="">
              <Card>
                <CardHeader className="">
                  <CardTitle className="text-2xl font-bold">
                    Create New User
                  </CardTitle>
                  <CardDescription>
                    Add a new faculty member or registrar to the system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Basic Information
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="username">Username *</Label>
                          <Input
                            id="username"
                            value={formData.username}
                            onChange={(e) =>
                              handleInputChange("username", e.target.value)
                            }
                            placeholder="Enter username"
                            className={errors.username ? "border-red-500" : ""}
                          />
                          {errors.username && (
                            <p className="text-sm text-red-500">
                              {errors.username}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="role">Role *</Label>
                          <Select
                            value={formData.role}
                            onValueChange={(value: Role) =>
                              handleInputChange("role", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="faculty">Faculty</SelectItem>
                              <SelectItem value="registrar">
                                Registrar
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name *</Label>
                          <Input
                            id="firstName"
                            value={formData.firstName}
                            onChange={(e) =>
                              handleInputChange("firstName", e.target.value)
                            }
                            placeholder="Enter first name"
                            className={errors.firstName ? "border-red-500" : ""}
                          />
                          {errors.firstName && (
                            <p className="text-sm text-red-500">
                              {errors.firstName}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name *</Label>
                          <Input
                            id="lastName"
                            value={formData.lastName}
                            onChange={(e) =>
                              handleInputChange("lastName", e.target.value)
                            }
                            placeholder="Enter last name"
                            className={errors.lastName ? "border-red-500" : ""}
                          />
                          {errors.lastName && (
                            <p className="text-sm text-red-500">
                              {errors.lastName}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="middleInit">Middle Initial</Label>
                          <Input
                            id="middleInit"
                            value={formData.middleInit}
                            onChange={(e) =>
                              handleInputChange("middleInit", e.target.value)
                            }
                            placeholder="M.I."
                            maxLength={1}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Sex *</Label>
                        <Select
                          value={formData.sex}
                          onValueChange={(value: UserSex) =>
                            handleInputChange("sex", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select sex" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MALE">Male</SelectItem>
                            <SelectItem value="FEMALE">Female</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.sex && (
                          <p className="text-sm text-red-500">{errors.sex}</p>
                        )}
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Contact Information
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              id="email"
                              type="email"
                              value={formData.email}
                              onChange={(e) =>
                                handleInputChange("email", e.target.value)
                              }
                              placeholder="Enter email address"
                              className={`pl-10 ${
                                errors.email ? "border-red-500" : ""
                              }`}
                            />
                          </div>
                          {errors.email && (
                            <p className="text-sm text-red-500">
                              {errors.email}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              id="phone"
                              value={formData.phone}
                              onChange={(e) =>
                                handleInputChange("phone", e.target.value)
                              }
                              placeholder="Enter phone number"
                              className={`pl-10 ${
                                errors.phone ? "border-red-500" : ""
                              }`}
                            />
                          </div>
                          {errors.phone && (
                            <p className="text-sm text-red-500">
                              {errors.phone}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="address">Address *</Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Textarea
                            id="address"
                            value={formData.address}
                            onChange={(e) =>
                              handleInputChange("address", e.target.value)
                            }
                            placeholder="Enter complete address"
                            className={`pl-10 min-h-[80px] ${
                              errors.address ? "border-red-500" : ""
                            }`}
                          />
                        </div>
                        {errors.address && (
                          <p className="text-sm text-red-500">
                            {errors.address}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end space-x-4 pt-6 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setFormData({
                            username: "",
                            firstName: "",
                            lastName: "",
                            middleInit: "",
                            email: "",
                            phone: "",
                            address: "",
                            sex: "",
                            role: "faculty",
                          });
                          setErrors({});
                        }}
                      >
                        Reset
                      </Button>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="min-w-[120px] bg-blue-700 hover:bg-blue-900"
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
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
