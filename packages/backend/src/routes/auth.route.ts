import { randomUUID } from 'crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { findUserByEmail, findUserById, createUser, updateUser, deleteUser, countAdmins, isFirstUser, findUserByOidc, createOidcUser, linkOidcToUser } from '../db/users.db.js';
import { createSession, destroySession, destroyAllUserSessions } from '../db/sessions.db.js';
import { createOidcState, consumeOidcState } from '../db/oidc-state.db.js';
import { hashPassword, verifyPassword, generateResetToken, hashResetToken } from '../services/password.service.js';
import { sendPasswordResetEmail, isMailConfigured } from '../services/mail.service.js';
import { buildOidcConfig, buildAuthorizationUrl, exchangeCode, extractUserClaims, generateCodeVerifier, generateState, getEndSessionUrl } from '../services/oidc.service.js';
import type { AuthConfig, MailConfig } from '../config/schemas.js';

const OIDC_STATE_EXPIRES_SECONDS = 600; // 10 minutes

const COOKIE_NAME = 'dashdash_session';
const RESET_TOKEN_EXPIRES_SECONDS = 3600; // 1 hour

const RATE_WINDOWS = {
  login:    { maxAttempts: 5,  windowMs: 15 * 60 * 1000 },
  register: { maxAttempts: 3,  windowMs: 60 * 60 * 1000 },
  forgot:   { maxAttempts: 3,  windowMs: 60 * 60 * 1000 },
} as const;

function checkRateLimit(store: Map<string, { count: number; windowStart: number }>, key: string, limitKey: keyof typeof RATE_WINDOWS): boolean {
  const { maxAttempts, windowMs } = RATE_WINDOWS[limitKey]!;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= maxAttempts) return false;
  entry.count++;
  return true;
}

const RegisterBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).trim(),
});

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const UpdateMeBodySchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(128).optional(),
  currentPassword: z.string().optional(),
});

const ForgotPasswordBodySchema = z.object({
  email: z.string().email(),
});

const ResetPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

const RATE_LIMIT_PRUNE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

function pruneExpiredEntries(
  store: Map<string, { count: number; windowStart: number }>,
  windowMs: number
): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.windowStart > windowMs) store.delete(key);
  }
}

