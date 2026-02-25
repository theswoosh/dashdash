import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import { buildApp } from '../app.js';
import { loginAsAdmin } from './test-helpers.js';

const SERVICES_YML = `
- id: health-test
  title: Health
  widget: healthcheck
  layout: { w: 2, h: 2, x: 0, y: 0 }
  options:
    url: http://localhost:9999/nonexistent

- id: stats-test
  title: Stats
  widget: stats
  layout: { w: 2, h: 2, x: 2, y: 0 }

- id: clock-test
  title: Clock
  widget: clock
  layout: { w: 2, h: 2, x: 4, y: 0 }
`;

let server: FastifyInstance;
let db: Db;
let tmpDir: string;
let authCookie: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-widget-test-'));
  writeFileSync(join(tmpDir, 'services.yml'), SERVICES_YML);
  ({ server, db } = await buildApp({ dataDir: tmpDir, configDir: tmpDir }));
  await server.ready();
  authCookie = await loginAsAdmin(server);
});

afterAll(async () => {
  await server.close();
  db.close();
  rmSync(tmpDir, { recursive: true });
});

describe('GET /api/widget/:serviceId/data', () => {
  it('returns 404 for unknown serviceId', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/widget/nonexistent/data', headers: { cookie: authCookie } });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ ok: false });
  });

  it('returns 400 for clientOnly widget (clock)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/widget/clock-test/data', headers: { cookie: authCookie } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ ok: false });
  });

  it('returns 200 for stats widget', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/widget/stats-test/data', headers: { cookie: authCookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; data: { cpuLoadPct: number; memUsedPct: number; uptimeSecs: number } };
    expect(body.ok).toBe(true);
    expect(typeof body.data.cpuLoadPct).toBe('number');
    expect(typeof body.data.memUsedPct).toBe('number');
    expect(typeof body.data.uptimeSecs).toBe('number');
  });

  it('returns 200 with down status for unreachable healthcheck', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/widget/health-test/data', headers: { cookie: authCookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; data: { status: string } };
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe('down');
  });
});
