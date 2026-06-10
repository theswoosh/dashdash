import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';

let server: FastifyInstance;
let db: Db;
let tmpDir: string;

async function setup() {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-auth-test-'));

  writeFileSync(join(tmpDir, 'services.yml'), '[]');
  writeFileSync(join(tmpDir, 'settings.yml'), 'title: test\n');

  ({ server, db } = await buildApp({ dataDir: tmpDir, configDir: tmpDir }));
  await server.ready();
}

async function teardown() {
  await server.close();
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
}

async function register(email = 'admin@test.local', password = 'password123', name = 'Admin') {
  return server.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password, name },
  });
}

async function login(email = 'admin@test.local', password = 'password123') {
  return server.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
}

function extractSessionCookie(headers: Record<string, string | string[]>): string | undefined {
  const setCookie = headers['set-cookie'];
  const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const match = cookieHeader?.match(/dashdash_session=([^;]+)/);
  return match?.[1];
}

// ============================================================
// Registration
// ============================================================

describe('POST /api/auth/register', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('first user becomes admin', async () => {
    const res = await register();
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.role).toBe('admin');
    expect(body.email).toBe('admin@test.local');
  });

  it('second user becomes normal user', async () => {
    await register();
    const res = await register('user@test.local', 'password123', 'User');
    expect(res.statusCode).toBe(201);
    expect(res.json().role).toBe('user');
  });

  it('does not set session cookie on registration', async () => {
    const res = await register();
    expect(res.statusCode).toBe(201);
    const setCookieHeader = (res.headers as Record<string, string | string[]>)['set-cookie'];
    const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
    const hasSession = cookieStr?.includes('dashdash_session') ?? false;
    expect(hasSession).toBe(false);
  });

  it('rejects duplicate email', async () => {
    await register();
    const res = await register();
    expect(res.statusCode).toBe(409);
  });

  it('rejects short password', async () => {
    const res = await register('a@test.local', 'short');
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid email', async () => {
    const res = await register('not-an-email', 'password123');
    expect(res.statusCode).toBe(400);
  });
});

// ============================================================
// Login
// ============================================================

describe('POST /api/auth/login', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('returns user and sets cookie on valid credentials', async () => {
    await register();
    const res = await login();
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe('admin@test.local');
    expect(extractSessionCookie(res.headers as Record<string, string | string[]>)).toMatch(/^[A-Za-z0-9_-]{20,}/);
  });

  it('returns same error for wrong password and nonexistent email', async () => {
    await register();
    const wrongPw = await login('admin@test.local', 'wrongpassword');
    const noUser = await login('ghost@test.local', 'password123');
    expect(wrongPw.statusCode).toBe(401);
    expect(noUser.statusCode).toBe(401);
    expect(wrongPw.json().error).toBe(noUser.json().error);
  });

  it('returns 403 for deactivated user', async () => {
    await register();
    db.prepare("UPDATE users SET is_active = 0 WHERE email = 'admin@test.local'").run();
    const res = await login();
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toContain('disabled');
  });
});

// ============================================================
// Me + Logout
// ============================================================

