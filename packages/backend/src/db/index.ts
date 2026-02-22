import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';

export type Db = InstanceType<typeof Database>;

export function createDb(dataDir: string): Db {
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(join(dataDir, 'dashdash.db'));

  // Enable WAL for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS layouts (
      board_id  TEXT PRIMARY KEY,
      layout_json TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_services (
      id          TEXT PRIMARY KEY,
      service_json TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS notepad (
      service_id  TEXT PRIMARY KEY,
      content     TEXT NOT NULL DEFAULT '',
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}
