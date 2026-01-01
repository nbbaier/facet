# Bookmarking App Specification

## Overview

A personal bookmarking system designed to solve the core problem of saved content that never gets revisited. The app focuses on active resurfacing through time-based review mechanisms and intelligent duplicate detection, combined with powerful search capabilities.

### Core Problem

Bookmarks are saved but forgotten. The traditional approach of passive storage with manual search doesn't work because:
- You can't search for what you've forgotten you saved
- Context changes over time, making old bookmarks relevant again
- No mechanism prompts you to revisit saved content

### Solution

Time-based review system that surfaces saved content at configurable intervals, prioritizing items saved multiple times (signal of importance), with semantic search for when you do remember to look for something.

## Tech Stack

- **Frontend**: Next.js (App Router), fully responsive for mobile
- **Hosting**: Vercel or Cloudflare Pages
- **Database**: Turso (SQLite, existing setup)
- **Embeddings**: OpenAI text-embedding-3-small
- **Auth**: Clerk or better-auth

## Database Schema

```sql
-- Main bookmarks table
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  content TEXT, -- extracted/cleaned text
  source_type TEXT, -- 'twitter', 'article', 'github', 'video', 'other'
  note TEXT, -- optional user note at save time
  saved_at INTEGER NOT NULL, -- most recent save timestamp
  created_at INTEGER NOT NULL
);

-- Tags (many-to-many)
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE bookmark_tags (
  bookmark_id TEXT REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

-- Embeddings for semantic search
CREATE TABLE bookmark_embeddings (
  bookmark_id TEXT PRIMARY KEY REFERENCES bookmarks(id) ON DELETE CASCADE,
  embedding TEXT NOT NULL -- JSON array of floats
);

-- Track all saves of the same URL (duplicate detection)
CREATE TABLE bookmark_saves (
  id TEXT PRIMARY KEY,
  bookmark_id TEXT REFERENCES bookmarks(id) ON DELETE CASCADE,
  saved_at INTEGER NOT NULL,
  note TEXT -- note for this specific save instance
);

-- Review tracking
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  bookmark_id TEXT REFERENCES bookmarks(id) ON DELETE CASCADE,
  reviewed_at INTEGER NOT NULL,
  action TEXT -- 'viewed', 'archived', 'deleted'
);

-- User settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

## API Endpoints

### Save Bookmark

**Endpoint**: `POST /api/bookmarks`

**Request Body**:
```json
{
  "url": "string",
  "note": "string (optional)",
  "source": "string (optional, from shortcut/raycast)"
}
```

**Flow**:
1. Normalize URL (strip tracking parameters, standardize format)
2. Check for duplicates by normalized URL
   - **If duplicate exists**:
     - Add new entry to `bookmark_saves`
     - Update `bookmarks.saved_at` to current timestamp
     - Return `{ duplicate: true, save_count: N, bookmark }`
   - **If new**:
     - Create new bookmark record
     - Add first entry to `bookmark_saves`
     - Proceed with content extraction
3. Extract content based on source type:
   - **Articles**: Extract main text using Jina Reader API or similar
   - **Twitter**: Use API or scraping
   - **GitHub**: Fetch README content
   - **YouTube**: Fetch transcript using youtube-transcript package
   - **Other videos**: Title + description only
   - **Fallback**: Title + meta description
4. Generate embedding from `title + content` using OpenAI
5. Auto-generate 3-5 tags using Claude based on content
6. Store all data (bookmark, embedding, tags, save record)
7. Return success response with bookmark details

**Response**:
```json
{
  "id": "string",
  "url": "string",
  "title": "string",
  "duplicate": "boolean",
  "save_count": "number",
  "tags": ["string"],
  "previous_saves": [
    {
      "saved_at": "timestamp",
      "note": "string"
    }
  ]
}
```

### Other Endpoints

- `GET /api/bookmarks` - List all bookmarks with filters
- `GET /api/bookmarks/:id` - Get single bookmark with all saves
- `PATCH /api/bookmarks/:id` - Update bookmark
- `DELETE /api/bookmarks/:id` - Delete bookmark
- `POST /api/bookmarks/:id/review` - Mark as reviewed/archived
- `GET /api/bookmarks/review` - Get items for time-based review
- `POST /api/search` - Search bookmarks (FTS + semantic)
- `GET /api/settings` - Get user settings
- `PATCH /api/settings` - Update settings

## Web UI

### Landing Page (`/`) - Time-based Review

**Purpose**: Primary interface for discovering saved content through time-based review.

**Layout**:
- Header with app name, search icon, settings icon
- Review sections, each showing items from a specific time period
- Configurable periods (default: 1 week, 1 month, 3 months, 6 months, 1 year)
- Each section displays N unreviewed items (configurable, default 5-10)

**Review Prioritization Algorithm**:

For each time period:
1. Get all unreviewed bookmarks from that period
2. Sort by:
   - **Primary**: `save_count DESC` (multi-saved items first)
   - **Secondary**: `saved_at DESC` (most recent within save count tier)
3. Take top N items

**Card Layout**:
```
┌─────────────────────────────────────┐
│ ×3  Article Title                   │
│     example.com                     │
│     "follow up" · "good example"    │
│     Last saved: Dec 31, 2025        │
│     First saved: Oct 2, 2025        │
│     [tag1] [tag2] [tag3]            │
│                                     │
│     [Reviewed] [Archive] [Delete]   │
└─────────────────────────────────────┘
```

**Card Elements**:
- Save count badge (×N) if saved multiple times
- Title (linked to URL)
- Domain
- Note previews (truncated, from all saves)
- First/last saved dates
- Auto-generated tags
- Action buttons

**Actions**:
- **Mark Reviewed**: Removes from review queue, cycles in new item
- **Archive**: Moves to archived view
- **Delete**: Permanently removes bookmark
- **Open**: Opens URL in new tab

**Settings Access**:
- Gear icon to configure review periods
- Add/remove periods
- Adjust items shown per period
- Toggle prioritization options

### Search Page (`/search`)

**Search Implementation**:
- Dual search strategy:
  1. **Full-text search**: SQL FTS on title and content
  2. **Semantic search**: Vector similarity on embeddings
- Merge and rank results
- Single search input with immediate results

**Filters** (sidebar on desktop, drawer on mobile):
- Source type (article, twitter, github, video, other)
- Date range (last week, month, year, custom)
- Tags (multi-select)
- Save count (single save, multiple saves)

**Results**:
- Same card layout as review page
- Infinite scroll or pagination
- Result count displayed

### All Bookmarks (`/bookmarks`)

**Purpose**: Browse all saved bookmarks chronologically.

**Layout**:
- Reverse chronological order (most recent first)
- Same filter options as search
- Same card layout
- Infinite scroll

### Archived (`/archived`)

**Purpose**: View and manage archived bookmarks.

**Layout**:
- Same as All Bookmarks page
- Filter to show only archived items
- Additional "Unarchive" action on cards
- Same search and filter capabilities

### Settings (`/settings`)

**Review Configuration**:
```
Review Periods:
☑ 1 week    - show 10 items
☑ 1 month   - show 10 items  
☑ 3 months  - show 5 items
☑ 6 months  - show 5 items
☑ 1 year    - show 5 items

