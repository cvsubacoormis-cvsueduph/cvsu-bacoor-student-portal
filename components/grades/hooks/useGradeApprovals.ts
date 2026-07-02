import { useState, useEffect, useCallback, useMemo } from "react";
import Swal from "sweetalert2";

export type PendingChange = {
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
  changeReason: string | null;
  createdAt: string;
};

function buildDiffHtml(change: PendingChange): string {
  const gd = change.gradeData as Record<string, any>;
  const prev = gd?._previous as Record<string, any> | undefined;

  if (change.action === "DELETE") {
    return `
      <div class="text-left text-sm space-y-2">
        <p><strong class="text-red-600">DELETE:</strong> The following grade will be removed:</p>
        <div class="bg-red-50 border border-red-200 rounded p-2 text-xs space-y-1">
          <p><span class="text-gray-500">Course:</span> ${gd?.courseCode || "—"}</p>
          <p><span class="text-gray-500">Grade:</span> <strong>${gd?.grade || "—"}</strong></p>
          <p><span class="text-gray-500">Credits:</span> ${gd?.creditUnit ?? "—"}</p>
        </div>
        ${change.changeReason ? `<div class="bg-blue-50 border border-blue-200 rounded p-2 text-xs mt-2 text-left"><span class="font-medium text-blue-800">Reason:</span> <span class="text-blue-700">${change.changeReason}</span></div>` : ""}
        <p class="text-xs"><strong>Student:</strong> ${change.studentNumber}</p>
        <p class="text-xs"><strong>Requested by:</strong> ${change.requestedByName}</p>
      </div>`;
  }

  if (change.action === "CREATE") {
    return `
      <div class="text-left text-sm space-y-2">
        <p><strong class="text-green-600">CREATE:</strong> New grade will be added:</p>
        <div class="bg-green-50 border border-green-200 rounded p-2 text-xs space-y-1">
          <p><span class="text-gray-500">Course:</span> ${gd?.courseCode || "—"}</p>
          <p><span class="text-gray-500">Grade:</span> <strong>${gd?.grade || "—"}</strong></p>
          <p><span class="text-gray-500">Credits:</span> ${gd?.creditUnit ?? "—"}</p>
          <p><span class="text-gray-500">Instructor:</span> ${gd?.instructor || "—"}</p>
        </div>
        ${change.changeReason ? `<div class="bg-blue-50 border border-blue-200 rounded p-2 text-xs mt-2 text-left"><span class="font-medium text-blue-800">Reason:</span> <span class="text-blue-700">${change.changeReason}</span></div>` : ""}
        <p class="text-xs"><strong>Student:</strong> ${change.studentNumber}</p>
        <p class="text-xs"><strong>Requested by:</strong> ${change.requestedByName}</p>
      </div>`;
  }

  const fields = [
    { label: "Course Code", prev: prev?.courseCode, next: gd?.courseCode },
    { label: "Credits", prev: prev?.creditUnit, next: gd?.creditUnit },
    { label: "Title", prev: prev?.courseTitle, next: gd?.courseTitle },
    { label: "Grade", prev: prev?.grade, next: gd?.grade },
    { label: "Remarks", prev: prev?.remarks, next: gd?.remarks },
    { label: "Instructor", prev: prev?.instructor, next: gd?.instructor },
  ];
  const changedFields = fields
    .filter((f) => String(f.prev ?? "") !== String(f.next ?? ""))
    .map(
      (f) =>
        `<tr><td class="text-gray-500 pr-3">${f.label}</td><td class="line-through text-gray-400 pr-2">${f.prev ?? "—"}</td><td class="font-medium text-blue-700 bg-blue-50 px-1">${f.next ?? "—"}</td></tr>`,
    )
    .join("");

  return `
    <div class="text-left text-sm space-y-2">
      <p><strong class="text-amber-600">UPDATE:</strong> The following fields will change:</p>
      <table class="text-xs w-full">
        <thead><tr class="text-gray-500"><th>Field</th><th>Current</th><th>Proposed</th></tr></thead>
        <tbody>${changedFields}</tbody>
      </table>
      ${change.changeReason ? `<div class="bg-blue-50 border border-blue-200 rounded p-2 text-xs mt-2 text-left"><span class="font-medium text-blue-800">Reason:</span> <span class="text-blue-700">${change.changeReason}</span></div>` : ""}
      <p class="text-xs mt-3"><strong>Student:</strong> ${change.studentNumber}</p>
      <p class="text-xs"><strong>Requested by:</strong> ${change.requestedByName}</p>
    </div>`;
}

