"use client";

import React, { useEffect, useState } from "react";
import { SyncLoader } from "react-spinners";
import UserCardSkeleton from "./skeleton/UserCardSkeleton";

export default function UserCard({ type }: { type: string }) {
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/total-students-admins");
        const data = await response.json();
        if (type === "student") {
          setTotal(data.totalStudents);
        } else if (type === "admin") {
          setTotal(data.totalAdmins);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching totals:", error);
        setLoading(false);
      }
    }

    fetchData();
  }, [type]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 flex-1 min-w-[130px]">
      <div className="flex justify-between items-center">
        <span className="text-[10px] bg-white px-2 py-1 rounded-full text-gray-600">
          {`${new Date().getFullYear()}/${new Date().getFullYear() + 1}`}
        </span>
      </div>
      <div className="flex">
        {loading ? <UserCardSkeleton /> : null}
        <h1 className="text-2xl font-semibold my-4">
          {total !== null ? total : ""}
        </h1>
      </div>
      <h2 className="capitalize text-sm font-medium text-gray-700">{type}s</h2>
    </div>
  );
}
