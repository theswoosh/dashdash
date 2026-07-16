import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildApp } from '../app.js';
import { loginAsAdmin } from './test-helpers.js';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';

let server: FastifyInstance;
let db: InstanceType<typeof Database>;
let tmpDir: string;
let publicDir: string;
let authCookie: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-test-'));
  publicDir = join(tmpDir, 'public');
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(join(publicDir, 'index.html'), '<!doctype html><html><body>spa</body></html>');

  ({ server, db } = await buildApp({ dataDir: tmpDir, configDir: tmpDir, publicDir }));
  await server.ready();
  authCookie = await loginAsAdmin(server);
});

afterAll(async () => {
  await server.close();
  db.close();
  rmSync(tmpDir, { recursive: true });
});

describe('SPA fallback vs API 404', () => {
  it('returns JSON 404 for an unmatched /api/* route', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/does-not-exist',
      headers: { cookie: authCookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.json()).toEqual({ error: 'Not Found', path: '/api/does-not-exist' });
  });

  it('still serves the SPA shell for a non-API unmatched route', async () => {
    const res = await server.inject({ method: 'GET', url: '/some/client-side/route' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('spa');
  });
});
