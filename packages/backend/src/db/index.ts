import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

export type Db = InstanceType<typeof Database>;

export function createDb(dataDir: string): Db {
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(join(dataDir, 'dashdash.db'));

  // Enable WAL for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS boards (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL DEFAULT 'Home',
      slug              TEXT NOT NULL UNIQUE,
      background_ext    TEXT,
      wallpaper_enabled INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Phase 2 will add:
    --   users (id TEXT PK, ...)
    --   user_boards (user_id REFERENCES users, board_id REFERENCES boards, role TEXT, sort_order INT)

    CREATE TABLE IF NOT EXISTS notepad (
      service_id  TEXT PRIMARY KEY,
      content     TEXT NOT NULL DEFAULT '',
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_preferences (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrate: add wallpaper_enabled if upgrading from an older schema.
  try {
    db.exec(`ALTER TABLE boards ADD COLUMN wallpaper_enabled INTEGER NOT NULL DEFAULT 0`);
  } catch { /* column already exists */ }

  // Seed the default board if none exists yet.
  const boardCount = (db.prepare('SELECT COUNT(*) AS n FROM boards').get() as { n: number }).n;
  if (boardCount === 0) {
    db.prepare('INSERT INTO boards (id, name, slug) VALUES (?, ?, ?)').run(randomUUID(), 'Home', 'default');
  }

  return db;
}