describe('GET /api/auth/me', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('returns current user with valid session', async () => {
    await register();
    const loginRes = await login();
    const cookie = extractSessionCookie(loginRes.headers as Record<string, string | string[]>);

    const res = await server.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: `dashdash_session=${cookie}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe('admin@test.local');
  });

  it('returns 401 without session', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with an expired session', async () => {
    await register();
    const loginRes = await login();
    const cookie = extractSessionCookie(loginRes.headers as Record<string, string | string[]>);

    db.prepare("UPDATE sessions SET expires_at = datetime('now', '-1 second')").run();

    const res = await server.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: `dashdash_session=${cookie}` },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('destroys session so subsequent requests are 401', async () => {
    await register();
    const loginRes = await login();
    const cookie = extractSessionCookie(loginRes.headers as Record<string, string | string[]>);

    await server.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: `dashdash_session=${cookie}` },
    });

    const meRes = await server.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: `dashdash_session=${cookie}` },
    });
    expect(meRes.statusCode).toBe(401);
  });
});

// ============================================================
// Auth middleware — protected routes
// ============================================================

describe('Auth middleware', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('blocks /api/services without session', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/services' });
    expect(res.statusCode).toBe(401);
  });

  it('allows /api/health without session', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
  });

  it('allows /api/auth/config without session', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/auth/config' });
    expect(res.statusCode).toBe(200);
  });
});

// ============================================================
// PATCH /api/auth/me
// ============================================================

describe('PATCH /api/auth/me', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('updates display name', async () => {
    await register();
    const loginRes = await login();
    const cookie = extractSessionCookie(loginRes.headers as Record<string, string | string[]>);

    const patchRes = await server.inject({
      method: 'PATCH',
      url: '/api/auth/me',
      headers: { cookie: `dashdash_session=${cookie}` },
      payload: { name: 'New Name' },
    });
    expect(patchRes.statusCode).toBe(200);

    const meRes = await server.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: `dashdash_session=${cookie}` },
    });
    expect(meRes.json().name).toBe('New Name');
  });

  it('changes password with valid currentPassword', async () => {
    await register();
    const loginRes = await login();
    const cookie = extractSessionCookie(loginRes.headers as Record<string, string | string[]>);

    const patchRes = await server.inject({
      method: 'PATCH',
      url: '/api/auth/me',
      headers: { cookie: `dashdash_session=${cookie}` },
      payload: { password: 'newpassword123', currentPassword: 'password123' },
    });
    expect(patchRes.statusCode).toBe(200);

    // Old password should no longer work.
    const oldLogin = await login('admin@test.local', 'password123');
    expect(oldLogin.statusCode).toBe(401);

    // New password works.
    const newLogin = await login('admin@test.local', 'newpassword123');
    expect(newLogin.statusCode).toBe(200);
  });

  it('rejects password change with wrong currentPassword', async () => {
    await register();
    const loginRes = await login();
    const cookie = extractSessionCookie(loginRes.headers as Record<string, string | string[]>);

    const res = await server.inject({
      method: 'PATCH',
      url: '/api/auth/me',
      headers: { cookie: `dashdash_session=${cookie}` },
      payload: { password: 'newpassword123', currentPassword: 'wrongpassword' },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ============================================================
// Password reset flow
// ============================================================

describe('Password reset flow', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('forgot-password always returns 200 regardless of email existence', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: 'nobody@test.local' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('reset-password fails with invalid token', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: 'invalid-token', password: 'newpassword123' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('reset-password succeeds with valid token', async () => {
    await register();
    const user = db.prepare("SELECT id FROM users WHERE email = 'admin@test.local'").get() as { id: string };

    // Manually insert a reset token.
    const { generateResetToken } = await import('../services/password.service.js');
    const { raw, hash } = generateResetToken();
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    db.prepare(`INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`)
      .run('tok-1', user.id, hash, expiresAt);

    const res = await server.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: raw, password: 'brandnewpassword' },
    });
    expect(res.statusCode).toBe(200);

    // New password works.
    const loginRes = await login('admin@test.local', 'brandnewpassword');
    expect(loginRes.statusCode).toBe(200);
  });

  it('used reset token cannot be reused', async () => {
    await register();
    const user = db.prepare("SELECT id FROM users WHERE email = 'admin@test.local'").get() as { id: string };

    const { generateResetToken } = await import('../services/password.service.js');
    const { raw, hash } = generateResetToken();
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    db.prepare(`INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`)
      .run('tok-2', user.id, hash, expiresAt);

    await server.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: raw, password: 'firstpassword123' },
    });

    const res2 = await server.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: raw, password: 'secondpassword123' },
    });
    expect(res2.statusCode).toBe(400);
  });
});

// ============================================================
// Admin user management
// ============================================================

describe('Admin user management', () => {
  let adminCookie: string;
  let userCookie: string;

  beforeEach(async () => {
    await setup();
    await register('admin@test.local', 'password123', 'Admin');
    await register('user@test.local', 'password123', 'User');

    const adminLogin = await login('admin@test.local', 'password123');
    adminCookie = extractSessionCookie(adminLogin.headers as Record<string, string | string[]>)!;

    const userLogin = await login('user@test.local', 'password123');
    userCookie = extractSessionCookie(userLogin.headers as Record<string, string | string[]>)!;
  });
  afterEach(teardown);

  it('admin can list users', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/users',
      headers: { cookie: `dashdash_session=${adminCookie}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
  });

  it('non-admin cannot list users', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/users',
      headers: { cookie: `dashdash_session=${userCookie}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('admin can promote a user to admin', async () => {
    const users = (await server.inject({
      method: 'GET', url: '/api/users',
      headers: { cookie: `dashdash_session=${adminCookie}` },
    })).json() as Array<{ id: string; role: string; email: string }>;
    const normalUser = users.find(u => u.email === 'user@test.local')!;

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/users/${normalUser.id}`,
      headers: { cookie: `dashdash_session=${adminCookie}` },
      payload: { role: 'admin' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('cannot delete an admin user', async () => {
    const users = (await server.inject({
      method: 'GET', url: '/api/users',
      headers: { cookie: `dashdash_session=${adminCookie}` },
    })).json() as Array<{ id: string; role: string; email: string }>;
    const adminUser = users.find(u => u.email === 'admin@test.local')!;

    const res = await server.inject({
      method: 'DELETE',
      url: `/api/users/${adminUser.id}`,
      headers: { cookie: `dashdash_session=${adminCookie}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('admin can delete a normal user', async () => {
    const users = (await server.inject({
      method: 'GET', url: '/api/users',
      headers: { cookie: `dashdash_session=${adminCookie}` },
    })).json() as Array<{ id: string; role: string; email: string }>;
    const normalUser = users.find(u => u.email === 'user@test.local')!;

    const res = await server.inject({
      method: 'DELETE',
      url: `/api/users/${normalUser.id}`,
      headers: { cookie: `dashdash_session=${adminCookie}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('cannot demote the last admin', async () => {
    const users = (await server.inject({
      method: 'GET', url: '/api/users',
      headers: { cookie: `dashdash_session=${adminCookie}` },
    })).json() as Array<{ id: string; role: string; email: string }>;
    const adminUser = users.find(u => u.email === 'admin@test.local')!;

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/users/${adminUser.id}`,
      headers: { cookie: `dashdash_session=${adminCookie}` },
      payload: { role: 'user' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('admin can create a user manually', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/users',
      headers: { cookie: `dashdash_session=${adminCookie}` },
      payload: { email: 'new@test.local', password: 'password123', name: 'New' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().role).toBe('user');
  });
});

// ============================================================
// Rate limiting (SQLite-backed)
// ============================================================

describe('login rate limiting', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('blocks the 6th attempt in the window with 429', async () => {
    await register();
    for (let i = 0; i < 5; i++) {
      const res = await login('admin@test.local', 'wrongpassword');
      expect(res.statusCode).toBe(401);
    }
    const blocked = await login('admin@test.local', 'wrongpassword');
    expect(blocked.statusCode).toBe(429);
  });

  it('lockout survives a server restart (persisted in SQLite)', async () => {
    await register();
    for (let i = 0; i < 5; i++) {
      await login('admin@test.local', 'wrongpassword');
    }

    // Simulate a container restart: close app + db, rebuild on the same dataDir.
    await server.close();
    db.close();
    ({ server, db } = await buildApp({ dataDir: tmpDir, configDir: tmpDir }));
    await server.ready();

    const blocked = await login('admin@test.local', 'password123');
    expect(blocked.statusCode).toBe(429);
  });

  it('successful login resets the failure counter', async () => {
    await register();
    for (let i = 0; i < 4; i++) {
      await login('admin@test.local', 'wrongpassword');
    }
    const ok = await login('admin@test.local', 'password123');
    expect(ok.statusCode).toBe(200);

    // Counter was cleared — further attempts start a fresh window.
    const afterReset = await login('admin@test.local', 'wrongpassword');
    expect(afterReset.statusCode).toBe(401);
  });
});
