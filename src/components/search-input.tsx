"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

export function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target;

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
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-white placeholder-zinc-500 focus:border-transparent focus:ring-2 focus:ring-zinc-700 focus:outline-none"
      />
      {isPending && (
        <div className="absolute top-1/2 right-3 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
        </div>
      )}
    </div>
  );
}
