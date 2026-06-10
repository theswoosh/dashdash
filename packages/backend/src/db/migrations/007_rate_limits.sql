-- Auth rate limiting moved from in-memory Maps to SQLite so lockouts
-- survive server restarts (container restart no longer resets brute-force counters).
CREATE TABLE IF NOT EXISTS rate_limits (
  key      TEXT PRIMARY KEY,  -- "<scope>:<identifier>", e.g. "login:user@example.com"
  count    INTEGER NOT NULL,
  reset_at INTEGER NOT NULL   -- epoch ms when the window expires
);
