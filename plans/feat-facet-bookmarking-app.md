# feat: Facet - Personal Bookmarking App (Simplified)

## Overview

Build a personal bookmarking system that resurfaces saved content through time-based review, with duplicate detection as a priority signal.

**Key Differentiator**: Unlike passive bookmark managers, Facet surfaces forgotten content at configurable intervals, prioritizing items you've saved multiple times.

## Problem Statement

Traditional bookmarking fails because:

-  You can't search for what you've forgotten you saved
-  Context changes over time, making old bookmarks relevant again
-  No mechanism prompts revisiting saved content
-  Duplicates are treated as errors, not signals

## Proposed Solution (MVP)

A minimal Next.js application with:

1. **Single-page review interface** - Surfaces unreviewed bookmarks by time period
2. **Duplicate detection** - Multiple saves increase priority via `save_count`
3. **Full-text search** - FTS5 handles personal-scale search needs
4. **Content extraction** - Jina Reader for all sources (with fallback)

---

## Technical Approach

### Architecture (Simplified)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js 16 App                          │
├─────────────────────────────────────────────────────────────────┤
│  Single Page                  │  API Route (future external)    │
│  - / (Review + Search + Add)  │  - POST /api/bookmarks          │
├─────────────────────────────────────────────────────────────────┤
│                      Server Actions                              │
│  - createBookmark()  - markReviewed()  - archiveBookmark()      │
├─────────────────────────────────────────────────────────────────┤
│                      Inline Functions                            │
│  - normalizeUrl()    - extractContent()  - searchBookmarks()    │
├─────────────────────────────────────────────────────────────────┤
│                      External Services                           │
│  - Turso (SQLite + FTS5)     - Clerk Auth    - Jina Reader      │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack (Minimal)

| Component          | Technology              | Rationale                               |
| ------------------ | ----------------------- | --------------------------------------- |
| Framework          | Next.js 16 (App Router) | Server Components, Server Actions       |
| Database           | Turso (libSQL)          | SQLite with FTS5, edge-ready            |
| Auth               | Clerk                   | Fast setup, handles multi-device access |
| Content Extraction | Jina Reader API         | Clean markdown output                   |
| UI                 | Tailwind CSS            | Simple, no component library needed     |

**Removed from original plan:**

-  ~~OpenAI Embeddings~~ - FTS5 sufficient for personal scale
-  ~~Upstash Ratelimit~~ - Unnecessary for single user
-  ~~shadcn/ui~~ - Vanilla Tailwind is enough for MVP

### Database Schema (2 Tables)

```sql
-- Main bookmarks table (simplified)
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  title TEXT,
  content TEXT,
  source_type TEXT CHECK(source_type IN ('twitter', 'article', 'github', 'video', 'other')),
  note TEXT,
  save_count INTEGER DEFAULT 1,
  last_reviewed_at INTEGER,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  saved_at INTEGER NOT NULL,
  user_id TEXT NOT NULL,

  UNIQUE(user_id, url_hash)  -- Prevents duplicate URLs per user
);

-- Indexes for common queries
CREATE INDEX idx_bookmarks_user_archived ON bookmarks(user_id, archived_at);
CREATE INDEX idx_bookmarks_review ON bookmarks(user_id, archived_at, last_reviewed_at, created_at);

-- FTS5 for full-text search
CREATE VIRTUAL TABLE bookmarks_fts USING fts5(
  title, content,
  content='bookmarks',
  content_rowid='rowid',
  prefix='2 3'
);

-- Sync triggers (all three required)
CREATE TRIGGER bookmarks_ai AFTER INSERT ON bookmarks BEGIN
  INSERT INTO bookmarks_fts(rowid, title, content)
  VALUES (new.rowid, new.title, new.content);
END;

CREATE TRIGGER bookmarks_au AFTER UPDATE ON bookmarks BEGIN
  INSERT INTO bookmarks_fts(bookmarks_fts, rowid, title, content)
  VALUES('delete', old.rowid, old.title, old.content);
  INSERT INTO bookmarks_fts(rowid, title, content)
  VALUES (new.rowid, new.title, new.content);
END;

CREATE TRIGGER bookmarks_ad AFTER DELETE ON bookmarks BEGIN
  INSERT INTO bookmarks_fts(bookmarks_fts, rowid, title, content)
  VALUES('delete', old.rowid, old.title, old.content);
END;
```

