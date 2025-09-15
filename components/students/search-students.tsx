"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function SearchStudent({
  query,
  setSearchQuery,
}:{
  query: string;
  setSearchQuery: (value:string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSearch(value: string) {
    setSearchQuery(value);
  }

  return (
    <div className="w-full md:w-auto flex items-center gap-2 text-xs rounded-full ring-[1.5px] ring-gray-300 px-2">
      <input
        type="text"
        placeholder="Search..."
        className="w-[200px] p-2 bg-transparent outline-none"
        onChange={(e) => handleSearch(e.target.value)}
        value={query}
      />
      <Image src="/search.png" alt="" width={14} height={14} />
    </div>
  );
}
