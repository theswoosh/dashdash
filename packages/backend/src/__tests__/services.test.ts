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
    // Point a fresh app at an empty dir with no services.yml
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