export function createAuthRoutes(db: Db, authConfig: AuthConfig, mailConfig: MailConfig): FastifyPluginAsync {
  // Rate limiter stores are per-server-instance — reset when server restarts or test teardown.
  const loginAttempts = new Map<string, { count: number; windowStart: number }>();
  const registerAttempts = new Map<string, { count: number; windowStart: number }>();
  const forgotAttempts = new Map<string, { count: number; windowStart: number }>();

  // Prevent unbounded memory growth — prune expired windows every 15 minutes.
  const pruneTimer = setInterval(() => {
    pruneExpiredEntries(loginAttempts, RATE_WINDOWS.login.windowMs);
    pruneExpiredEntries(registerAttempts, RATE_WINDOWS.register.windowMs);
    pruneExpiredEntries(forgotAttempts, RATE_WINDOWS.forgot.windowMs);
  }, RATE_LIMIT_PRUNE_INTERVAL_MS);
  pruneTimer.unref();

  return async (fastify) => {
    const cookieOpts = {
      httpOnly: true,
      secure: process.env['DASHDASH_COOKIE_SECURE'] !== 'false'
        && process.env['NODE_ENV'] === 'production',
      sameSite: 'strict' as const,
      path: '/',
      maxAge: authConfig.session.maxAgeSeconds,
    };

    // GET /api/auth/config — public, tells the frontend what to show
    fastify.get('/auth/config', async () => ({
      registrationEnabled: authConfig.registration.enabled,
      smtpConfigured: isMailConfigured({ host: mailConfig.smtp.host, port: mailConfig.smtp.port, secure: mailConfig.smtp.secure, from: mailConfig.from }),
      oidcEnabled: authConfig.oidc.enabled,
      localEnabled: authConfig.local.enabled,
    }));

    // POST /api/auth/register
    fastify.post('/auth/register', async (request, reply) => {
      if (!authConfig.registration.enabled) {
        return reply.code(403).send({ error: 'Registration is disabled' });
      }

      const ip = request.ip;
      if (!checkRateLimit(registerAttempts, ip, 'register')) {
        return reply.code(429).send({ error: 'Too many registration attempts' });
      }

      const parsed = RegisterBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
      }

      const { email, password, name } = parsed.data;

      if (findUserByEmail(db, email)) {
        return reply.code(409).send({ error: 'Email already registered' });
      }

      const role = isFirstUser(db) ? 'admin' : 'user';
      const passwordHash = await hashPassword(password);
      const userId = createUser(db, { email, name, passwordHash, role });

      const sessionId = createSession(db, userId, authConfig.session.maxAgeSeconds);
      void reply.setCookie(COOKIE_NAME, sessionId, cookieOpts);

      const user = findUserById(db, userId)!;
      return reply.code(201).send({ id: user.id, email: user.email, name: user.name, role: user.role });
    });

    // POST /api/auth/login
    fastify.post('/auth/login', async (request, reply) => {
      const parsed = LoginBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
      }

      const { email, password } = parsed.data;

      if (!checkRateLimit(loginAttempts, email.toLowerCase(), 'login')) {
        return reply.code(429).send({ error: 'Too many login attempts. Try again later.' });
      }

      const user = findUserByEmail(db, email);
      // Always run password verification to prevent timing attacks even when user not found.
      const hashToCheck = user?.password_hash ?? '$2b$12$invalidhashsowerunverifyanyway00000000000000000000000000';
      const isValid = await verifyPassword(password, hashToCheck);

      if (!user || !isValid || user.is_active === 0) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      const sessionId = createSession(db, user.id, authConfig.session.maxAgeSeconds);
      void reply.setCookie(COOKIE_NAME, sessionId, cookieOpts);

      return reply.send({ id: user.id, email: user.email, name: user.name, role: user.role });
    });

    // POST /api/auth/logout (requires auth via middleware)
    fastify.post('/auth/logout', async (request, reply) => {
      const sessionId = request.cookies?.[COOKIE_NAME];
      const user = findUserById(db, request.userId);
      if (sessionId) destroySession(db, sessionId);
      void reply.clearCookie(COOKIE_NAME, { path: '/' });

      // For OIDC users, check if the provider supports RP-initiated logout.
      if (user?.auth_method === 'oidc' && authConfig.oidc.enabled && authConfig.oidc.issuer) {
        try {
          const oidcConfig = await buildOidcConfig({
            issuer: authConfig.oidc.issuer,
            clientId: authConfig.oidc.clientId,
            clientSecret: process.env['DASHDASH_OIDC_SECRET'] ?? '',
            scopes: authConfig.oidc.scopes,
          });
          const endSessionUrl = getEndSessionUrl(oidcConfig);
          if (endSessionUrl) {
            return reply.send({ ok: true, redirectUrl: endSessionUrl });
          }
        } catch {
          // If discovery fails, fall through to normal logout
        }
      }

      return reply.send({ ok: true });
    });

    // GET /api/auth/me (requires auth via middleware)
    fastify.get('/auth/me', async (request, reply) => {
      const user = findUserById(db, request.userId);
      if (!user) return reply.code(401).send({ error: 'User not found' });
      return reply.send({ id: user.id, email: user.email, name: user.name, role: user.role, authMethod: user.auth_method });
    });

    // PATCH /api/auth/me (requires auth via middleware)
    fastify.patch('/auth/me', async (request, reply) => {
      const parsed = UpdateMeBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
      }

      const { name, email, password, currentPassword } = parsed.data;
      const user = findUserById(db, request.userId);
      if (!user) return reply.code(401).send({ error: 'User not found' });

      const updates: Parameters<typeof updateUser>[2] = {};

      if (name !== undefined) updates.name = name;

      if (email !== undefined) {
        const normalized = email.toLowerCase().trim();
        if (normalized !== user.email) {
          const existing = findUserByEmail(db, normalized);
          if (existing) return reply.code(409).send({ error: 'Email already in use' });
          updates.email = normalized;
        }
      }

      if (password !== undefined) {
        if (!currentPassword) {
          return reply.code(400).send({ error: 'currentPassword is required to change password' });
        }
        const isValid = await verifyPassword(currentPassword, user.password_hash ?? '');
        if (!isValid) {
          return reply.code(403).send({ error: 'Current password is incorrect' });
        }
        updates.passwordHash = await hashPassword(password);
      }

      updateUser(db, request.userId, updates);
      return reply.send({ ok: true });
    });

    // DELETE /api/auth/me — delete own account (requires email confirmation)
    fastify.delete('/auth/me', async (request, reply) => {
      const parsed = z.object({ email: z.string().email() }).safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Email confirmation required' });
      }

      const user = findUserById(db, request.userId);
      if (!user) return reply.code(401).send({ error: 'User not found' });

      if (parsed.data.email.toLowerCase().trim() !== user.email) {
        return reply.code(403).send({ error: 'Email does not match' });
      }

      if (user.role === 'admin' && countAdmins(db) <= 1) {
        return reply.code(403).send({ error: 'Cannot delete the last admin account' });
      }

      destroyAllUserSessions(db, request.userId);
      deleteUser(db, request.userId);
      reply.clearCookie('dashdash_session', { path: '/' });
      return reply.send({ ok: true });
    });

    // POST /api/auth/forgot-password
    fastify.post('/auth/forgot-password', async (request, reply) => {
      const parsed = ForgotPasswordBodySchema.safeParse(request.body);
      if (!parsed.success) {
        // Always 200 — no enumeration
        return reply.send({ ok: true });
      }

      const { email } = parsed.data;
      if (!checkRateLimit(forgotAttempts, email.toLowerCase(), 'forgot')) {
        // Still return 200 to prevent enumeration
        return reply.send({ ok: true });
      }

      const smtpConfig = { host: mailConfig.smtp.host, port: mailConfig.smtp.port, secure: mailConfig.smtp.secure, from: mailConfig.from };

      if (!isMailConfigured(smtpConfig)) {
        fastify.log.warn('Forgot-password request received but SMTP is not configured');
        return reply.send({ ok: true });
      }

      const user = findUserByEmail(db, email);
      if (!user || user.is_active === 0) {
        // No user — return 200 silently (no enumeration)
        return reply.send({ ok: true });
      }

      const { raw, hash } = generateResetToken();
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRES_SECONDS * 1000).toISOString();

      db.prepare(`
        INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(randomUUID(), user.id, hash, expiresAt);

      const baseUrl = process.env['DASHDASH_BASE_URL'] ?? 'http://localhost:3000';
      const resetUrl = `${baseUrl}/reset-password?token=${raw}`;

      try {
        await sendPasswordResetEmail(smtpConfig, user.email, resetUrl);
      } catch (err) {
        fastify.log.error({ err }, 'Failed to send password reset email');
      }

      return reply.send({ ok: true });
    });

    // GET /api/auth/oidc/login — initiates OIDC Authorization Code + PKCE flow
    fastify.get('/auth/oidc/login', async (request, reply) => {
      if (!authConfig.oidc.enabled) {
        return reply.code(404).send({ error: 'OIDC is not configured' });
      }

      try {
        const oidcConfig = await buildOidcConfig({
          issuer: authConfig.oidc.issuer,
          clientId: authConfig.oidc.clientId,
          clientSecret: process.env['DASHDASH_OIDC_SECRET'] ?? '',
          scopes: authConfig.oidc.scopes,
        });

        const state = generateState();
        const codeVerifier = generateCodeVerifier();
        const baseUrl = process.env['DASHDASH_BASE_URL'] ?? 'http://localhost:3000';
        const redirectUri = `${baseUrl}/api/auth/oidc/callback`;

        createOidcState(db, state, codeVerifier, redirectUri, OIDC_STATE_EXPIRES_SECONDS);

        const authUrl = await buildAuthorizationUrl(oidcConfig, state, codeVerifier, redirectUri, authConfig.oidc.scopes);
        return reply.redirect(authUrl.toString());
      } catch (err) {
        fastify.log.error({ err }, 'OIDC login initiation failed');
        return reply.redirect('/?error=oidc_config');
      }
    });

    // GET /api/auth/oidc/callback — handles OIDC provider redirect
    fastify.get('/auth/oidc/callback', async (request, reply) => {
      if (!authConfig.oidc.enabled) {
        return reply.redirect('/?error=oidc_disabled');
      }

      const query = request.query as Record<string, string | undefined>;
      const stateParam = query['state'];
      const errorParam = query['error'];

      if (errorParam) {
        fastify.log.warn({ error: errorParam }, 'OIDC provider returned error');
        return reply.redirect('/?error=oidc_provider');
      }

      if (!stateParam) {
        return reply.redirect('/?error=oidc_state');
      }

      const storedState = consumeOidcState(db, stateParam);
      if (!storedState) {
        return reply.redirect('/?error=oidc_state');
      }

      try {
        const oidcConfig = await buildOidcConfig({
          issuer: authConfig.oidc.issuer,
          clientId: authConfig.oidc.clientId,
          clientSecret: process.env['DASHDASH_OIDC_SECRET'] ?? '',
          scopes: authConfig.oidc.scopes,
        });

        const currentUrl = new URL(
          `${storedState.redirect_uri}?${new URLSearchParams(query as Record<string, string>).toString()}`
        );

        const tokenSet = await exchangeCode(
          oidcConfig,
          currentUrl,
          storedState.redirect_uri,
          storedState.code_verifier,
          stateParam
        );

        const idTokenClaims = tokenSet.claims?.();
        if (!idTokenClaims) {
          return reply.redirect('/?error=oidc_token');
        }

        const claims = extractUserClaims(idTokenClaims, authConfig.oidc.groupsClaim);

        if (!claims.email || !claims.emailVerified) {
          return reply.redirect('/?error=oidc_email_not_verified');
        }

        // Resolve user: existing OIDC user > auto-link local > JIT provision
        let userId: string | undefined;

        const existingOidcUser = findUserByOidc(db, authConfig.oidc.issuer, claims.sub);
        if (existingOidcUser) {
          if (existingOidcUser.is_active === 0) {
            return reply.redirect('/?error=oidc_account_inactive');
          }
          userId = existingOidcUser.id;
        } else {
          const existingLocalUser = findUserByEmail(db, claims.email);
          if (existingLocalUser && authConfig.oidc.autoLink) {
            if (existingLocalUser.is_active === 0) {
              return reply.redirect('/?error=oidc_account_inactive');
            }
            linkOidcToUser(db, existingLocalUser.id, authConfig.oidc.issuer, claims.sub);
            userId = existingLocalUser.id;
          } else {
            // JIT provision new user
            const isAdmin = isFirstUser(db) ||
              (authConfig.oidc.adminGroup !== '' && claims.groups.includes(authConfig.oidc.adminGroup));
            userId = createOidcUser(db, {
              email: claims.email,
              name: claims.name,
              oidcSubject: claims.sub,
              oidcIssuer: authConfig.oidc.issuer,
              role: isAdmin ? 'admin' : 'user',
            });
          }
        }

        const sessionId = createSession(db, userId, authConfig.session.maxAgeSeconds);
        void reply.setCookie(COOKIE_NAME, sessionId, cookieOpts);
        return reply.redirect('/');
      } catch (err) {
        fastify.log.error({ err }, 'OIDC callback failed');
        return reply.redirect('/?error=oidc_failed');
      }
    });

    // POST /api/auth/reset-password
    fastify.post('/auth/reset-password', async (request, reply) => {
      const parsed = ResetPasswordBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid or expired token' });
      }

      const { token, password } = parsed.data;
      const tokenHash = hashResetToken(token);

      const row = db.prepare(`
        SELECT id, user_id FROM password_reset_tokens
        WHERE token_hash = ?
          AND expires_at > datetime('now')
          AND used_at IS NULL
      `).get(tokenHash) as { id: string; user_id: string } | undefined;

      if (!row) {
        return reply.code(400).send({ error: 'Invalid or expired token' });
      }

      const passwordHash = await hashPassword(password);
      updateUser(db, row.user_id, { passwordHash });

      // Mark token as used and invalidate all existing sessions for this user.
      db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?").run(row.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);

      return reply.send({ ok: true });
    });
  };
}
