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
import { Clock, LogOut, Mail, CheckCircle, RefreshCcw } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  status: string;
  hasPassword: boolean;
  isApproved: boolean;
}

export function WaitingApproval({ user }: { user: User }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const refetchApprovalStatus = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/check-approval", {
        headers: {
          "x-user-id": user.id,
        },
        cache: "no-store",
      });

      const data = await res.json();
      if (data.isApproved) {
        router.push("/student");
      } else {
        setError(
          "Still pending approval. Please contact the the admin or check again later."
        );
      }
    } catch (err) {
      console.error("Failed to check approval:", err);
      setError("Failed to check approval status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md" role="alert" aria-live="polite">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Waiting for Approval
          </CardTitle>
          <CardDescription>
            Your account is pending admin approval
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">
                Password created successfully
              </span>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-center space-x-2 text-blue-700 mb-2">
                <Clock className="h-5 w-5" />
                <span className="font-medium">Pending Admin Review</span>
              </div>
              <p className="text-sm text-blue-600">
                An administrator needs to approve your account before you can
                access the student portal.
              </p>
            </div>

            <div className="text-left bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">
                Account Details:
              </h4>
              <div className="space-y-1 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Name:</span> {user.name}
                </p>
                <p>
                  <span className="font-medium">Email:</span> {user.email}
                </p>
                <p>
                  <span className="font-medium">Status:</span> {user.status}
                </p>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Mail className="h-4 w-4" />
                <span>
                  You will receive an email notification once approved
                </span>
              </div>
              <p>
                Please go to MIS Coordinator and present your recent
                registration form to approve your account.
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="pt-4 border-t space-y-2">
            <Button
              onClick={refetchApprovalStatus}
              variant="secondary"
              disabled={loading}
              className="w-full bg-blue-700 text-white hover:bg-blue-600"
              aria-label="Check approval status"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              {loading ? "Checking..." : "Refresh Status"}
            </Button>

            <SignOutButton>
              <Button variant="outline" className="w-full bg-transparent">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </SignOutButton>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
