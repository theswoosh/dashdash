import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';

vi.mock('../services/oidc.service.js', () => ({
  buildOidcConfig: vi.fn(async () => ({})),
  buildAuthorizationUrl: vi.fn(async () => new URL('https://idp.example.com/auth')),
  exchangeCode: vi.fn(async () => ({ id_token: 'mock-id-token-123', claims: () => ({}) })),
  extractUserClaims: vi.fn(),
  generateCodeVerifier: vi.fn(() => 'verifier'),
  generateState: vi.fn(() => 'state123'),
  getEndSessionUrl: vi.fn((_config: unknown, params?: { idTokenHint?: string; postLogoutRedirectUri?: string }) => {
    const url = new URL('https://idp.example.com/realms/test/protocol/openid-connect/logout');
    if (params?.idTokenHint) url.searchParams.set('id_token_hint', params.idTokenHint);
    if (params?.postLogoutRedirectUri) url.searchParams.set('post_logout_redirect_uri', params.postLogoutRedirectUri);
    return url.toString();
  }),
}));

import { buildApp } from '../app.js';
import { extractUserClaims } from '../services/oidc.service.js';

const extractUserClaimsMock = vi.mocked(extractUserClaims);

let server: FastifyInstance;
let db: Db;
let tmpDir: string;

async function setup() {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-logout-oidc-test-'));

  writeFileSync(join(tmpDir, 'services.yml'), '[]');
  writeFileSync(join(tmpDir, 'settings.yml'), 'title: test\n');

  process.env['BOARD_OIDC_ISSUER'] = 'https://idp.example.com';
  process.env['BOARD_OIDC_CLIENT_ID'] = 'test-client';
  process.env['BOARD_OIDC_SECRET'] = 'test-secret';
  process.env['BOARD_BASE_URL'] = 'http://localhost:5173';

  ({ server, db } = await buildApp({ dataDir: tmpDir, configDir: tmpDir }));
  await server.ready();
}

async function teardown() {
  await server.close();
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env['BOARD_OIDC_ISSUER'];
  delete process.env['BOARD_OIDC_CLIENT_ID'];
  delete process.env['BOARD_OIDC_SECRET'];
  delete process.env['BOARD_BASE_URL'];
}

function extractSessionCookie(headers: Record<string, string | string[]>): string | undefined {
  const setCookie = headers['set-cookie'];
  const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const match = cookieHeader?.match(/dashdash_session=([^;]+)/);
  return match?.[1];
}

async function loginViaOidc(email: string): Promise<string | undefined> {
  extractUserClaimsMock.mockReturnValue({
    sub: `sub-${email}`,
    email,
    emailVerified: true,
    name: 'OIDC User',
    groups: [],
  });

  const loginResponse = await server.inject({ method: 'GET', url: '/api/auth/oidc/login' });
  expect(loginResponse.statusCode).toBe(302);

  const callbackResponse = await server.inject({
    method: 'GET',
    url: '/api/auth/oidc/callback?state=state123&code=abc123',
  });
  expect(callbackResponse.statusCode).toBe(302);
  expect(callbackResponse.headers['location']).toBe('/');

  return extractSessionCookie(callbackResponse.headers as Record<string, string | string[]>);
}

describe('POST /api/auth/logout — RP-initiated logout params', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('includes id_token_hint and post_logout_redirect_uri when the session has a stored OIDC id_token', async () => {
    const cookie = await loginViaOidc('oidc-user1@test.local');
    expect(cookie).toBeTruthy();

    const row = db.prepare('SELECT oidc_id_token FROM sessions WHERE id = ?').get(cookie) as
      | { oidc_id_token: string | null }
      | undefined;
    expect(row?.oidc_id_token).toBe('mock-id-token-123');

    const logoutResponse = await server.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: `dashdash_session=${cookie}` },
    });

    expect(logoutResponse.statusCode).toBe(200);
    const body = logoutResponse.json();
    expect(body.redirectUrl).toContain('id_token_hint=mock-id-token-123');
    expect(body.redirectUrl).toContain('post_logout_redirect_uri=' + encodeURIComponent('http://localhost:5173'));
  });

  it('falls back to the bare end-session endpoint when the session has no stored id_token', async () => {
    const cookie = await loginViaOidc('oidc-user2@test.local');
    expect(cookie).toBeTruthy();

    // Simulate a pre-migration session (created before oidc_id_token existed).
    db.prepare('UPDATE sessions SET oidc_id_token = NULL WHERE id = ?').run(cookie);

    const logoutResponse = await server.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: `dashdash_session=${cookie}` },
    });

    expect(logoutResponse.statusCode).toBe(200);
    const body = logoutResponse.json();
    expect(body.redirectUrl).toBe('https://idp.example.com/realms/test/protocol/openid-connect/logout');
    expect(body.redirectUrl).not.toContain('id_token_hint');
    expect(body.redirectUrl).not.toContain('post_logout_redirect_uri');
  });

  it('leaves local-auth logout unaffected (no redirectUrl, session destroyed)', async () => {
    await server.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'local-user@test.local', password: 'password123', name: 'Local User' },
    });
    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'local-user@test.local', password: 'password123' },
    });
    const cookie = extractSessionCookie(loginRes.headers as Record<string, string | string[]>);
    expect(cookie).toBeTruthy();

    const logoutResponse = await server.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: `dashdash_session=${cookie}` },
    });

    expect(logoutResponse.statusCode).toBe(200);
    const body = logoutResponse.json();
    expect(body).toEqual({ ok: true });
    expect(body.redirectUrl).toBeUndefined();

    const meRes = await server.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: `dashdash_session=${cookie}` },
    });
    expect(meRes.statusCode).toBe(401);
  });
});