function buildBulkSummaryHtml(
  studentNumber: string,
  changes: PendingChange[]
): string {
  const createCount = changes.filter((c) => c.action === "CREATE").length;
  const updateCount = changes.filter((c) => c.action === "UPDATE").length;
  const deleteCount = changes.filter((c) => c.action === "DELETE").length;

  const parts: string[] = [];
  if (createCount) parts.push(`${createCount} create`);
  if (updateCount) parts.push(`${updateCount} update`);
  if (deleteCount) parts.push(`${deleteCount} delete`);

  return `
    <div class="text-left text-sm space-y-2">
      <p>Approve <strong>all ${changes.length} pending changes</strong> for student <strong>${studentNumber}</strong>?</p>
      <p class="text-xs text-gray-500">${parts.join(", ")}</p>
      <div class="text-xs text-gray-400 mt-2 max-h-40 overflow-y-auto text-left">
        ${changes
          .map(
            (c) =>
              `<p class="py-0.5"><span class="inline-block w-14 font-medium ${
                c.action === "CREATE"
                  ? "text-green-600"
                  : c.action === "UPDATE"
                    ? "text-amber-600"
                    : "text-red-600"
              }">${c.action}</span> ${c.courseCode || (c.gradeData as any)?.courseCode || "—"}</p>`,
          )
          .join("")}
      </div>
    </div>`;
}

export function useGradeApprovals({
  page: externalPage,
  pageSize: externalPageSize,
}: {
  page: number;
  pageSize: number;
}) {
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [processingAll, setProcessingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(
    new Set()
  );
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const buildUrl = useCallback(
    (status: string) => {
      const params = new URLSearchParams({ status });
      params.set("page", String(externalPage));
      params.set("pageSize", String(externalPageSize));
      return `/api/pending-grade-changes?${params.toString()}`;
    },
    [externalPage, externalPageSize]
  );

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const url = buildUrl("PENDING");
      const res = await fetch(url);
      if (!res.ok) {
        let errorMessage = "Failed to fetch pending changes";
        try {
          const body = await res.json();
          if (body?.error) errorMessage = body.error;
        } catch {
          if (res.status === 403)
            errorMessage =
              "You don't have permission to view pending changes.";
          else if (res.status === 500)
            errorMessage = "Server error while fetching pending changes.";
          else errorMessage = `Request failed (status ${res.status})`;
        }
        throw new Error(errorMessage);
      }
      const result = await res.json();
      setPendingChanges(result.data ?? []);
      setTotal(result.total ?? 0);
      setTotalPages(result.totalPages ?? 0);
    } catch (err: any) {
      setError(err.message || "Failed to load pending changes");
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  const silentPoll = useCallback(async () => {
    try {
      const url = buildUrl("PENDING");
      const res = await fetch(url);
      if (res.ok) {
        const result = await res.json();
        setPendingChanges(result.data ?? []);
        setTotal(result.total ?? 0);
        setTotalPages(result.totalPages ?? 0);
        setError("");
      }
    } catch {
      // Ignore poll errors
    }
  }, [buildUrl]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    const interval = setInterval(silentPoll, 10000);
    return () => clearInterval(interval);
  }, [silentPoll]);

  const groupedChanges = useMemo(() => {
    const groups: Record<string, PendingChange[]> = {};
    for (const change of pendingChanges) {
      if (!groups[change.studentNumber]) {
        groups[change.studentNumber] = [];
      }
      groups[change.studentNumber].push(change);
    }
    return groups;
  }, [pendingChanges]);

  const filteredStudentNumbers = useMemo(() => {
    const all = Object.keys(groupedChanges).sort();
    if (!searchQuery.trim()) return all;
    const q = searchQuery.trim().toLowerCase();
    return all.filter((sn) => {
      if (sn.toLowerCase().includes(q)) return true;
      return groupedChanges[sn].some(
        (c) =>
          (c.courseCode || "").toLowerCase().includes(q) ||
          String(c.gradeData?.courseTitle || "").toLowerCase().includes(q) ||
          (c.gradeData?.courseCode as string)?.toLowerCase().includes(q)
      );
    });
  }, [groupedChanges, searchQuery]);

  const handleApprove = useCallback(async (change: PendingChange) => {
    const result = await Swal.fire({
      title: "Approve this change?",
      html: buildDiffHtml(change),
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Approve",
      confirmButtonColor: "#16a34a",
    });

    if (!result.isConfirmed) return;

    const id = change.id;
    setProcessingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/pending-grade-changes/${id}`, {
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

      setPendingChanges((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Approval Failed",
        text: err.message,
      });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const handleBulkApprove = useCallback(
    async (studentNumber: string) => {
      const changes = groupedChanges[studentNumber];
      if (!changes || changes.length === 0) return;

      const result = await Swal.fire({
        title: "Bulk Approve",
        html: buildBulkSummaryHtml(studentNumber, changes),
        icon: "question",
        showCancelButton: true,
        confirmButtonText: `Approve All (${changes.length})`,
        confirmButtonColor: "#16a34a",
      });

      if (!result.isConfirmed) return;

      const ids = changes.map((c) => c.id);
      setProcessingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });

      try {
        const res = await fetch("/api/pending-grade-changes/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "APPROVE", ids }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Bulk approval failed");
        }

        const data = await res.json();

        const succeeded =
          data.results?.filter((r: any) => r.success).length ??
          changes.length;
        const failed =
          data.results?.filter((r: any) => !r.success).length ?? 0;

        if (failed > 0) {
          Swal.fire({
            icon: "warning",
            title: "Partially Approved",
            text: `${succeeded} approved, ${failed} failed.`,
            timer: 3000,
            showConfirmButton: false,
          });
        } else {
          Swal.fire({
            icon: "success",
            title: "All Approved",
            text: `${succeeded} changes applied for student ${studentNumber}.`,
            timer: 2000,
            showConfirmButton: false,
          });
        }

        setPendingChanges((prev) =>
          prev.filter((c) => !ids.includes(c.id))
        );
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "Bulk Approval Failed",
          text: err.message,
        });
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }
    },
    [groupedChanges]
  );

  const handleReject = useCallback(async (change: PendingChange) => {
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

    const id = change.id;
    setProcessingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/pending-grade-changes/${id}`, {
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

      setPendingChanges((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Rejection Failed",
        text: err.message,
      });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const handleApproveAll = useCallback(async () => {
    // Fetch ALL pending changes across all pages
    let allChanges: PendingChange[];
    try {
      setProcessingAll(true);
      const fetchRes = await fetch(
        "/api/pending-grade-changes?status=PENDING&page=1&pageSize=10000"
      );
      if (!fetchRes.ok) {
        const err = await fetchRes.json();
        throw new Error(err.error || "Failed to fetch pending changes");
      }
      const result = await fetchRes.json();
      allChanges = result.data ?? [];
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Fetch Failed",
        text: err.message,
      });
      setProcessingAll(false);
      return;
    }

    if (allChanges.length === 0) {
      Swal.fire({
        icon: "info",
        title: "No Pending Changes",
        text: "There are no pending changes to approve.",
        timer: 2000,
        showConfirmButton: false,
      });
      setProcessingAll(false);
      return;
    }

    const createCount = allChanges.filter((c) => c.action === "CREATE").length;
    const updateCount = allChanges.filter((c) => c.action === "UPDATE").length;
    const deleteCount = allChanges.filter((c) => c.action === "DELETE").length;
    const studentCount = new Set(allChanges.map((c) => c.studentNumber)).size;

    const parts: string[] = [];
    if (createCount) parts.push(`${createCount} create`);
    if (updateCount) parts.push(`${updateCount} update`);
    if (deleteCount) parts.push(`${deleteCount} delete`);

    const confirmResult = await Swal.fire({
      title: "Approve All Pending Changes?",
      html: `
        <div class="text-left text-sm space-y-2">
          <p>This will approve <strong>all ${allChanges.length} pending changes</strong> across <strong>${studentCount} student(s)</strong>.</p>
          <p class="text-xs text-gray-500">${parts.join(", ")}</p>
          <p class="text-xs text-amber-600 font-medium mt-2">This action cannot be undone.</p>
        </div>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: `Yes, Approve All (${allChanges.length})`,
      confirmButtonColor: "#16a34a",
      cancelButtonText: "Cancel",
    });

    if (!confirmResult.isConfirmed) {
      setProcessingAll(false);
      return;
    }

    const ids = allChanges.map((c) => c.id);
    setProcessingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });

    try {
      const res = await fetch("/api/pending-grade-changes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", ids }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Bulk approval failed");
      }

      const data = await res.json();

      const succeeded =
        data.results?.filter((r: any) => r.success).length ?? 0;
      const failed =
        data.results?.filter((r: any) => !r.success).length ?? 0;

      if (failed > 0) {
        Swal.fire({
          icon: "warning",
          title: "Partially Approved",
          text: `${succeeded} approved, ${failed} failed out of ${allChanges.length} total.`,
          timer: 4000,
          showConfirmButton: true,
        });
      } else {
        Swal.fire({
          icon: "success",
          title: "All Approved",
          text: `All ${succeeded} pending changes have been approved successfully.`,
          timer: 2000,
          showConfirmButton: false,
        });
      }

      // Remove all successfully approved changes from the list
      const approvedIds = new Set(
        data.results
          ?.filter((r: any) => r.success)
          .map((r: any) => r.id) ?? []
      );
      setPendingChanges((prev) =>
        prev.filter((c) => !approvedIds.has(c.id))
      );
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Approval Failed",
        text: err.message,
      });
    } finally {
      setProcessingAll(false);
      setProcessingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, []);

  const toggleStudent = useCallback((studentNumber: string) => {
    setExpandedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(studentNumber)) {
        next.delete(studentNumber);
      } else {
        next.add(studentNumber);
      }
      return next;
    });
  }, []);

  return {
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
    total,
    totalPages,
  };
}
