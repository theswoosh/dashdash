import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';

vi.mock('../services/oidc.service.js', () => ({
  buildOidcConfig: vi.fn(async () => ({})),
  buildAuthorizationUrl: vi.fn(async () => new URL('https://idp.example.com/auth')),
  exchangeCode: vi.fn(async () => ({ claims: () => ({}) })),
  extractUserClaims: vi.fn(),
  generateCodeVerifier: vi.fn(() => 'verifier'),
  generateState: vi.fn(() => 'state123'),
  getEndSessionUrl: vi.fn(),
}));

import { buildApp } from '../app.js';
import { extractUserClaims } from '../services/oidc.service.js';

const extractUserClaimsMock = vi.mocked(extractUserClaims);

let server: FastifyInstance;
let db: Db;
let tmpDir: string;

async function setup() {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-oidc-callback-test-'));

  writeFileSync(join(tmpDir, 'services.yml'), '[]');
  writeFileSync(join(tmpDir, 'settings.yml'), 'title: test\n');

  process.env['BOARD_OIDC_ISSUER'] = 'https://idp.example.com';
  process.env['BOARD_OIDC_CLIENT_ID'] = 'test-client';
  process.env['BOARD_OIDC_SECRET'] = 'test-secret';
  process.env['BOARD_OIDC_AUTO_LINK'] = 'false';

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
  delete process.env['BOARD_OIDC_AUTO_LINK'];
}

describe('GET /api/auth/oidc/callback — auto-link disabled + email collision', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('redirects to oidc_email_exists and leaves the local account untouched instead of throwing on the UNIQUE constraint', async () => {
    await server.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'collide@test.local', password: 'password123', name: 'Local User' },
    });

    // Initiates the flow so a valid oidc_auth_state row exists for the callback's state check.
    const loginResponse = await server.inject({ method: 'GET', url: '/api/auth/oidc/login' });
    expect(loginResponse.statusCode).toBe(302);

    extractUserClaimsMock.mockReturnValue({
      sub: 'oidc-subject-1',
      email: 'collide@test.local',
      emailVerified: true,
      name: 'OIDC User',
      groups: [],
    });

    const callbackResponse = await server.inject({
      method: 'GET',
      url: '/api/auth/oidc/callback?state=state123&code=abc123',
    });

    expect(callbackResponse.statusCode).toBe(302);
    expect(callbackResponse.headers['location']).toBe('/?error=oidc_email_exists');

    const rows = db.prepare('SELECT id, auth_method FROM users WHERE email = ?').all('collide@test.local') as
      { id: string; auth_method: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.auth_method).toBe('local');
  });
});
