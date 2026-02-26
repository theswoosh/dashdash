-- Migration 004: per-user preferences
-- Replaces the global (keyless) user_preferences table with one scoped per user.
-- Data from before auth was added had no user association and is discarded.

DROP TABLE IF EXISTS user_preferences;

CREATE TABLE user_preferences (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key        TEXT NOT NULL,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    PRIMARY KEY (user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_user_prefs_user ON user_preferences(user_id);
