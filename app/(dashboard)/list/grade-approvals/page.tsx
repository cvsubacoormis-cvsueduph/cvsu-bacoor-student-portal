"use client";

import { useUser } from "@clerk/nextjs";
import {
  useGradeApprovals,
  type PendingChange,
} from "@/components/grades/hooks/useGradeApprovals";
import { GradeApprovalCard } from "@/components/grades/GradeApprovalCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle,
  RefreshCw,
  Search,
  CheckCheck,
} from "lucide-react";

const ALLOWED_ROLES = ["admin", "superuser", "registrar"];

export default function GradeApprovalsPage() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;

  const {
    pendingChanges,
    loading,
    error,
    processingIds,
    processingAll,
    searchQuery,
    setSearchQuery,
    expandedStudents,
    groupedChanges,
    filteredStudentNumbers,
    fetchPending,
    handleApprove,
    handleBulkApprove,
    handleApproveAll,
    handleReject,
    toggleStudent,
  } = useGradeApprovals();

  if (role && !ALLOWED_ROLES.includes(role)) {
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
            Review and approve/reject grade changes submitted by faculty and
            registrar staff
          </span>
        </div>
        <div className="flex items-center gap-2">
          {pendingChanges.length > 0 && (
            <Button
              size="sm"
              onClick={handleApproveAll}
              disabled={processingAll || loading}
              className="bg-green-600 hover:bg-green-700 flex items-center gap-1.5"
            >
              {processingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5" />
              )}
              <span>Approve All</span>
              <Badge
                variant="secondary"
                className="ml-0.5 bg-white/20 text-white text-[10px] px-1.5 py-0"
              >
                {pendingChanges.length}
              </Badge>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPending}
            disabled={loading || processingAll}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {!loading && pendingChanges.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by student number or course code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

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
        <div className="space-y-4">
          {filteredStudentNumbers.length === 0 && searchQuery && (
            <p className="text-center text-gray-500 py-8">
              No students match &ldquo;{searchQuery}&rdquo;
            </p>
          )}

          {filteredStudentNumbers.map((studentNumber) => (
            <GradeApprovalCard
              key={studentNumber}
              studentNumber={studentNumber}
              changes={groupedChanges[studentNumber]}
              isExpanded={expandedStudents.has(studentNumber)}
              processingIds={processingIds}
              onToggle={toggleStudent}
              onBulkApprove={handleBulkApprove}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}
