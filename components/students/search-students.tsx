"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function SearchStudent({
  query,
  setSearchQuery,
}: {
  query: string;
  setSearchQuery: (value: string) => void;
}) {
  return (
    <div className="relative w-full md:w-auto">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search..."
        className="w-full pl-8 md:w-[200px] lg:w-[300px]"
        value={query}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
  );
}
