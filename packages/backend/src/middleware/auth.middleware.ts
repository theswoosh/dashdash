import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { validateSession, extendSession } from '../db/sessions.db.js';
import { SESSION_COOKIE_NAME, getSessionCookieOptions } from './session-cookie.js';
import type { Db } from '../db/index.js';

const PUBLIC_PATHS = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/config',
  '/api/auth/oidc/login',
  '/api/auth/oidc/callback',
  '/api/locales',
]);

const COOKIE_NAME = SESSION_COOKIE_NAME;

// Re-issuing the cookie on every request is wasteful; once per hour keeps the
// browser-side expiry in step with the sliding DB session.
const COOKIE_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const COOKIE_REFRESH_MAX_TRACKED = 10_000;

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userRole: 'admin' | 'user';
  }
}

export function registerAuthMiddleware(server: FastifyInstance, db: Db, slidingWindowSeconds: number): void {
  server.decorateRequest('userId', '');
  server.decorateRequest('userRole', 'user');

  const lastCookieRefresh = new Map<string, number>();

  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?')[0]!;
    if (!path.startsWith('/api/')) return;
    if (PUBLIC_PATHS.has(path)) return;

    const sessionId = request.cookies?.[COOKIE_NAME];
    if (!sessionId) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const session = validateSession(db, sessionId);
    if (!session) {
      void reply.clearCookie(COOKIE_NAME, getSessionCookieOptions());
      return reply.code(401).send({ error: 'Session expired or invalid' });
    }

    request.userId = session.userId;
    request.userRole = session.userRole;

    if (slidingWindowSeconds > 0) {
      extendSession(db, sessionId, slidingWindowSeconds);

      // The DB session slides, but the browser drops the cookie at its original
      // maxAge unless it is re-sent.
      const now = Date.now();
      const last = lastCookieRefresh.get(sessionId);
      if (last === undefined || now - last >= COOKIE_REFRESH_INTERVAL_MS) {
        if (lastCookieRefresh.size >= COOKIE_REFRESH_MAX_TRACKED) lastCookieRefresh.clear();
        lastCookieRefresh.set(sessionId, now);
        void reply.setCookie(COOKIE_NAME, sessionId, {
          ...getSessionCookieOptions(),
          maxAge: slidingWindowSeconds,
        });
      }
    }
  });
}