**What changed:**

-  Single `bookmarks` table instead of 6 tables
-  `save_count` integer replaces `bookmark_saves` table
-  `last_reviewed_at` timestamp replaces `reviews` table
-  Removed `tags`, `bookmark_tags`, `settings` tables
-  Added proper UNIQUE constraint for duplicate detection
-  Added all three FTS5 sync triggers

---

## Implementation Phases

### Phase 1: Core Infrastructure + CRUD (1-2 days)

**Goal**: Working app that can save and display bookmarks.

#### Tasks

-  [ ] Initialize Next.js 16 project

   ```bash
   npx create-next-app@latest facet --typescript --tailwind --eslint --app --src-dir
   ```

-  [ ] Configure Turso database

   ```typescript
   // lib/db.ts
   import { createClient } from "@libsql/client";

   export const db = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
   });
   ```

-  [ ] Set up Clerk authentication

   ```typescript
   // middleware.ts
   import { clerkMiddleware } from "@clerk/nextjs/server";
   export default clerkMiddleware();
   ```

-  [ ] Create database schema (run SQL above)

-  [ ] Create URL normalization function

   ```typescript
   // lib/url.ts
   import normalizeUrl from "normalize-url";
   import crypto from "crypto";

   const TRACKING_PARAMS = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "ref",
      "source",
   ];

   export function normalizeBookmarkUrl(url: string): string {
      return normalizeUrl(url, {
         stripWWW: true,
         stripHash: true,
         removeTrailingSlash: true,
         removeQueryParameters: TRACKING_PARAMS,
         sortQueryParameters: true,
         forceHttps: true,
      });
   }

   export function hashUrl(normalizedUrl: string): string {
      return crypto.createHash("sha256").update(normalizedUrl).digest("hex");
   }
   ```

-  [ ] Create bookmark Server Actions

   ```typescript
   // app/actions.ts
   "use server";
   import { auth } from "@clerk/nextjs/server";
   import { db } from "@/lib/db";
   import { normalizeBookmarkUrl, hashUrl } from "@/lib/url";
   import { nanoid } from "nanoid";

   export async function createBookmark(formData: FormData) {
      const { userId } = await auth();
      if (!userId) throw new Error("Unauthorized");

      const url = formData.get("url") as string;
      const note = formData.get("note") as string | null;

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
         return {
            duplicate: true,
            id: existing.rows[0].id,
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

      return { duplicate: false, id, saveCount: 1 };
   }

   export async function markReviewed(bookmarkId: string) {
      const { userId } = await auth();
      if (!userId) throw new Error("Unauthorized");

      await db.execute({
         sql: "UPDATE bookmarks SET last_reviewed_at = ? WHERE id = ? AND user_id = ?",
         args: [Date.now(), bookmarkId, userId],
      });
   }

   export async function archiveBookmark(bookmarkId: string) {
      const { userId } = await auth();
      if (!userId) throw new Error("Unauthorized");

      await db.execute({
         sql: "UPDATE bookmarks SET archived_at = ? WHERE id = ? AND user_id = ?",
         args: [Date.now(), bookmarkId, userId],
      });
   }

   export async function deleteBookmark(bookmarkId: string) {
      const { userId } = await auth();
      if (!userId) throw new Error("Unauthorized");

      await db.execute({
         sql: "DELETE FROM bookmarks WHERE id = ? AND user_id = ?",
         args: [bookmarkId, userId],
      });
   }
   ```

-  [ ] Build single-page UI with:
   -  Add bookmark form (URL + optional note)
   -  Review sections by time period (hardcoded: 1 week, 1 month, 3 months, older)
   -  Search input
   -  Bookmark cards with actions

#### Files to Create

