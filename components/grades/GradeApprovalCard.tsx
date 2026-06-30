"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  CheckCheck,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { ChangeDiff } from "@/components/grades/ChangeDiff";
import type { PendingChange } from "@/components/grades/hooks/useGradeApprovals";

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

function actionBadgeClass(action: string) {
  if (action === "CREATE")
    return "bg-green-50 text-green-700 border-green-200";
  if (action === "UPDATE")
    return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

interface GradeApprovalCardProps {
  studentNumber: string;
  changes: PendingChange[];
  isExpanded: boolean;
  processingIds: Set<string>;
  onToggle: (studentNumber: string) => void;
  onBulkApprove: (studentNumber: string) => void;
  onApprove: (change: PendingChange) => void;
  onReject: (change: PendingChange) => void;
}

export function GradeApprovalCard({
  studentNumber,
  changes,
  isExpanded,
  processingIds,
  onToggle,
  onBulkApprove,
  onApprove,
  onReject,
}: GradeApprovalCardProps) {
  const createCount = changes.filter((c) => c.action === "CREATE").length;
  const updateCount = changes.filter((c) => c.action === "UPDATE").length;
  const deleteCount = changes.filter((c) => c.action === "DELETE").length;
  const isBulkProcessing = changes.some((c) => processingIds.has(c.id));

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => onToggle(studentNumber)}
            className="flex items-center gap-2 text-left flex-1 min-w-0 hover:text-blue-700 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-400" />
            )}
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="font-mono">{studentNumber}</span>
                <Badge variant="secondary" className="text-xs font-normal">
                  {changes.length} pending
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                {createCount > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0"
                  >
                    +{createCount} create
                  </Badge>
                )}
                {updateCount > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0"
                  >
                    ~{updateCount} update
                  </Badge>
                )}
                {deleteCount > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0"
                  >
                    -{deleteCount} delete
                  </Badge>
                )}
              </div>
            </div>
          </button>

          <Button
            size="sm"
            variant="default"
            onClick={() => onBulkApprove(studentNumber)}
            disabled={isBulkProcessing}
            className="bg-green-600 hover:bg-green-700 flex-shrink-0"
          >
            {isBulkProcessing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCheck className="w-3 h-3" />
            )}
            <span className="ml-1">Approve All ({changes.length})</span>
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 pb-3 px-4">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="w-[80px]">Action</TableHead>
                  <TableHead>Course Code</TableHead>
                  <TableHead>Proposed Grade</TableHead>
                  <TableHead className="w-[120px]">Term</TableHead>
                  <TableHead className="w-[160px]">Requested By</TableHead>
                  <TableHead className="text-right w-[180px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changes.map((change) => {
                  const gd = change.gradeData as Record<string, any>;
                  const isProcessing = processingIds.has(change.id);

                  return (
                    <TableRow key={change.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={actionBadgeClass(change.action)}
                        >
                          {change.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {change.courseCode || gd?.courseCode || "—"}
                      </TableCell>
                      <TableCell className="min-w-[280px]">
                        <ChangeDiff
                          action={change.action}
                          proposed={gd}
                          changeReason={change.changeReason}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {formatAcademicYear(change.academicYear)}{" "}
                        {change.semester}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{change.requestedByName}</p>
                          <Badge
                            className={formatRoleBadge(
                              change.requestedRole
                            )}
                          >
                            {change.requestedRole.replace("_", " ")}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => onApprove(change)}
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
                            onClick={() => onReject(change)}
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
        </CardContent>
      )}
    </Card>
  );
}
