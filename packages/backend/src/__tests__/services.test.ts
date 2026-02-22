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

  // No id field — system derives it from widget type at load time
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

  it('returns the services from services.yml with derived id', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/services' });
    const { services } = res.json<{ services: { id: string }[] }>();
    expect(services).toHaveLength(1);
    expect(services[0]!.id).toBe('clock');
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
    // Frontend generates id 'stats' (widget type, no conflict)
    const res = await server.inject({
      method: 'POST',
      url: '/api/services',
      payload: { id: 'stats', title: 'Stats', widget: 'stats', layout: { x: 2, y: 0, w: 3, h: 2 } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const get = await server.inject({ method: 'GET', url: '/api/services' });
    const { services } = get.json<{ services: { id: string }[] }>();
    // Derived id for second widget is 'stats' (widget type, unique)
    expect(services.find(s => s.id === 'stats')).toBeDefined();
  });

  it('returns 409 when derived id already exists', async () => {
    // Sending id 'clock' conflicts with the existing derived 'clock' service
    const res = await server.inject({
      method: 'POST',
      url: '/api/services',
      payload: { id: 'clock', title: 'Dup', widget: 'clock', layout: { x: 0, y: 0, w: 2, h: 2 } },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('PATCH /api/services/:id', () => {
  it('updates title and options', async () => {
    // Derived id for the clock widget is 'clock'
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/services/clock',
      payload: { title: 'Updated Clock', options: { format24h: false } },
    });
    expect(res.statusCode).toBe(200);

    const get = await server.inject({ method: 'GET', url: '/api/services' });
    const { services } = get.json<{ services: { id: string; title: string; options: Record<string, unknown> }[] }>();
    const svc = services.find(s => s.id === 'clock');
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
    // Add a second clock; frontend derives 'clock-2' (clock exists, stats exists)
    await server.inject({
      method: 'POST',
      url: '/api/services',
      payload: { id: 'clock-2', title: 'Temp', widget: 'clock', layout: { x: 0, y: 5, w: 2, h: 2 } },
    });

    const del = await server.inject({ method: 'DELETE', url: '/api/services/clock-2' });
    expect(del.statusCode).toBe(200);

    const get = await server.inject({ method: 'GET', url: '/api/services' });
    const { services } = get.json<{ services: { id: string }[] }>();
    expect(services.find(s => s.id === 'clock-2')).toBeUndefined();
  });

  it('returns 404 for unknown id', async () => {
    const res = await server.inject({ method: 'DELETE', url: '/api/services/ghost' });
    expect(res.statusCode).toBe(404);
  });
});
