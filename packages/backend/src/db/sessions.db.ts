import { randomBytes } from 'crypto';
import type { Db } from './index.js';

const SESSION_TOKEN_BYTES = 32;

interface SessionPayload {
  userId: string;
  userRole: 'admin' | 'user';
}

export function createSession(db: Db, userId: string, maxAgeSeconds: number, oidcIdToken?: string): string {
  const sessionId = randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at, oidc_id_token)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, userId, expiresAt, oidcIdToken ?? null);

  return sessionId;
}

export function findSessionOidcIdToken(db: Db, sessionId: string): string | undefined {
  const row = db.prepare('SELECT oidc_id_token FROM sessions WHERE id = ?').get(sessionId) as
    | { oidc_id_token: string | null }
    | undefined;
  return row?.oidc_id_token ?? undefined;
}

export function validateSession(db: Db, sessionId: string): SessionPayload | undefined {
  const row = db.prepare(`
    SELECT s.user_id, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
      AND s.expires_at > datetime('now')
      AND u.is_active = 1
  `).get(sessionId) as { user_id: string; role: 'admin' | 'user' } | undefined;

  if (!row) return undefined;
  return { userId: row.user_id, userRole: row.role };
}

export function destroySession(db: Db, sessionId: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function destroyAllUserSessions(db: Db, userId: string): void {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function extendSession(db: Db, sessionId: string, maxAgeSeconds: number): void {
  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000).toISOString();
  db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(expiresAt, sessionId);
}

export function cleanupExpiredSessions(db: Db): number {
  const result = db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  return result.changes;
}
