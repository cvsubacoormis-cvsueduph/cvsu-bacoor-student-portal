"use client";

import { revokeCogVerification } from "@/actions/cog-verification";
import { BanIcon } from "lucide-react";

export function RevokeForm({ hash }: { hash: string }) {
  return (
    <form
      action={async () => {
        await revokeCogVerification(hash);
      }}
    >
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
        onClick={(e) => {
          if (!confirm("Are you sure you want to revoke this verification? This cannot be undone.")) {
            e.preventDefault();
          }
        }}
      >
        <BanIcon className="w-3.5 h-3.5" /> Revoke Verification
      </button>
    </form>
  );
}
