import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { Suspense } from "react";
import { BookmarkForm } from "@/components/bookmark-form";
import { ReviewSection } from "@/components/review-section";
import { SearchInput } from "@/components/search-input";
import { BookmarkCard } from "@/components/bookmark-card";
import { getReviewItems, searchBookmarks, getAllBookmarks } from "@/lib/review";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

async function BookmarkList({ query }: { query?: string }) {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  if (query) {
    const bookmarks = await searchBookmarks(userId, query);
    if (bookmarks.length === 0) {
      return (
        <p className="py-8 text-center text-zinc-500">
          No bookmarks found for &ldquo;{query}&rdquo;
        </p>
      );
    }
    return (
      <div className="space-y-2">
        <p className="mb-4 text-sm text-zinc-500">
          {bookmarks.length} result{bookmarks.length === 1 ? "" : "s"} for
          &ldquo;{query}&rdquo;
        </p>
        {bookmarks.map((bookmark) => (
          <BookmarkCard key={bookmark.id} bookmark={bookmark} />
        ))}
      </div>
    );
  }

  const sections = await getReviewItems(userId);
  const hasAnyBookmarks = sections.some((s) => s.bookmarks.length > 0);

  if (!hasAnyBookmarks) {
    // Check if user has any bookmarks at all
    const allBookmarks = await getAllBookmarks(userId);
    if (allBookmarks.length === 0) {
      return (
        <div className="py-12 text-center">
          <p className="mb-2 text-zinc-400">No bookmarks yet</p>
          <p className="text-sm text-zinc-500">
            Paste a URL above to save your first bookmark
          </p>
        </div>
      );
    }
    return (
      <div className="py-12 text-center">
        <p className="mb-2 text-2xl">✨</p>
        <p className="text-zinc-400">All caught up!</p>
        <p className="mt-1 text-sm text-zinc-500">
          No bookmarks need review right now
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <ReviewSection key={section.name} section={section} />
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900"
        />
      ))}
    </div>
  );
}

export default async function Home({ searchParams }: PageProps) {
  const { userId } = await auth();
  const { q } = await searchParams;

  if (!userId) {
    return (
      <div className="py-16 text-center">
        <h2 className="mb-4 text-2xl font-bold">Welcome to Facet</h2>
        <p className="mx-auto mb-6 max-w-md text-zinc-400">
          A personal bookmarking system that resurfaces your saved content
          through time-based review.
        </p>
        <SignInButton mode="modal">
          <button className="rounded-lg bg-white px-6 py-3 font-medium text-black transition-colors hover:bg-zinc-200">
            Get started
          </button>
        </SignInButton>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BookmarkForm />

      <Suspense fallback={null}>
        <SearchInput />
      </Suspense>

      <Suspense fallback={<LoadingState />}>
        <BookmarkList query={q} />
      </Suspense>
    </div>
  );
}
