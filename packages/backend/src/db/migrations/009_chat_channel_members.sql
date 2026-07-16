-- Additive allow-list: a channel with zero rows here is open to every user
-- (matches v1 behavior). Adding a row restricts that channel to its members
-- (+ admins, checked in code, not via a row).
CREATE TABLE IF NOT EXISTS chat_channel_members (
  channel_id TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (channel_id, user_id)
);
