"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";

export default function SearchStudent({
  query,
  setSearchQuery,
}: {
  query: string;
  setSearchQuery: (value: string) => void;
}) {
  const [localQuery, setLocalQuery] = useState(query);
  const [debouncedQuery] = useDebounce(localQuery, 300);

  // Keep the callback in a ref so the debounce is not reset by parent renders.
  const setSearchQueryRef = useRef(setSearchQuery);
  setSearchQueryRef.current = setSearchQuery;
  const lastCommittedRef = useRef(query);

  // Sync from the parent only when the change did not originate here, so a
  // debounced update can't clobber what the user is currently typing.
  useEffect(() => {
    if (query !== lastCommittedRef.current) {
      lastCommittedRef.current = query;
      setLocalQuery(query);
    }
  }, [query]);

  // Commit the debounced term exactly once per pause.
  useEffect(() => {
    if (debouncedQuery === lastCommittedRef.current) return;
    lastCommittedRef.current = debouncedQuery;
    setSearchQueryRef.current(debouncedQuery);
  }, [debouncedQuery]);

  return (
    <div className="relative w-full md:w-auto">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search..."
        className="w-full pl-8 md:w-[200px] lg:w-[300px]"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
      />
    </div>
  );
}
