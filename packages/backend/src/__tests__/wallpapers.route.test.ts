import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import { loginAsAdmin } from './test-helpers.js';

let server: FastifyInstance;
let db: Db;
let tmpDir: string;

async function setup() {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-wallpapers-test-'));
  writeFileSync(join(tmpDir, 'services.yml'), '[]');
  writeFileSync(join(tmpDir, 'settings.yml'), 'title: test\n');
  ({ server, db } = await buildApp({ dataDir: tmpDir, configDir: tmpDir }));
  await server.ready();
}

async function teardown() {
  await server.close();
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
}

describe('GET /api/wallpapers/builtin', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('returns an empty list when config/wallpapers is empty', async () => {
    const cookie = await loginAsAdmin(server);
    const res = await server.inject({ method: 'GET', url: '/api/wallpapers/builtin', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ wallpapers: [] });
  });

  it('lists matching fixture files and excludes non-matching ones', async () => {
    const cookie = await loginAsAdmin(server);
    const wallpapersDir = join(tmpDir, 'wallpapers');
    mkdirSync(wallpapersDir, { recursive: true });
    writeFileSync(join(wallpapersDir, 'ascii_bg.png'), 'fake-png');
    writeFileSync(join(wallpapersDir, 'classic_bg.jpg'), 'fake-jpg');
    writeFileSync(join(wallpapersDir, 'notes.txt'), 'nope');
    writeFileSync(join(wallpapersDir, 'weird_name.png'), 'nope');

    const res = await server.inject({ method: 'GET', url: '/api/wallpapers/builtin', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      wallpapers: [
        { name: 'ascii', file: 'ascii_bg.png', url: '/api/wallpapers/builtin/ascii_bg.png' },
        { name: 'classic', file: 'classic_bg.jpg', url: '/api/wallpapers/builtin/classic_bg.jpg' },
      ],
    });
  });

  it('requires auth', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/wallpapers/builtin' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/wallpapers/builtin/:file', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('serves a valid built-in wallpaper with the right content-type', async () => {
    const cookie = await loginAsAdmin(server);
    const wallpapersDir = join(tmpDir, 'wallpapers');
    mkdirSync(wallpapersDir, { recursive: true });
    writeFileSync(join(wallpapersDir, 'ascii_bg.png'), 'fake-png-bytes');

    const res = await server.inject({
      method: 'GET',
      url: '/api/wallpapers/builtin/ascii_bg.png',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.body).toBe('fake-png-bytes');
  });

  it('404s on a filename that does not match the manifest regex, without touching the fs', async () => {
    const cookie = await loginAsAdmin(server);
    const res = await server.inject({
      method: 'GET',
      url: '/api/wallpapers/builtin/foo.txt',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it('404s on path traversal attempts', async () => {
    const cookie = await loginAsAdmin(server);
    // A secret file that must never be reachable through this route.
    writeFileSync(join(tmpDir, 'secret.png'), 'top-secret');

    const res1 = await server.inject({
      method: 'GET',
      url: '/api/wallpapers/builtin/..%2Fsecret.png',
      headers: { cookie },
    });
    expect(res1.statusCode).toBe(404);

    const res2 = await server.inject({
      method: 'GET',
      url: '/api/wallpapers/builtin/..%2F..%2Fsecret.png',
      headers: { cookie },
    });
    expect(res2.statusCode).toBe(404);
  });

  it('404s on a filename matching the regex but absent from disk', async () => {
    const cookie = await loginAsAdmin(server);
    const res = await server.inject({
      method: 'GET',
      url: '/api/wallpapers/builtin/atom_bg.webp',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
