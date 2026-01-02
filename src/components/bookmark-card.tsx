"use client";

import { markReviewed, archiveBookmark, deleteBookmark } from "@/app/actions";
import type { Bookmark } from "@/lib/review";
import { useTransition } from "react";

interface BookmarkCardProps {
  bookmark: Bookmark;
}

function getSourceIcon(sourceType: string | null) {
  switch (sourceType) {
    case "twitter":
      return "𝕏";
    case "github":
      return "⌘";
    case "video":
      return "▶";
    default:
      return "◉";
  }
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export function BookmarkCard({ bookmark }: BookmarkCardProps) {
  const [isPending, startTransition] = useTransition();

  const handleReviewed = () => {
    startTransition(() => {
      markReviewed(bookmark.id);
    });
  };

  const handleArchive = () => {
    startTransition(() => {
      archiveBookmark(bookmark.id);
    });
  };

  const handleDelete = () => {
    if (confirm("Delete this bookmark?")) {
      startTransition(() => {
        deleteBookmark(bookmark.id);
      });
    }
  };

  return (
    <div
      className={`group p-4 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors ${isPending ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg" title={bookmark.source_type || "article"}>
          {getSourceIcon(bookmark.source_type)}
        </span>

        <div className="flex-1 min-w-0">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <h3 className="text-white font-medium truncate hover:text-zinc-300">
              {bookmark.title || getDomain(bookmark.url)}
            </h3>
            <p className="text-sm text-zinc-500 truncate">
              {getDomain(bookmark.url)}
            </p>
          </a>

          {bookmark.note && (
            <p className="mt-2 text-sm text-zinc-400 italic">
              &ldquo;{bookmark.note}&rdquo;
            </p>
          )}

          <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
            <span>{formatDate(bookmark.saved_at)}</span>
            {bookmark.save_count > 1 && (
              <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                ×{bookmark.save_count}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleReviewed}
          disabled={isPending}
          className="px-3 py-1 text-xs bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          Reviewed
        </button>
        <button
          onClick={handleArchive}
          disabled={isPending}
          className="px-3 py-1 text-xs bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          Archive
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="px-3 py-1 text-xs bg-zinc-800 text-red-400 rounded hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
