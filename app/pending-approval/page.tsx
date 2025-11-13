"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  RefreshCcw,
  LogOut,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { HashLoader } from "react-spinners";

export default function PendingApprovalPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isApproved = user?.publicMetadata?.isApproved as boolean;
  const role = user?.publicMetadata?.role as string;

  useEffect(() => {
    if (isLoaded) {
      if (!user) {
        router.push("/sign-in");
        return;
      }

      console.log("isApproved:", isApproved, "role:", role); // Debug info

      if (
        isApproved &&
        (role === "admin" || role === "faculty" || role === "registrar")
      ) {
        router.push("/admin");
      }
    }
  }, [isLoaded, user, router, isApproved, role]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 3000);
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA]">
        <HashLoader color="#1976D2" size={150} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] p-4">
      <div className="text-center space-y-6 p-8 bg-white rounded-lg shadow-lg max-w-md w-full">
        <div className="flex justify-center">
          <Image src="/logos.png" alt="logo" width={150} height={150} />
        </div>

        {/* Status Display Section */}
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-800">Account Status</h1>

          {isApproved ? (
            // Approved Status
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-center space-x-2 text-green-700">
                <CheckCircle className="h-6 w-6" />
                <span className="text-lg font-semibold">Account Approved</span>
              </div>
              <p className="text-green-600 mt-2 text-sm">
                Your account has been approved! Redirecting you to your
                dashboard...
              </p>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-center space-x-2 text-yellow-700">
                <Clock className="h-6 w-6" />
                <span className="text-lg font-semibold">Pending Approval</span>
              </div>
              <p className="text-yellow-600 mt-2 text-sm">
                Your account is waiting for admin approval
              </p>
            </div>
          )}

          {/* Additional Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left">
            <h3 className="font-semibold text-gray-800 mb-2">
              Account Details:
            </h3>
            <div className="space-y-1 text-sm">
              <p className="text-gray-600">
                <span className="font-medium">Email:</span>{" "}
                {user?.emailAddresses[0]?.emailAddress || "N/A"}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Name:</span>{" "}
                {user?.fullName || "N/A"}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Role:</span>{" "}
                {role ? role.toUpperCase() : "NOT ASSIGNED"}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Status:</span>
                <span
                  className={`ml-2 font-semibold ${isApproved ? "text-green-600" : "text-yellow-600"}`}
                >
                  {isApproved ? "Approved" : "Pending"}
                </span>
              </p>
            </div>
          </div>

          {/* Instructions */}
          {!isApproved && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-center space-x-2 text-blue-700 mb-2">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Next Steps</span>
              </div>
              <p className="text-blue-600 text-sm">
                Please go to the MIS Coordinator office and present your recent
                registration form to approve your account.
              </p>
            </div>
          )}
        </div>

        {!isApproved && (
          <div className="flex items-center justify-center">
            <div className="max-w-sm mx-auto">
              <HashLoader className="h-10 w-10" color="#1976D2" />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4 border-t space-y-3">
          {!isApproved && (
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCcw
                className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              {isRefreshing ? "Checking Status..." : "Refresh Status"}
            </Button>
          )}

          <SignOutButton>
            <Button variant="outline" className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}
