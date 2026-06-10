import type { Db } from './index.js';

interface RateLimitRow {
  count: number;
  reset_at: number;
}

/**
 * Counts one attempt for the key and reports whether it is still within the
 * window allowance. A new window starts when the previous one has expired.
 */
export function consumeRateLimit(db: Db, key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const row = db.prepare('SELECT count, reset_at FROM rate_limits WHERE key = ?').get(key) as RateLimitRow | undefined;

  if (!row || row.reset_at <= now) {
    db.prepare(`
      INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at
    `).run(key, now + windowMs);
    return true;
  }

  if (row.count >= maxAttempts) return false;

  db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').run(key);
  return true;
}

/** Clears the counter, e.g. after a successful login — only failures should accumulate. */
export function resetRateLimit(db: Db, key: string): void {
  db.prepare('DELETE FROM rate_limits WHERE key = ?').run(key);
}

export function cleanupExpiredRateLimits(db: Db): number {
  const result = db.prepare('DELETE FROM rate_limits WHERE reset_at <= ?').run(Date.now());
  return result.changes;
}
