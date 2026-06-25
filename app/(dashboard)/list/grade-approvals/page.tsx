"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";

type PendingChange = {
  id: string;
  action: string;
  studentNumber: string;
  gradeData: Record<string, unknown>;
  gradeId: string | null;
  courseCode: string | null;
  academicYear: string;
  semester: string;
  requestedById: string;
  requestedByName: string;
  requestedRole: string;
  status: string;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

function formatAcademicYear(ay: string) {
  return ay?.replace("AY_", "AY ").replace("_", "-") ?? "";
}

function formatRoleBadge(role: string) {
  const colors: Record<string, string> = {
    registrar_staff: "bg-purple-100 text-purple-800",
    registrar: "bg-indigo-100 text-indigo-800",
    admin: "bg-blue-100 text-blue-800",
    superuser: "bg-cyan-100 text-cyan-800",
  };
  return colors[role] || "bg-gray-100 text-gray-800";
}

export default function GradeApprovalsPage() {
  const { user } = useUser();
  const router = useRouter();
  const role = user?.publicMetadata?.role as string | undefined;

  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/pending-grade-changes?status=PENDING");
      if (!res.ok) {
        if (res.status === 403) throw new Error("You don't have permission to view pending changes.");
        throw new Error("Failed to fetch pending changes");
      }
      const data = await res.json();
      setPendingChanges(data);
    } catch (err: any) {
      setError(err.message || "Failed to load pending changes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleApprove = async (change: PendingChange) => {
    const result = await Swal.fire({
      title: "Approve this change?",
      html: `
        <div class="text-left text-sm space-y-1">
          <p><strong>Action:</strong> ${change.action}</p>
          <p><strong>Student:</strong> ${change.studentNumber}</p>
          <p><strong>Course:</strong> ${change.courseCode || "N/A"}</p>
          <p><strong>Requested by:</strong> ${change.requestedByName} (${change.requestedRole})</p>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Approve",
      confirmButtonColor: "#16a34a",
    });

    if (!result.isConfirmed) return;

    setProcessingIds((prev) => new Set(prev).add(change.id));
    try {
      const res = await fetch(`/api/pending-grade-changes/${change.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to approve");
      }

      Swal.fire({
        icon: "success",
        title: "Approved",
        text: "The grade change has been applied.",
        timer: 2000,
        showConfirmButton: false,
      });

      // Remove from list
      setPendingChanges((prev) => prev.filter((c) => c.id !== change.id));
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Approval Failed",
        text: err.message,
      });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(change.id);
        return next;
      });
    }
  };

  const handleReject = async (change: PendingChange) => {
    const { value: reason } = await Swal.fire({
      title: "Reject this change?",
      input: "textarea",
      inputLabel: "Rejection reason (required)",
      inputPlaceholder: "Explain why this change is being rejected...",
      inputAttributes: { "aria-label": "Rejection reason" },
      showCancelButton: true,
      confirmButtonText: "Reject",
      confirmButtonColor: "#dc2626",
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return "You need to provide a rejection reason!";
        }
        return null;
      },
    });

    if (!reason) return;

    setProcessingIds((prev) => new Set(prev).add(change.id));
    try {
      const res = await fetch(`/api/pending-grade-changes/${change.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", rejectionReason: reason }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reject");
      }

      Swal.fire({
        icon: "info",
        title: "Rejected",
        text: "The grade change has been rejected.",
        timer: 2000,
        showConfirmButton: false,
      });

      setPendingChanges((prev) => prev.filter((c) => c.id !== change.id));
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Rejection Failed",
        text: err.message,
      });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(change.id);
        return next;
      });
    }
  };

  // Authorization check
  const allowedRoles = ["admin", "superuser", "registrar"];
  if (role && !allowedRoles.includes(role)) {
    return (
      <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-red-600">Access Denied</h2>
          <p className="text-gray-600 mt-2">
            Only registrars and admins can review grade changes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">Grade Change Approvals</h1>
          <span className="text-xs text-gray-500 font-semibold">
            Review and approve/reject grade changes submitted by registrar staff
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchPending}
          disabled={loading}
          className="flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 mb-4">
          {error}
        </div>
      )}

      {!loading && !error && pendingChanges.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto text-green-300 mb-3" />
            <p className="text-lg font-medium">No pending changes</p>
            <p className="text-sm">All grade submissions have been reviewed.</p>
          </CardContent>
        </Card>
      )}

      {!loading && pendingChanges.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Student #</TableHead>
                <TableHead>Course Code</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Proposed Grade</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingChanges.map((change) => {
                const gd = change.gradeData as Record<string, any>;
                const isProcessing = processingIds.has(change.id);

                return (
                  <TableRow key={change.id}>
                    <TableCell className="font-mono text-sm">
                      {change.studentNumber}
                    </TableCell>
                    <TableCell>{change.courseCode || gd?.courseCode || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          change.action === "CREATE"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : change.action === "UPDATE"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-red-700 border-red-200"
                        }
                      >
                        {change.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-0.5">
                        <p>
                          <span className="text-gray-500">Grade:</span>{" "}
                          <span className="font-semibold text-blue-700">
                            {gd?.grade || "—"}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">
                          Credits: {gd?.creditUnit ?? "—"} | Title: {gd?.courseTitle || "—"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {formatAcademicYear(change.academicYear)}{" "}
                      {change.semester}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{change.requestedByName}</p>
                        <Badge className={formatRoleBadge(change.requestedRole)}>
                          {change.requestedRole.replace("_", " ")}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApprove(change)}
                          disabled={isProcessing}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          <span className="ml-1">Approve</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(change)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          <span className="ml-1">Reject</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
