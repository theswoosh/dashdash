import { randomUUID } from 'crypto';
import type { Db } from './index.js';

interface OidcStateRow {
  id: string;
  state: string;
  code_verifier: string;
  redirect_uri: string;
  expires_at: string;
  created_at: string;
}

export function createOidcState(
  db: Db,
  state: string,
  codeVerifier: string,
  redirectUri: string,
  expiresSeconds: number
): void {
  const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();
  db.prepare(`
    INSERT INTO oidc_auth_state (id, state, code_verifier, redirect_uri, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), state, codeVerifier, redirectUri, expiresAt);
}

export function consumeOidcState(db: Db, state: string): OidcStateRow | undefined {
  const row = db.prepare(`
    SELECT * FROM oidc_auth_state
    WHERE state = ? AND expires_at > datetime('now')
  `).get(state) as OidcStateRow | undefined;

  if (row) {
    db.prepare('DELETE FROM oidc_auth_state WHERE id = ?').run(row.id);
  }
  return row;
}

export function cleanupExpiredOidcStates(db: Db): number {
  const result = db.prepare(`DELETE FROM oidc_auth_state WHERE expires_at <= datetime('now')`).run();
  return result.changes;
}
