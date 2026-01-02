"use server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { normalizeBookmarkUrl, hashUrl } from "@/lib/url";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

export async function createBookmark(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const url = formData.get("url") as string;
  const note = formData.get("note") as string | null;

  if (!url) throw new Error("URL is required");

  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }

  const normalized = normalizeBookmarkUrl(url);
  const urlHash = hashUrl(normalized);

  // Check for duplicate
  const existing = await db.execute({
    sql: "SELECT id, save_count FROM bookmarks WHERE user_id = ? AND url_hash = ?",
    args: [userId, urlHash],
  });

  if (existing.rows.length > 0) {
    // Increment save_count
    await db.execute({
      sql: "UPDATE bookmarks SET save_count = save_count + 1, saved_at = ?, note = COALESCE(?, note) WHERE id = ?",
      args: [Date.now(), note, existing.rows[0].id],
    });
    revalidatePath("/");
    return {
      duplicate: true,
      id: existing.rows[0].id as string,
      saveCount: (existing.rows[0].save_count as number) + 1,
    };
  }

  // Create new bookmark
  const id = nanoid();
  await db.execute({
    sql: `INSERT INTO bookmarks (id, url, url_hash, note, user_id, created_at, saved_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, url, urlHash, note, userId, Date.now(), Date.now()],
  });

  revalidatePath("/");
  return { duplicate: false, id, saveCount: 1 };
}

export async function markReviewed(bookmarkId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db.execute({
    sql: "UPDATE bookmarks SET last_reviewed_at = ? WHERE id = ? AND user_id = ?",
    args: [Date.now(), bookmarkId, userId],
  });

  revalidatePath("/");
}

export async function archiveBookmark(bookmarkId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db.execute({
    sql: "UPDATE bookmarks SET archived_at = ? WHERE id = ? AND user_id = ?",
    args: [Date.now(), bookmarkId, userId],
  });

  revalidatePath("/");
}

export async function unarchiveBookmark(bookmarkId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db.execute({
    sql: "UPDATE bookmarks SET archived_at = NULL WHERE id = ? AND user_id = ?",
    args: [bookmarkId, userId],
  });

  revalidatePath("/");
}

export async function deleteBookmark(bookmarkId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db.execute({
    sql: "DELETE FROM bookmarks WHERE id = ? AND user_id = ?",
    args: [bookmarkId, userId],
  });

  revalidatePath("/");
}
