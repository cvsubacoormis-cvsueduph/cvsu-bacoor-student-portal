// app/components/admin-profile.tsx
"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, MapPin, Shield } from "lucide-react";
import { Admin } from "@/lib/types";
import { getUserProfile } from "@/actions/admin/admin";
import { Role, UserSex } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useUser } from "@clerk/nextjs";
import { HashLoader } from "react-spinners";
import AdminProfileSkeleton from "./skeleton/AdminProfileSkeleton";

export default function AdminProfileComp() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useUser();

  useEffect(() => {
    const fetchAdminProfile = async () => {
      try {
        const data = await getUserProfile();
        setAdmin({
          ...data,
          middleName: data.middleInit || "",
          role: data.role.toUpperCase() as Role,
          sex: data.sex.toUpperCase() as UserSex,
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          birthday: "birthday" in data ? data.birthday || "" : "",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchAdminProfile();
  }, []);

  if (loading) {
    return <AdminProfileSkeleton />;
  }

  if (error) {
    return <div className="mx-auto p-6 text-red-500">{error}</div>;
  }

  if (!admin) {
    return <div className="mx-auto p-6">No admin data found</div>;
  }

  return (
    <div className="mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <Avatar className="w-16 h-16">
              <AvatarImage src={user?.imageUrl ?? ""} alt="Student" />
              <AvatarFallback>
                [{admin.firstName[0]}
                {admin.lastName[0]}]
              </AvatarFallback>
            </Avatar>
          </div>
          <div>
            <h1 className="text-3xl font-bold">
              {admin.firstName} {admin.middleName && `${admin.middleName} `}
              {admin.lastName}
            </h1>
            <div className="flex items-center space-x-2 mt-1">
              <Badge
                variant="secondary"
                className="flex items-center space-x-1"
              >
                <Shield className="w-3 h-3" />
                <span>{admin.role}</span>
              </Badge>
              <span className="text-muted-foreground">@{admin.username}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span>Personal Information</span>
            </CardTitle>
            <CardDescription>
              Basic personal details and identification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" value={admin.firstName} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={admin.lastName} disabled />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="middleName">Middle Name (Optional)</Label>
              <Input
                id="middleName"
                value={admin.middleName || ""}
                disabled
                placeholder="Enter middle name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sex">Sex</Label>
                <Select value={admin.sex} disabled>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mail className="w-5 h-5" />
              <span>Contact Information</span>
            </CardTitle>
            <CardDescription>
              Communication details and location
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={admin.email}
                  disabled
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={admin.phone || ""}
                  disabled
                  className="pl-10"
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Textarea
                  id="address"
                  value={admin.address}
                  disabled
                  className="pl-10 min-h-[80px]"
                  placeholder="Enter full address"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Account Information</span>
          </CardTitle>
          <CardDescription>System access and role management</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={admin.username} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={admin.role} disabled>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="SUPERUSER">Superuser</SelectItem>
                  <SelectItem value="REGISTRAR">Registrar</SelectItem>
                  <SelectItem value="FACULTY">Faculty</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="id">User ID</Label>
              <Input
                id="id"
                value={admin.id.slice(0, -18) + "*****"}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
