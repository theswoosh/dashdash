import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';

let server: FastifyInstance;
let db: InstanceType<typeof Database>;
let tmpDir: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-test-'));

  // Write a minimal services.yml for the test
  writeFileSync(join(tmpDir, 'services.yml'), `
- id: test-clock
  title: Clock
  widget: clock
  layout:
    w: 2
    h: 2
    x: 0
    y: 0
`);

  ({ server, db } = await buildApp({ dataDir: tmpDir, configDir: tmpDir }));
  await server.ready();
});

afterAll(async () => {
  await server.close();
  db.close();
  rmSync(tmpDir, { recursive: true });
});

describe('GET /api/services', () => {
  it('returns 200', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/services' });
    expect(res.statusCode).toBe(200);
  });

  it('returns the services from services.yml', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/services' });
    const { services } = res.json<{ services: { id: string }[] }>();
    expect(services).toHaveLength(1);
    expect(services[0]!.id).toBe('test-clock');
  });

  it('returns an empty array when services.yml is missing', async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'dashdash-empty-'));
    const { server: s2, db: db2 } = await buildApp({ dataDir: emptyDir, configDir: emptyDir });
    await s2.ready();

    const res = await s2.inject({ method: 'GET', url: '/api/services' });
    expect(res.json().services).toEqual([]);

    await s2.close();
    db2.close();
    rmSync(emptyDir, { recursive: true });
  });
});

describe('POST /api/services', () => {
  it('appends a new service to services.yml', async () => {
    const newSvc = {
      id: 'new-stats',
      title: 'Stats',
      widget: 'stats',
      layout: { x: 2, y: 0, w: 3, h: 2 },
      _userCreated: true,
    };
    const res = await server.inject({
      method: 'POST',
      url: '/api/services',
      payload: newSvc,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const get = await server.inject({ method: 'GET', url: '/api/services' });
    const { services } = get.json<{ services: { id: string }[] }>();
    expect(services.find(s => s.id === 'new-stats')).toBeDefined();
  });

  it('returns 409 when id already exists', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/services',
      payload: { id: 'test-clock', title: 'Dup', widget: 'clock', layout: { x: 0, y: 0, w: 2, h: 2 } },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('PATCH /api/services/:id', () => {
  it('updates title and options', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/services/test-clock',
      payload: { title: 'Updated Clock', options: { format24h: false } },
    });
    expect(res.statusCode).toBe(200);

    const get = await server.inject({ method: 'GET', url: '/api/services' });
    const { services } = get.json<{ services: { id: string; title: string; options: Record<string, unknown> }[] }>();
    const svc = services.find(s => s.id === 'test-clock');
    expect(svc?.title).toBe('Updated Clock');
    expect(svc?.options?.format24h).toBe(false);
  });

  it('returns 404 for unknown id', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/services/no-such',
      payload: { title: 'X' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/services/:id', () => {
  it('removes the service', async () => {
    // First add one to delete
    await server.inject({
      method: 'POST',
      url: '/api/services',
      payload: { id: 'to-delete', title: 'Temp', widget: 'clock', layout: { x: 0, y: 5, w: 2, h: 2 }, _userCreated: true },
    });

    const del = await server.inject({ method: 'DELETE', url: '/api/services/to-delete' });
    expect(del.statusCode).toBe(200);

    const get = await server.inject({ method: 'GET', url: '/api/services' });
    const { services } = get.json<{ services: { id: string }[] }>();
    expect(services.find(s => s.id === 'to-delete')).toBeUndefined();
  });

  it('returns 404 for unknown id', async () => {
    const res = await server.inject({ method: 'DELETE', url: '/api/services/ghost' });
    expect(res.statusCode).toBe(404);
  });
});
