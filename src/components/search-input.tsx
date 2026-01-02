"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

export function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      startTransition(() => {
        if (value) {
          router.push(`/?q=${encodeURIComponent(value)}`);
        } else {
          router.push("/");
        }
      });
    },
    [router]
  );

  return (
    <div className="relative">
      <input
        type="search"
        placeholder="Search bookmarks..."
        defaultValue={searchParams.get("q") ?? ""}
        onChange={handleSearch}
        className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:border-transparent"
      />
      {isPending && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
