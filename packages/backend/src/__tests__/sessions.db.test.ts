import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { createDb, type Db } from '../db/index.js';
import {
  createSession,
  validateSession,
  destroySession,
  destroyAllUserSessions,
  extendSession,
  cleanupExpiredSessions,
} from '../db/sessions.db.js';

let db: Db;
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-sessions-test-'));
  db = createDb(tmpDir);
});

afterEach(() => {
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// Helpers
// ============================================================

function insertUser(db: Db, id = randomUUID()): string {
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, role, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
  ).run(id, `${id}@test.local`, 'hash', 'Test User', 'user');
  return id;
}

// ============================================================
// createSession + validateSession
// ============================================================

describe('createSession + validateSession', () => {
  it('creates a session and validates it successfully', () => {
    const userId = insertUser(db);
    const token = createSession(db, userId, 3600);
    const payload = validateSession(db, token);

    expect(payload).toBeDefined();
    expect(payload!.userId).toBe(userId);
    expect(payload!.userRole).toBe('user');
  });

  it('returns a non-empty token of at least 20 characters', () => {
    const userId = insertUser(db);
    const token = createSession(db, userId, 3600);

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThanOrEqual(20);
  });

  it('produces different tokens on successive calls', () => {
    const userId = insertUser(db);
    const token1 = createSession(db, userId, 3600);
    const token2 = createSession(db, userId, 3600);

    expect(token1).not.toBe(token2);
  });
});

// ============================================================
// validateSession — expired session
// ============================================================

describe('validateSession — expired session', () => {
  it('returns undefined for an expired session', () => {
    const userId = insertUser(db);
    const token = createSession(db, userId, 3600);

    // Backdate the session so it is already expired
    db.prepare("UPDATE sessions SET expires_at = datetime('now', '-1 second') WHERE id = ?").run(
      token,
    );

    const payload = validateSession(db, token);
    expect(payload).toBeUndefined();
  });
});

// ============================================================
// validateSession — deactivated user
// ============================================================

describe('validateSession — deactivated user', () => {
  it('returns undefined when the user is deactivated', () => {
    const userId = insertUser(db);
    const token = createSession(db, userId, 3600);

    db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(userId);

    const payload = validateSession(db, token);
    expect(payload).toBeUndefined();
  });
});

// ============================================================
// destroySession
// ============================================================

describe('destroySession', () => {
  it('destroys a session so it can no longer be validated', () => {
    const userId = insertUser(db);
    const token = createSession(db, userId, 3600);

    destroySession(db, token);

    const payload = validateSession(db, token);
    expect(payload).toBeUndefined();
  });
});

// ============================================================
// destroyAllUserSessions
// ============================================================

describe('destroyAllUserSessions', () => {
  it('destroys all sessions for a user', () => {
    const userId = insertUser(db);
    const token1 = createSession(db, userId, 3600);
    const token2 = createSession(db, userId, 3600);

    destroyAllUserSessions(db, userId);

    expect(validateSession(db, token1)).toBeUndefined();
    expect(validateSession(db, token2)).toBeUndefined();
  });
});

// ============================================================
// extendSession
// ============================================================

describe('extendSession', () => {
  it('extends a session so it remains valid', () => {
    const userId = insertUser(db);
    const token = createSession(db, userId, 1); // 1-second session

    // Extend the session by a full hour
    extendSession(db, token, 3600);

    const payload = validateSession(db, token);
    expect(payload).toBeDefined();
    expect(payload!.userId).toBe(userId);
  });
});

// ============================================================
// cleanupExpiredSessions
// ============================================================

describe('cleanupExpiredSessions', () => {
  it('removes expired sessions and returns the count of deleted rows', () => {
    const userId = insertUser(db);
    const expiredToken = createSession(db, userId, 3600);
    const validToken = createSession(db, userId, 3600);

    // Backdate one session to make it expired
    db.prepare("UPDATE sessions SET expires_at = datetime('now', '-1 second') WHERE id = ?").run(
      expiredToken,
    );

    const deleted = cleanupExpiredSessions(db);
    expect(deleted).toBe(1);

    // The valid session must still work
    expect(validateSession(db, validToken)).toBeDefined();
    // The expired session was already gone before cleanup, but confirm
    expect(validateSession(db, expiredToken)).toBeUndefined();
  });
});
