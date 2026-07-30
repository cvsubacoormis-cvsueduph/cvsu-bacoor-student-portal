"use client";

import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@clerk/nextjs";

export function PendingApprovalBadge() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const [count, setCount] = useState<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const check = async () => {
      if (!role || !["admin", "superuser", "registrar"].includes(role)) return;
      try {
        const res = await fetch("/api/pending-grade-changes?status=PENDING");
        if (res.ok) {
          const data = await res.json();
          const newCount = data.total ?? 0;
          setCount(newCount);

          // Start polling when there are pending changes
          if (newCount > 0 && !intervalRef.current) {
            intervalRef.current = setInterval(check, 60000);
          }
          // Stop polling when no pending changes remain
          if (newCount === 0 && intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch {
        // Silently ignore
      }
    };

    // Always check once on mount
    check();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [role]);

  if (count === 0) return null;

  return (
    <Badge className="bg-red-500 hover:bg-red-600 text-white text-[10px] px-1.5 py-0 min-w-[18px] flex items-center justify-center rounded-full">
      {count}
    </Badge>
  );
}
