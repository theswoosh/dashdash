import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
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
  ({ server, db } = await buildApp({ dataDir: tmpDir, configDir: tmpDir }));
  await server.ready();
});

afterAll(async () => {
  await server.close();
  db.close();
  rmSync(tmpDir, { recursive: true });
});

describe('GET /api/layout', () => {
  it('returns null layout for an unknown board', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/layout?board=unknown' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ layout: null });
  });

  it('defaults to board=default when query param omitted', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/layout' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('layout');
  });
});

describe('PUT /api/layout → GET /api/layout round-trip', () => {
  it('saves and retrieves a layout', async () => {
    const layout = [{ i: 'clock', x: 0, y: 0, w: 2, h: 2 }];

    const put = await server.inject({
      method: 'PUT',
      url: '/api/layout',
      payload: { board: 'test-board', layout },
    });
    expect(put.statusCode).toBe(200);

    const get = await server.inject({ method: 'GET', url: '/api/layout?board=test-board' });
    expect(get.statusCode).toBe(200);
    expect(get.json().layout).toEqual(layout);
  });

  it('overwrites an existing layout', async () => {
    const first = [{ i: 'a', x: 0, y: 0, w: 1, h: 1 }];
    const second = [{ i: 'b', x: 1, y: 1, w: 3, h: 3 }];

    await server.inject({ method: 'PUT', url: '/api/layout', payload: { board: 'overwrite-board', layout: first } });
    await server.inject({ method: 'PUT', url: '/api/layout', payload: { board: 'overwrite-board', layout: second } });

    const get = await server.inject({ method: 'GET', url: '/api/layout?board=overwrite-board' });
    expect(get.json().layout).toEqual(second);
  });
});
