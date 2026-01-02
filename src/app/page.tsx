import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { Suspense } from "react";
import { BookmarkForm } from "@/components/bookmark-form";
import { ReviewSection } from "@/components/review-section";
import { SearchInput } from "@/components/search-input";
import { BookmarkCard } from "@/components/bookmark-card";
import {
  getReviewItems,
  searchBookmarks,
  getAllBookmarks,
} from "@/lib/review";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

async function BookmarkList({ query }: { query?: string }) {
  const { userId } = await auth();
  if (!userId) return null;

  if (query) {
    const bookmarks = await searchBookmarks(userId, query);
    if (bookmarks.length === 0) {
      return (
        <p className="text-center text-zinc-500 py-8">
          No bookmarks found for &ldquo;{query}&rdquo;
        </p>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-sm text-zinc-500 mb-4">
          {bookmarks.length} result{bookmarks.length !== 1 ? "s" : ""} for
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
        <div className="text-center py-12">
          <p className="text-zinc-400 mb-2">No bookmarks yet</p>
          <p className="text-sm text-zinc-500">
            Paste a URL above to save your first bookmark
          </p>
        </div>
      );
    }
    return (
      <div className="text-center py-12">
        <p className="text-2xl mb-2">✨</p>
        <p className="text-zinc-400">All caught up!</p>
        <p className="text-sm text-zinc-500 mt-1">
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
          className="h-24 bg-zinc-900 rounded-lg animate-pulse border border-zinc-800"
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
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Welcome to Facet</h2>
        <p className="text-zinc-400 mb-6 max-w-md mx-auto">
          A personal bookmarking system that resurfaces your saved content
          through time-based review.
        </p>
        <SignInButton mode="modal">
          <button className="px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 transition-colors">
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