[Add Custom Period]

Prioritization:
☑ Prioritize multi-saved items
☑ Show unreviewed items first
```

**Other Settings**:
- API key management (if needed for extensions)
- Data export (JSON, CSV)
- Danger zone: Clear all data, Delete account

### Mobile Considerations

- Fully responsive card layout
- Bottom navigation on mobile
- Swipe gestures on cards (archive left, delete right)
- Search filters in modal/drawer
- Touch-friendly tap targets
- Optimized for one-handed use

## Save Interfaces

### Raycast Extension

**Commands**:

1. **Save Bookmark**
   - Input: URL (or auto-detect from clipboard/frontmost browser)
   - Optional: Note field (appears after URL input)
   - Shows success with generated tags
   - If duplicate: Shows "Already saved N times" with dates

2. **Search Bookmarks**
   - Input: Search query
   - Shows inline results
   - Quick actions: Open, Archive, Delete

**Implementation**:
- TypeScript Raycast extension
- Hits `/api/bookmarks` endpoint
- Stores API credentials in Raycast preferences

### iOS Shortcut

**Flow**:
1. Trigger from Share Sheet
2. Captures URL from shared item
3. Optional prompt: "Add Note?"
4. POST to `/api/bookmarks`
5. Show notification:
   - Success: "Saved to bookmarks"
   - Duplicate: "Already saved 2 times"

**Implementation**:
- Standard iOS Shortcut
- API endpoint hardcoded
- Auth token in Shortcuts settings

## Duplicate Detection

### Save Behavior

When saving a URL that already exists:
1. Normalize URLs for comparison (strip tracking params, www, trailing slashes)
2. Add new `bookmark_saves` record with current timestamp and note
3. Update `bookmarks.saved_at` to most recent save time
4. Increment save counter
5. Return duplicate signal to user

### UI Indicators

**Save Response** (Raycast/Shortcut):
- "Already saved 3 times"
- Show previous save dates
- Display previous notes
- Allow adding new note for this instance

**Bookmark Cards**:
- Badge showing "×N" for items saved multiple times
- Click/tap badge to expand save history:
  ```
  Saved 3 times:
  • Dec 31, 2025 - "follow up on this"
  • Nov 15, 2025 - "good example for blog"
  • Oct 2, 2025 - (no note)
  ```

**Detail View**:
- Full timeline of all saves
- All notes from each save
- First saved / last saved dates
- Option to merge/edit notes

### Priority Signal

Multiple saves = important content. Use this signal to:
- Prioritize in time-based review (show multi-saved items first)
- Highlight in search results
- Surface in "frequently saved" analytics (future feature)

## Content Extraction

### Articles
- Use Jina Reader API (free tier available)
- Fallback: Custom extraction with Readability.js
- Extract: title, main content, author, publish date
- Store cleaned text in `content` field

### Twitter/X
- Use Twitter API if available
- Fallback: Scraping with Playwright
- Extract: tweet text, author, media URLs
- Store as formatted text

### GitHub
- Fetch README via GitHub API
- Extract repository description
- Store: repo name, description, README content
- Could expand to specific file URLs later

### YouTube
- Primary: Fetch transcript using `youtube-transcript` package
- Fallback: Title + description from YouTube API
- Store full transcript in `content`

### Other Videos
- Extract metadata only (title, description)
- Could add transcript support for other platforms later

### Fallback
- If no specialized extraction available
- Use meta tags (og:title, og:description)
- Store whatever text is available

## Migration from Tana

### One-time Migration Script

**Purpose**: Import existing bookmarks from Tana backup in Turso.

**Process**:
1. Connect to existing Turso database
2. Map Tana fields to new schema
3. For each bookmark:
   - Extract URL, title, notes, tags, timestamp
   - Check if URL already in new system (dedupe)
   - Run content extraction (batch with rate limiting)
   - Generate embedding
   - Auto-tag using Claude
   - Create initial `bookmark_saves` record
   - Set `saved_at` and `created_at` to original Tana date
4. Skip initial review tracking (don't mark as needing review)
5. Log progress and errors
6. Generate migration report

**Considerations**:
- Rate limit API calls (embeddings, Claude tagging)
- Batch process in chunks of 50-100
- Dry run mode for testing
- Ability to resume if interrupted
- Preserve original timestamps

## Implementation Roadmap

### Phase 1: Core Infrastructure
1. Next.js project setup with TypeScript
2. Turso database connection and schema
3. Basic authentication (Clerk/better-auth)
4. API endpoints for CRUD operations

### Phase 2: Content Extraction
5. Article extraction (Jina Reader integration)
6. YouTube transcript fetching
7. GitHub README extraction
8. Twitter/basic scraping
9. Embedding generation pipeline

### Phase 3: Review System
10. Time-based review page (static periods)
11. Review action handlers (viewed, archived, deleted)
12. Prioritization algorithm (multi-saves first)

### Phase 4: Search
13. Full-text search implementation
14. Semantic search with embeddings
15. Result merging and ranking
16. Filter implementation

### Phase 5: Duplicate Detection
17. URL normalization
18. `bookmark_saves` tracking
19. Duplicate UI indicators
20. Save timeline display

### Phase 6: Save Interfaces
21. Raycast extension development
22. iOS Shortcut creation
23. Browser bookmarklet (optional)

### Phase 7: Configuration
24. Configurable review periods
25. Settings page
26. User preferences storage

### Phase 8: Migration
27. Migration script development
28. Testing with Tana data
29. Full migration execution

### Phase 9: Polish
30. Mobile UI refinement
31. Loading states and error handling
32. Performance optimization
33. Analytics/usage tracking (optional)

## Future Enhancements

Ideas for future iterations (not in v1):

- Browser extension for one-click saving
- Related bookmarks suggestions
- Collaborative collections (share with others)
- Reading time estimates
- Link rot detection and archiving
- Weekly digest emails
- Mobile apps (React Native)
- Spaced repetition algorithm for review
- Auto-archive old unreviewed items
- Integration with read-it-later services
- Bookmark collections/folders
- Public bookmark sharing
- RSS feed generation from bookmarks

## Success Metrics

How to measure if this solves the problem:

- **Primary**: % of bookmarks reviewed at least once (target: >50%)
- **Engagement**: Daily active use of review page
- **Discovery**: Bookmarks clicked from review vs search
- **Quality**: Multi-save rate (indicates valuable content)
- **Retention**: Bookmarks not deleted after 6 months (target: >70%)

## Technical Considerations

### Performance
- Lazy load embeddings (generate on background job if save takes too long)
- Cache search results
- Optimize database queries with proper indexes
- Consider pagination limits for large collections

### Privacy
- All data stored in user's Turso database
- No sharing of bookmarks without explicit action
- Option to self-host if needed

### Costs
- OpenAI embeddings: ~$0.00002 per bookmark
- Turso: Free tier sufficient for personal use
- Vercel/Cloudflare: Free tier sufficient
- Jina Reader: Free tier available

### Scalability
- Designed for personal use (hundreds to thousands of bookmarks)
- Should handle 10k+ bookmarks without issues
- Can optimize further if needed
