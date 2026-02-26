CREATE TABLE IF NOT EXISTS user_wallpapers (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  board_id    TEXT NOT NULL,
  ext         TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
