-- Migration 003: system-level user role + password reset tokens

-- Add role column to users (admin | user).
-- SAFE_ALTER is parsed by the migration runner and wrapped in try/catch.
-- SAFE_ALTER: ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- Password reset tokens (SHA-256 of the raw token stored, never raw).
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_user    ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON password_reset_tokens(expires_at);
