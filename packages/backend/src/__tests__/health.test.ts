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

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string; version: string }>();
    expect(body.status).toBe('ok');
    expect(body.version).toBeTruthy();
  });
});
