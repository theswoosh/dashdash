import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

export type Db = InstanceType<typeof Database>;

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

const MIGRATIONS = [
  { version: 1, file: '001_initial.sql' },
  { version: 2, file: '002_boards_v2.sql' },
] as const;

// SQLite ALTER TABLE ADD COLUMN does not support IF NOT EXISTS.
// This helper silently ignores "duplicate column" errors.
function addColumnSafe(db: Db, sql: string): void {
  try {
    db.exec(sql);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('duplicate column name')) throw err;
  }
}

function applyMigration(db: Db, file: string): void {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');

  // Extract SAFE_ALTER lines and run them via addColumnSafe.
  // The rest of the SQL runs as a single exec().
  const safeAlterLines: string[] = [];
  const regularLines: string[] = [];

  for (const line of sql.split('\n')) {
    const safeAlterMatch = line.match(/^-- SAFE_ALTER: (.+)$/);
    if (safeAlterMatch) {
      safeAlterLines.push(safeAlterMatch[1]!);
    } else {
      regularLines.push(line);
    }
  }

  for (const alterSql of safeAlterLines) {
    addColumnSafe(db, alterSql);
  }

  const regularSql = regularLines.join('\n').trim();
  if (regularSql) {
    db.exec(regularSql);
  }
}

function runMigrations(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      description TEXT,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const appliedVersions = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>).map(
      (row) => row.version,
    ),
  );

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;
    applyMigration(db, migration.file);
    db
      .prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)')
      .run(migration.version, migration.file);
  }
}

export function createDb(dataDir: string): Db {
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(join(dataDir, 'dashdash.db'));

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  // Seed the default board if none exists yet.
  const boardCount = (db.prepare('SELECT COUNT(*) AS n FROM boards').get() as { n: number }).n;
  if (boardCount === 0) {
    db.prepare('INSERT INTO boards (id, name, slug) VALUES (?, ?, ?)').run(
      randomUUID(),
      'Home',
      'default',
    );
  }

  return db;
}
