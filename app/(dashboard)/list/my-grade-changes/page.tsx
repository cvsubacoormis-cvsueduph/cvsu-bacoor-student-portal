"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { ChangeDiff } from "@/components/grades/ChangeDiff";
import type { MyGradeChange } from "@/actions/my-grade-changes";

function formatAcademicYear(ay: string) {
  return ay?.replace("AY_", "AY ").replace("_", "-") ?? "";
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MyGradeChangesPage() {
  const { user } = useUser();
  const router = useRouter();
  const role = user?.publicMetadata?.role as string | undefined;

  const [changes, setChanges] = useState<MyGradeChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchChanges = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { getMyGradeChanges } = await import("@/actions/my-grade-changes");
      const data = await getMyGradeChanges();
      setChanges(data);
    } catch (err: any) {
      setError(err.message || "Failed to load grade change requests");
    } finally {
      setLoading(false);
    }
  }, []);

  const silentPoll = useCallback(async () => {
    try {
      const { getMyGradeChanges } = await import("@/actions/my-grade-changes");
      const data = await getMyGradeChanges();
      setChanges(data);
      setError("");
    } catch {
      // Ignore poll errors
    }
  }, []);

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

  useEffect(() => {
    const interval = setInterval(silentPoll, 15000);
    return () => clearInterval(interval);
  }, [silentPoll]);

  const allowedRoles = [
    "admin",
    "superuser",
    "registrar",
    "registrar_staff",
    "faculty",
  ];
  if (role && !allowedRoles.includes(role)) {
    return (
      <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-red-600">Access Denied</h2>
          <p className="text-gray-600 mt-2">
            You are not authorized to view this page.
          </p>
        </div>
      </div>
    );
  }

  const filtered =
    statusFilter && statusFilter !== "ALL"
      ? changes.filter((c) => c.status === statusFilter)
      : changes;

  const counts = {
    all: changes.length,
    pending: changes.filter((c) => c.status === "PENDING").length,
    approved: changes.filter((c) => c.status === "APPROVED").length,
    rejected: changes.filter((c) => c.status === "REJECTED").length,
  };

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">My Grade Change Requests</h1>
          <span className="text-xs text-gray-500 font-semibold">
            Track the status of grade changes you have submitted for approval
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchChanges}
          disabled={loading}
          className="flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-500">Filter:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">
              All ({counts.all})
            </SelectItem>
            <SelectItem value="PENDING">
              Pending ({counts.pending})
            </SelectItem>
            <SelectItem value="APPROVED">
              Approved ({counts.approved})
            </SelectItem>
            <SelectItem value="REJECTED">
              Rejected ({counts.rejected})
            </SelectItem>
          </SelectContent>
        </Select>
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

      {!loading && !error && filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto text-green-300 mb-3" />
            <p className="text-lg font-medium">No grade change requests</p>
            <p className="text-sm">
              {statusFilter
                ? `You have no ${statusFilter.toLowerCase()} requests.`
                : "You haven't submitted any grade changes for approval yet."}
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Student #</TableHead>
                <TableHead>Course Code</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Proposed Grade</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reviewed By</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((change) => {
                const gd = change.gradeData as Record<string, any>;

                return (
                  <TableRow key={change.id}>
                    <TableCell className="font-mono text-sm">
                      {change.studentNumber}
                    </TableCell>
                    <TableCell>
                      {change.courseCode || gd?.courseCode || "—"}
                    </TableCell>
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
                    <TableCell className="min-w-[280px]">
                      <ChangeDiff action={change.action} proposed={gd} />
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                      {formatAcademicYear(change.academicYear)}{" "}
                      {change.semester}
                    </TableCell>
                    <TableCell>
                      {change.status === "PENDING" && (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                      {change.status === "APPROVED" && (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Approved
                        </Badge>
                      )}
                      {change.status === "REJECTED" && (
                        <div>
                          <Badge className="bg-red-100 text-red-800 border-red-200">
                            <XCircle className="w-3 h-3 mr-1" />
                            Rejected
                          </Badge>
                          {change.rejectionReason && (
                            <p className="text-xs text-red-600 mt-1 max-w-[200px] truncate" title={change.rejectionReason}>
                              {change.rejectionReason}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {change.reviewedByName || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(change.reviewedAt || change.createdAt)}
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
