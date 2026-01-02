import type { ReviewSection as ReviewSectionType } from "@/lib/review";
import { BookmarkCard } from "./bookmark-card";

interface ReviewSectionProps {
  section: ReviewSectionType;
}

export function ReviewSection({ section }: ReviewSectionProps) {
  if (section.bookmarks.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-zinc-300">{section.name}</h2>
      <div className="space-y-2">
        {section.bookmarks.map((bookmark) => (
          <BookmarkCard key={bookmark.id} bookmark={bookmark} />
        ))}
      </div>
    </section>
  );
}
