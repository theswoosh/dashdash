import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createDb, type Db } from '../db/index.js';
import {
  createOidcState,
  consumeOidcState,
  cleanupExpiredOidcStates,
} from '../db/oidc-state.db.js';

let db: Db;
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-oidc-test-'));
  db = createDb(tmpDir);
});

afterEach(() => {
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('createOidcState + consumeOidcState', () => {
  it('stores state and returns it on first consume', () => {
    createOidcState(db, 'state-abc', 'verifier-xyz', 'https://app/callback', 300);

    const row = consumeOidcState(db, 'state-abc');

    expect(row).toBeDefined();
    expect(row!.state).toBe('state-abc');
    expect(row!.code_verifier).toBe('verifier-xyz');
    expect(row!.redirect_uri).toBe('https://app/callback');
  });

  it('deletes state after first consume — replay prevention', () => {
    createOidcState(db, 'state-once', 'verifier', 'https://app/callback', 300);

    const first = consumeOidcState(db, 'state-once');
    const second = consumeOidcState(db, 'state-once');

    expect(first).toBeDefined();
    expect(second).toBeUndefined();
  });

  it('returns undefined for unknown state', () => {
    const row = consumeOidcState(db, 'does-not-exist');
    expect(row).toBeUndefined();
  });

  it('returns undefined for expired state', () => {
    createOidcState(db, 'state-expired', 'verifier', 'https://app/callback', 300);

    db.prepare("UPDATE oidc_auth_state SET expires_at = datetime('now', '-1 second') WHERE state = ?")
      .run('state-expired');

    const row = consumeOidcState(db, 'state-expired');
    expect(row).toBeUndefined();
  });

  it('isolates states — consuming one does not affect another', () => {
    createOidcState(db, 'state-1', 'v1', 'https://app/callback', 300);
    createOidcState(db, 'state-2', 'v2', 'https://app/callback', 300);

    consumeOidcState(db, 'state-1');

    const row2 = consumeOidcState(db, 'state-2');
    expect(row2).toBeDefined();
    expect(row2!.code_verifier).toBe('v2');
  });
});

describe('cleanupExpiredOidcStates', () => {
  it('removes expired states and returns the count', () => {
    createOidcState(db, 'valid', 'v', 'https://app/callback', 300);
    createOidcState(db, 'expired-1', 'v', 'https://app/callback', 300);
    createOidcState(db, 'expired-2', 'v', 'https://app/callback', 300);

    db.prepare("UPDATE oidc_auth_state SET expires_at = datetime('now', '-1 second') WHERE state != ?")
      .run('valid');

    const deleted = cleanupExpiredOidcStates(db);
    expect(deleted).toBe(2);
  });

  it('leaves valid states intact after cleanup', () => {
    createOidcState(db, 'stays', 'verifier', 'https://app/callback', 300);
    createOidcState(db, 'gone', 'verifier', 'https://app/callback', 300);

    db.prepare("UPDATE oidc_auth_state SET expires_at = datetime('now', '-1 second') WHERE state = ?")
      .run('gone');

    cleanupExpiredOidcStates(db);

    const row = consumeOidcState(db, 'stays');
    expect(row).toBeDefined();
  });

  it('returns 0 when no expired states exist', () => {
    createOidcState(db, 'fresh', 'v', 'https://app/callback', 300);

    const deleted = cleanupExpiredOidcStates(db);
    expect(deleted).toBe(0);
  });
});
