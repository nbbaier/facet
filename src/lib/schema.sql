-- Main bookmarks table (simplified)
CREATE TABLE IF NOT EXISTS bookmarks (
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
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_archived ON bookmarks(user_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_review ON bookmarks(user_id, archived_at, last_reviewed_at, created_at);

-- FTS5 for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
  title, content,
  content='bookmarks',
  content_rowid='rowid',
  prefix='2 3'
);

-- Sync triggers (all three required)
CREATE TRIGGER IF NOT EXISTS bookmarks_ai AFTER INSERT ON bookmarks BEGIN
  INSERT INTO bookmarks_fts(rowid, title, content)
  VALUES (new.rowid, new.title, new.content);
END;

CREATE TRIGGER IF NOT EXISTS bookmarks_au AFTER UPDATE ON bookmarks BEGIN
  INSERT INTO bookmarks_fts(bookmarks_fts, rowid, title, content)
  VALUES('delete', old.rowid, old.title, old.content);
  INSERT INTO bookmarks_fts(rowid, title, content)
  VALUES (new.rowid, new.title, new.content);
END;

CREATE TRIGGER IF NOT EXISTS bookmarks_ad AFTER DELETE ON bookmarks BEGIN
  INSERT INTO bookmarks_fts(bookmarks_fts, rowid, title, content)
  VALUES('delete', old.rowid, old.title, old.content);
END;
