import { db } from "./db";

export interface Bookmark {
  id: string;
  url: string;
  title: string | null;
  source_type: string | null;
  note: string | null;
  save_count: number;
  created_at: number;
  saved_at: number;
}

export interface ReviewSection {
  name: string;
  bookmarks: Bookmark[];
}

const REVIEW_PERIODS = [
  { name: "This week", startDays: 0, endDays: 7, limit: 10 },
  { name: "This month", startDays: 7, endDays: 30, limit: 5 },
  { name: "3 months ago", startDays: 30, endDays: 90, limit: 5 },
  { name: "Older", startDays: 90, endDays: 365, limit: 5 },
];

export async function getReviewItems(userId: string): Promise<ReviewSection[]> {
  const now = Date.now();
  const sections: ReviewSection[] = [];

  for (const period of REVIEW_PERIODS) {
    const result = await db.execute({
      sql: `
        SELECT id, url, title, source_type, note, save_count, created_at, saved_at
        FROM bookmarks
        WHERE user_id = ?
          AND archived_at IS NULL
          AND (last_reviewed_at IS NULL OR last_reviewed_at < ?)
          AND created_at BETWEEN ? AND ?
        ORDER BY save_count DESC, saved_at DESC
        LIMIT ?
      `,
      args: [
        userId,
        now - 7 * 86400000, // Only show if not reviewed in last week
        now - period.endDays * 86400000,
        now - period.startDays * 86400000,
        period.limit,
      ],
    });

    sections.push({
      name: period.name,
      bookmarks: result.rows as unknown as Bookmark[],
    });
  }

  return sections;
}

export async function getAllBookmarks(userId: string): Promise<Bookmark[]> {
  const result = await db.execute({
    sql: `
      SELECT id, url, title, source_type, note, save_count, created_at, saved_at
      FROM bookmarks
      WHERE user_id = ?
        AND archived_at IS NULL
      ORDER BY save_count DESC, saved_at DESC
      LIMIT 100
    `,
    args: [userId],
  });

  return result.rows as unknown as Bookmark[];
}

export async function searchBookmarks(
  userId: string,
  query: string
): Promise<Bookmark[]> {
  const result = await db.execute({
    sql: `
      SELECT b.id, b.url, b.title, b.source_type, b.note, b.save_count, b.created_at, b.saved_at
      FROM bookmarks_fts
      JOIN bookmarks b ON bookmarks_fts.rowid = b.rowid
      WHERE bookmarks_fts MATCH ?
        AND b.user_id = ?
        AND b.archived_at IS NULL
      ORDER BY bm25(bookmarks_fts)
      LIMIT 50
    `,
    args: [query, userId],
  });

  return result.rows as unknown as Bookmark[];
}
