CREATE TABLE IF NOT EXISTS chat_channels (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  retention_days INTEGER,
  created_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- seq is the insertion-ordered pagination key: created_at is second-precision
-- and the TEXT ids are random UUIDs, so neither preserves send order within a
-- second. AUTOINCREMENT prevents rowid reuse after deletes.
CREATE TABLE IF NOT EXISTS chat_messages (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  id          TEXT NOT NULL UNIQUE,
  channel_id  TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_page
  ON chat_messages(channel_id, seq);