```
src/
  app/
    layout.tsx
    page.tsx
    actions.ts
  lib/
    db.ts
    url.ts
  components/
    bookmark-form.tsx
    bookmark-card.tsx
    review-section.tsx
    search-input.tsx
middleware.ts
.env.example
```

---

### Phase 2: Content Extraction + Search (1 day)

**Goal**: Extract content from URLs and enable full-text search.

#### Tasks

-  [ ] Create content extraction function

   ```typescript
   // lib/extract.ts
   export async function extractContent(
      url: string
   ): Promise<{ title: string; content: string; sourceType: string }> {
      const hostname = new URL(url).hostname;
      const sourceType = detectSourceType(hostname);

      try {
         // Use Jina Reader for everything
         const response = await fetch(`https://r.jina.ai/${url}`, {
            headers: {
               Authorization: `Bearer ${process.env.JINA_API_KEY}`,
               Accept: "application/json",
            },
         });

         if (!response.ok) throw new Error("Jina failed");

         const data = await response.json();
         return {
            title: data.title || "",
            content: (data.content || "").slice(0, 50000), // Limit content size
            sourceType,
         };
      } catch {
         // Fallback: just use URL as title
         return { title: url, content: "", sourceType };
      }
   }

   function detectSourceType(hostname: string): string {
      if (hostname.includes("twitter.com") || hostname.includes("x.com"))
         return "twitter";
      if (hostname.includes("github.com")) return "github";
      if (hostname.includes("youtube.com") || hostname.includes("youtu.be"))
         return "video";
      return "article";
   }
   ```

-  [ ] Integrate extraction into bookmark creation

   ```typescript
   // Update createBookmark action
   export async function createBookmark(formData: FormData) {
      // ... existing code ...

      // Create new bookmark (minimal)
      const id = nanoid();
      await db.execute({
         sql: `INSERT INTO bookmarks (id, url, url_hash, note, user_id, created_at, saved_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
         args: [id, url, urlHash, note, userId, Date.now(), Date.now()],
      });

      // Extract content asynchronously (don't block response)
      extractAndUpdate(id, url);

      return { duplicate: false, id, saveCount: 1 };
   }

   async function extractAndUpdate(bookmarkId: string, url: string) {
      try {
         const { title, content, sourceType } = await extractContent(url);
         await db.execute({
            sql: "UPDATE bookmarks SET title = ?, content = ?, source_type = ? WHERE id = ?",
            args: [title, content, sourceType, bookmarkId],
         });
      } catch (error) {
         console.error("Extraction failed:", error);
      }
   }
   ```

-  [ ] Create search function

   ```typescript
   // lib/search.ts
   export async function searchBookmarks(userId: string, query: string) {
      const result = await db.execute({
         sql: `
         SELECT b.id, b.url, b.title, b.source_type, b.save_count, b.created_at,
                highlight(bookmarks_fts, 0, '<mark>', '</mark>') as highlighted_title,
                snippet(bookmarks_fts, 1, '<mark>', '</mark>', '...', 32) as snippet
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
      return result.rows;
   }
   ```

-  [ ] Create review query function

   ```typescript
   // lib/review.ts
   const REVIEW_PERIODS = [
      { name: "This week", startDays: 0, endDays: 7, limit: 10 },
      { name: "This month", startDays: 7, endDays: 30, limit: 5 },
      { name: "3 months ago", startDays: 30, endDays: 90, limit: 5 },
      { name: "Older", startDays: 90, endDays: 365, limit: 5 },
   ];

   export async function getReviewItems(userId: string) {
      const now = Date.now();
      const sections = [];

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
            bookmarks: result.rows,
         });
      }

      return sections;
   }
   ```

-  [ ] Add search UI to main page

#### Files to Create/Update

```
src/
  lib/
    extract.ts
    search.ts
    review.ts
  app/
    page.tsx (update with search)
