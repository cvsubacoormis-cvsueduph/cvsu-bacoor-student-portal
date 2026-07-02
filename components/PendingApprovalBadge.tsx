"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@clerk/nextjs";

export function PendingApprovalBadge() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const [count, setCount] = useState<number>(0);

  const fetchCount = useCallback(async () => {
    if (!role || !["admin", "superuser", "registrar"].includes(role)) return;
    try {
      const res = await fetch("/api/pending-grade-changes?status=PENDING");
      if (res.ok) {
        const data = await res.json();
        setCount(data.total ?? 0);
      }
    } catch {
      // Silently ignore
    }
  }, [role]);

  useEffect(() => {
    fetchCount();
    // Poll every 15 seconds
    const interval = setInterval(fetchCount, 15000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  if (count === 0) return null;

  return (
    <Badge className="ml-auto bg-red-500 hover:bg-red-600 text-white text-[10px] px-1.5 py-0 min-w-[18px] flex items-center justify-center rounded-full">
      {count}
    </Badge>
  );
}
