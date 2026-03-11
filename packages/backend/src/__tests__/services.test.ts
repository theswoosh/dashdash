import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { loginAsAdmin } from './test-helpers.js';

let server: FastifyInstance;
let db: InstanceType<typeof Database>;
let tmpDir: string;
let authCookie: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-test-'));

  writeFileSync(join(tmpDir, 'services.yml'), `
- widget: clock
  title: Clock
  layout:
    w: 2
    h: 2
    x: 0
    y: 0
`);

  ({ server, db } = await buildApp({ dataDir: tmpDir, configDir: tmpDir }));
  await server.ready();
  authCookie = await loginAsAdmin(server);
});

afterAll(async () => {
  await server.close();
  db.close();
  rmSync(tmpDir, { recursive: true });
});

describe('GET /api/services', () => {
  it('returns 200', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/services', headers: { cookie: authCookie } });
    expect(res.statusCode).toBe(200);
  });

  it('returns the services from services.yml with derived id', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/services', headers: { cookie: authCookie } });
    const { services } = res.json<{ services: { id: string }[] }>();
    expect(services).toHaveLength(1);
    expect(services[0]!.id).toBe('clock');
  });

  it('returns an empty array when services.yml is missing', async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'dashdash-empty-'));
    const { server: s2, db: db2 } = await buildApp({ dataDir: emptyDir, configDir: emptyDir });
    await s2.ready();
    const cookie = await loginAsAdmin(s2);

    const res = await s2.inject({ method: 'GET', url: '/api/services', headers: { cookie } });
    expect(res.json().services).toEqual([]);

    await s2.close();
    db2.close();
    rmSync(emptyDir, { recursive: true });
  });
});

describe('POST /api/services', () => {
  it('appends a new service to services.yml', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/services',
      headers: { cookie: authCookie },
      payload: { id: 'stats', title: 'Stats', widget: 'stats', layout: { x: 2, y: 0, w: 3, h: 2 } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const get = await server.inject({ method: 'GET', url: '/api/services', headers: { cookie: authCookie } });
    const { services } = get.json<{ services: { id: string }[] }>();
    expect(services.find(s => s.id === 'stats')).toBeDefined();
  });

  it('returns 409 when derived id already exists', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/services',
      headers: { cookie: authCookie },
      payload: { id: 'clock', title: 'Dup', widget: 'clock', layout: { x: 0, y: 0, w: 2, h: 2 } },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('PATCH /api/services/:id', () => {
  it('updates title and options', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/services/clock',
      headers: { cookie: authCookie },
      payload: { title: 'Updated Clock', options: { format24h: false } },
    });
    expect(res.statusCode).toBe(200);

    const get = await server.inject({ method: 'GET', url: '/api/services', headers: { cookie: authCookie } });
    const { services } = get.json<{ services: { id: string; title: string; options: Record<string, unknown> }[] }>();
    const svc = services.find(s => s.id === 'clock');
    expect(svc?.title).toBe('Updated Clock');
    expect(svc?.options?.format24h).toBe(false);
  });

  it('returns 404 for unknown id', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/services/no-such',
      headers: { cookie: authCookie },
      payload: { title: 'X' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/services/:id', () => {
  it('removes the service', async () => {
    await server.inject({
      method: 'POST',
      url: '/api/services',
      headers: { cookie: authCookie },
      payload: { id: 'clock-2', title: 'Temp', widget: 'clock', layout: { x: 0, y: 5, w: 2, h: 2 } },
    });

    const del = await server.inject({ method: 'DELETE', url: '/api/services/clock-2', headers: { cookie: authCookie } });
    expect(del.statusCode).toBe(200);

    const get = await server.inject({ method: 'GET', url: '/api/services', headers: { cookie: authCookie } });
    const { services } = get.json<{ services: { id: string }[] }>();
    expect(services.find(s => s.id === 'clock-2')).toBeUndefined();
  });

  it('returns 404 for unknown id', async () => {
    const res = await server.inject({ method: 'DELETE', url: '/api/services/ghost', headers: { cookie: authCookie } });
    expect(res.statusCode).toBe(404);
  });
});

describe('YAML layout field behaviour', () => {
  it('returns layout x/y/w/h from services.yml as initial defaults', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/services', headers: { cookie: authCookie } });
    const { services } = res.json<{ services: { id: string; layout: { x: number; y: number; w: number; h: number } }[] }>();
    const clock = services.find(s => s.id === 'clock');
    expect(clock).toBeDefined();
    expect(clock!.layout.x).toBe(0);
    expect(clock!.layout.y).toBe(0);
    expect(clock!.layout.w).toBe(2);
    expect(clock!.layout.h).toBe(2);
  });

  it('PATCH layout override persists across reload', async () => {
    const patch = await server.inject({
      method: 'PATCH',
      url: '/api/services/clock',
      headers: { cookie: authCookie },
      payload: { layout: { x: 3, y: 1, w: 4, h: 3 } },
    });
    expect(patch.statusCode).toBe(200);

    const get = await server.inject({ method: 'GET', url: '/api/services', headers: { cookie: authCookie } });
    const { services } = get.json<{ services: { id: string; layout: { x: number; y: number; w: number; h: number } }[] }>();
    const clock = services.find(s => s.id === 'clock');
    expect(clock!.layout.x).toBe(3);
    expect(clock!.layout.y).toBe(1);
    expect(clock!.layout.w).toBe(4);
    expect(clock!.layout.h).toBe(3);
  });

  it('uses YAML layout when a new service is added', async () => {
    // Use a unique widget type so the derived id is predictable (widget name = id)
    await server.inject({
      method: 'POST',
      url: '/api/services',
      headers: { cookie: authCookie },
      payload: { id: 'notepad', title: 'Layout Test', widget: 'notepad', layout: { x: 5, y: 2, w: 3, h: 3 } },
    });

    const get = await server.inject({ method: 'GET', url: '/api/services', headers: { cookie: authCookie } });
    const { services } = get.json<{ services: { id: string; layout: { x: number; y: number; w: number; h: number } }[] }>();
    const svc = services.find(s => s.id === 'notepad');
    expect(svc).toBeDefined();
    expect(svc!.layout.x).toBe(5);
    expect(svc!.layout.y).toBe(2);
    expect(svc!.layout.w).toBe(3);
    expect(svc!.layout.h).toBe(3);
  });
});