```

---

### Phase 3: Polish (1 day)

**Goal**: Mobile-friendly, error handling, basic optimizations.

#### Tasks

-  [ ] Make UI responsive

   -  Mobile-first card layout
   -  Touch-friendly tap targets (44px minimum)
   -  Collapsible review sections on mobile

-  [ ] Add loading states

   -  Skeleton cards while loading
   -  Spinner on form submission
   -  Optimistic UI for review actions

-  [ ] Add error handling

   -  Form validation (valid URL check)
   -  Error toasts for failed actions
   -  Graceful fallback if extraction fails

-  [ ] Add "All caught up!" state when no reviews pending

-  [ ] Add basic meta tags

#### Files to Update

```
src/
  app/
    page.tsx
    layout.tsx
  components/
    bookmark-card.tsx (add loading state)
    bookmark-form.tsx (add validation)
```

---

## User Flows

### Saving a Bookmark

```
1. User enters URL → Normalize → Hash
2. Check if hash exists for user
   - Yes: Increment save_count, update saved_at, return "Saved again (×N)"
   - No: Insert minimal record, return "Saved!", extract content async
3. Content extraction runs in background, updates title/content
```

### Reviewing Bookmarks

```
1. Load page → Query each time period
2. Show bookmarks sorted by save_count DESC, then saved_at DESC
3. User clicks "Reviewed" → Update last_reviewed_at
4. Card disappears from current view (optimistic)
```

### Searching

```
1. User types query → Debounce 300ms
2. FTS5 search with BM25 ranking
3. Show results with highlighted matches
4. Clear search returns to review view
```

---

## Edge Cases

| Case                           | Handling                                      |
| ------------------------------ | --------------------------------------------- |
| Invalid URL                    | Form validation, show error message           |
| Duplicate URL                  | Increment save_count, show "Already saved ×N" |
| Content extraction fails       | Store bookmark anyway, show URL as title      |
| No bookmarks in period         | Show "All caught up!" message                 |
| User archives then un-archives | Clear archived_at timestamp                   |

---

## What's Deferred (Future Enhancements)

These are explicitly **not** in MVP:

1. **Vector/semantic search** - Add if FTS5 proves insufficient
2. **Auto-tagging** - Add if manual organization becomes painful
3. **Configurable review periods** - Hardcode works fine initially
4. **Raycast extension** - Add API route later if needed
5. **iOS Shortcut** - Same as above
6. **Migration from Tana** - Write script when needed
7. **Settings page** - No settings needed yet
8. **Rate limiting** - Single user doesn't need it

---

## Acceptance Criteria (MVP)

-  [ ] User can save a URL with optional note
-  [ ] Duplicate URLs increment save_count instead of creating new record
-  [ ] Landing page shows bookmarks grouped by time period
-  [ ] Multi-saved bookmarks (high save_count) appear first
-  [ ] Full-text search works across title and content
-  [ ] User can mark bookmark as reviewed (hides from review)
-  [ ] User can archive bookmark (removes from all views)
-  [ ] User can delete bookmark
-  [ ] Works on mobile

---

## Dependencies

1. **Turso Database** - Create at turso.tech
2. **Clerk Account** - Create at clerk.com
3. **Jina API Key** - Get at jina.ai (free tier: 1M tokens)

---

## File Structure (Final)

```
facet/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── actions.ts
│   ├── lib/
│   │   ├── db.ts
│   │   ├── url.ts
│   │   ├── extract.ts
│   │   ├── search.ts
│   │   └── review.ts
│   └── components/
│       ├── bookmark-form.tsx
│       ├── bookmark-card.tsx
│       ├── review-section.tsx
│       └── search-input.tsx
├── middleware.ts
├── .env.example
├── package.json
└── tailwind.config.ts
```

**Total files: ~15** (vs. 50+ in original plan)

---

## Estimated Timeline

| Phase     | Time         | Deliverable                  |
| --------- | ------------ | ---------------------------- |
| Phase 1   | 1-2 days     | Working save/display/actions |
| Phase 2   | 1 day        | Content extraction + search  |
| Phase 3   | 1 day        | Polish + mobile              |
| **Total** | **3-4 days** | **Usable MVP**               |

---

_Simplified plan generated: December 31, 2025_
_Based on DHH, Kieran, and Simplicity reviewer feedback_
