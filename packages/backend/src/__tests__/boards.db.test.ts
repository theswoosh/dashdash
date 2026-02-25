import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { createDb, type Db } from '../db/index.js';
import {
  resolveEffectiveBoardSettings,
  listBoardsForUser,
} from '../db/boards.db.js';

let db: Db;
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-boards-test-'));
  db = createDb(tmpDir);
});

afterEach(() => {
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// Helpers
// ============================================================

function insertUser(overrides: Partial<{ id: string; email: string; name: string }> = {}): string {
  const userId = overrides.id ?? randomUUID();
  db.prepare(`
    INSERT INTO users (id, email, name) VALUES (?, ?, ?)
  `).run(userId, overrides.email ?? `user-${userId}@test.local`, overrides.name ?? 'Test User');
  return userId;
}

function insertBoard(overrides: Partial<{
  id: string;
  slug: string;
  name: string;
  theme: string;
  brightness: number;
  wallpaper_url: string | null;
  is_active: number;
}> = {}): string {
  const boardId = overrides.id ?? randomUUID();
  db.prepare(`
    INSERT INTO boards (id, name, slug, theme, brightness, wallpaper_url, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    boardId,
    overrides.name ?? 'Test Board',
    overrides.slug ?? `board-${boardId}`,
    overrides.theme ?? 'liquid-glass',
    overrides.brightness ?? 100,
    overrides.wallpaper_url ?? null,
    overrides.is_active ?? 1,
  );
  return boardId;
}

function grantAccess(userId: string, boardId: string, role = 'owner', grantedBy: string | null = null): void {
  db.prepare(`
    INSERT INTO user_boards (id, user_id, board_id, role, granted_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), userId, boardId, role, grantedBy);
}

function insertOverride(userId: string, boardId: string, overrides: Partial<{
  theme: string | null;
  brightness: number | null;
  wallpaper_url: string | null;
}> = {}): void {
  db.prepare(`
    INSERT INTO user_board_overrides (id, user_id, board_id, theme, brightness, wallpaper_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    userId,
    boardId,
    overrides.theme ?? null,
    overrides.brightness ?? null,
    overrides.wallpaper_url ?? null,
  );
}

// ============================================================
// resolveEffectiveBoardSettings
// ============================================================

describe('resolveEffectiveBoardSettings', () => {
  it('returns undefined when user has no access to the board', () => {
    const userId = insertUser();
    const boardId = insertBoard();
    // no user_boards row
    const result = resolveEffectiveBoardSettings(db, userId, boardId);
    expect(result).toBeUndefined();
  });

  it('returns undefined when board is inactive', () => {
    const userId = insertUser();
    const boardId = insertBoard({ is_active: 0 });
    grantAccess(userId, boardId);
    const result = resolveEffectiveBoardSettings(db, userId, boardId);
    expect(result).toBeUndefined();
  });

  it('returns board defaults when no user override exists', () => {
    const userId = insertUser();
    const boardId = insertBoard({ theme: 'classic', brightness: 80 });
    grantAccess(userId, boardId, 'viewer');

    const result = resolveEffectiveBoardSettings(db, userId, boardId);
    expect(result).toBeDefined();
    expect(result!.theme).toBe('classic');
    expect(result!.brightness).toBe(80);
    expect(result!.wallpaperUrl).toBeNull();
    expect(result!.role).toBe('viewer');
  });

  it('returns liquid-glass as fallback theme when board has no theme set', () => {
    const userId = insertUser();
    // Insert board without theme (NULL in DB would fall through COALESCE)
    const boardId = randomUUID();
    db.prepare(`
      INSERT INTO boards (id, name, slug) VALUES (?, ?, ?)
    `).run(boardId, 'Minimal', 'minimal');
    grantAccess(userId, boardId);

    const result = resolveEffectiveBoardSettings(db, userId, boardId);
    expect(result!.theme).toBe('liquid-glass');
  });

  it('user override wins over board default for theme', () => {
    const userId = insertUser();
    const boardId = insertBoard({ theme: 'classic' });
    grantAccess(userId, boardId, 'editor');
    insertOverride(userId, boardId, { theme: 'ascii' });

    const result = resolveEffectiveBoardSettings(db, userId, boardId);
    expect(result!.theme).toBe('ascii');
    expect(result!.role).toBe('editor');
  });

  it('user override wins over board default for brightness', () => {
    const userId = insertUser();
    const boardId = insertBoard({ brightness: 70 });
    grantAccess(userId, boardId);
    insertOverride(userId, boardId, { brightness: 50 });

    const result = resolveEffectiveBoardSettings(db, userId, boardId);
    expect(result!.brightness).toBe(50);
  });

  it('user override wins over board default for wallpaper_url', () => {
    const userId = insertUser();
    const boardId = insertBoard({ wallpaper_url: '/api/boards/abc/background' });
    grantAccess(userId, boardId);
    insertOverride(userId, boardId, { wallpaper_url: 'https://example.com/bg.jpg' });

    const result = resolveEffectiveBoardSettings(db, userId, boardId);
    expect(result!.wallpaperUrl).toBe('https://example.com/bg.jpg');
  });

  it('null override does not shadow board default (COALESCE skips null)', () => {
    const userId = insertUser();
    const boardId = insertBoard({ theme: 'atom' });
    grantAccess(userId, boardId);
    insertOverride(userId, boardId, { theme: null }); // explicit null = no override

    const result = resolveEffectiveBoardSettings(db, userId, boardId);
    expect(result!.theme).toBe('atom');
  });

  it('merges JSON settings buckets with correct precedence', () => {
    db.prepare(`UPDATE system_defaults SET settings = ? WHERE id = 1`).run(
      JSON.stringify({ accentColor: 'blue', showSeconds: false }),
    );
    const userId = insertUser();
    const boardId = insertBoard();
    // Set board-level settings
    db.prepare(`UPDATE boards SET settings = ? WHERE id = ?`).run(
      JSON.stringify({ showSeconds: true, gridGap: 8 }),
      boardId,
    );
    grantAccess(userId, boardId);
    // Insert override row first, then set the JSON overrides bucket
    insertOverride(userId, boardId);
    db.prepare(`UPDATE user_board_overrides SET overrides = ? WHERE user_id = ? AND board_id = ?`).run(
      JSON.stringify({ gridGap: 12 }),
      userId,
      boardId,
    );

    const result = resolveEffectiveBoardSettings(db, userId, boardId);
    // system: accentColor=blue, showSeconds=false
    // board:  showSeconds=true, gridGap=8   → overrides system
    // user:   gridGap=12                    → overrides board
    expect(result!.settings['accentColor']).toBe('blue');
    expect(result!.settings['showSeconds']).toBe(true);
    expect(result!.settings['gridGap']).toBe(12);
  });
});

// ============================================================
// listBoardsForUser
// ============================================================

describe('listBoardsForUser', () => {
  it('returns empty array when user has no board memberships', () => {
    const userId = insertUser();
    const boards = listBoardsForUser(db, userId);
    expect(boards).toEqual([]);
  });

  it('lists active boards for a user with effective settings applied', () => {
    const userId = insertUser();
    const boardId = insertBoard({ name: 'Work', theme: 'classic', brightness: 90 });
    grantAccess(userId, boardId, 'owner');

    const boards = listBoardsForUser(db, userId);
    expect(boards).toHaveLength(1);
    expect(boards[0]!.name).toBe('Work');
    expect(boards[0]!.theme).toBe('classic');
    expect(boards[0]!.brightness).toBe(90);
    expect(boards[0]!.role).toBe('owner');
  });

  it('excludes inactive boards', () => {
    const userId = insertUser();
    const activeId = insertBoard({ name: 'Active', is_active: 1 });
    const inactiveId = insertBoard({ name: 'Inactive', is_active: 0 });
    grantAccess(userId, activeId);
    grantAccess(userId, inactiveId);

    const boards = listBoardsForUser(db, userId);
    expect(boards.map((b) => b.name)).toEqual(['Active']);
  });

  it('applies user override for theme in list query', () => {
    const userId = insertUser();
    const boardId = insertBoard({ theme: 'liquid-glass' });
    grantAccess(userId, boardId);
    insertOverride(userId, boardId, { theme: 'ascii' });

    const boards = listBoardsForUser(db, userId);
    expect(boards[0]!.theme).toBe('ascii');
  });

  it('lists multiple boards ordered by name', () => {
    const userId = insertUser();
    const zId = insertBoard({ name: 'Zebra', slug: 'zebra' });
    const aId = insertBoard({ name: 'Alpha', slug: 'alpha' });
    grantAccess(userId, zId);
    grantAccess(userId, aId);

    const boards = listBoardsForUser(db, userId);
    expect(boards.map((b) => b.name)).toEqual(['Alpha', 'Zebra']);
  });

  it('does not leak boards belonging to other users', () => {
    const userA = insertUser({ email: 'a@test.local' });
    const userB = insertUser({ email: 'b@test.local' });
    const boardId = insertBoard({ name: 'Private' });
    grantAccess(userA, boardId);

    const boardsForB = listBoardsForUser(db, userB);
    expect(boardsForB).toHaveLength(0);
  });
});

// ============================================================
// Migration runner
// ============================================================

describe('migration runner', () => {
  it('records applied migration versions in schema_migrations', () => {
    const versions = (
      db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{ version: number }>
    ).map((r) => r.version);
    expect(versions).toContain(1);
    expect(versions).toContain(2);
    expect(versions).toContain(3);
  });

  it('is idempotent — running createDb twice does not duplicate migrations', () => {
    // Close current DB and reopen — migration runner should skip already-applied versions
    db.close();
    const db2 = createDb(tmpDir);
    const count = (
      db2.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as { n: number }
    ).n;
    expect(count).toBe(3); // migrations 1, 2, 3
    db = db2; // afterEach will close it
  });
});
