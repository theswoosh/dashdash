import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import { loginAsAdmin } from './test-helpers.js';

let server: FastifyInstance;
let db: Db;
let tmpDir: string;
let boardId: string;
let cookie: string;

async function setup() {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-boards-prefs-test-'));
  writeFileSync(join(tmpDir, 'services.yml'), '[]');
  writeFileSync(join(tmpDir, 'settings.yml'), 'title: test\n');
  ({ server, db } = await buildApp({ dataDir: tmpDir, configDir: tmpDir }));
  await server.ready();
  cookie = await loginAsAdmin(server);
  const boardRes = await server.inject({ method: 'GET', url: '/api/boards/default', headers: { cookie } });
  boardId = (boardRes.json() as { id: string }).id;
}

async function teardown() {
  await server.close();
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
}

async function patchWallpaper(activeWallpaperId: string | null) {
  return server.inject({
    method: 'PATCH',
    url: `/api/boards/${boardId}`,
    headers: { cookie },
    payload: { activeWallpaperId },
  });
}

describe('PATCH /api/boards/:id — wallpaper preference validation', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('accepts a valid builtin: reference', async () => {
    const res = await patchWallpaper('builtin:ascii_bg.png');
    expect(res.statusCode).toBe(200);
    const boardRes = await server.inject({ method: 'GET', url: '/api/boards/default', headers: { cookie } });
    expect((boardRes.json() as { activeWallpaperId: string | null }).activeWallpaperId).toBe('builtin:ascii_bg.png');
  });

  it('rejects a builtin: reference with a traversal filename', async () => {
    const res = await patchWallpaper('builtin:../x');
    expect(res.statusCode).toBe(400);
  });

  it('rejects a builtin: reference with a non-matching filename', async () => {
    const res = await patchWallpaper('builtin:notes.txt');
    expect(res.statusCode).toBe(400);
  });

  it('accepts "none"', async () => {
    const res = await patchWallpaper('none');
    expect(res.statusCode).toBe(200);
    const boardRes = await server.inject({ method: 'GET', url: '/api/boards/default', headers: { cookie } });
    expect((boardRes.json() as { activeWallpaperId: string | null }).activeWallpaperId).toBe('none');
  });

  it('rejects an unknown random string', async () => {
    const res = await patchWallpaper('not-a-real-id');
    expect(res.statusCode).toBe(400);
  });

  it('accepts an existing upload id owned by the user', async () => {
    const boundary = '----wallpaperTestBoundary';
    const body =
      `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="file"; filename="test.png"\r\n' +
      'Content-Type: image/png\r\n\r\n' +
      'fake-image-bytes\r\n' +
      `--${boundary}--\r\n`;
    const multipartRes = await server.inject({
      method: 'POST',
      url: `/api/boards/${boardId}/wallpapers`,
      headers: { cookie, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
    expect(multipartRes.statusCode).toBe(200);
    const wallpaperId = (multipartRes.json() as { id: string }).id;

    const res = await patchWallpaper(wallpaperId);
    expect(res.statusCode).toBe(200);
  });

  it('rejects an upload id belonging to another user', async () => {
    // A second user uploads their own wallpaper.
    await server.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'other@test.local', password: 'password123', name: 'Other' },
    });
    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'other@test.local', password: 'password123' },
    });
    const setCookie = loginRes.headers['set-cookie'];
    const otherCookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    const otherSessionId = otherCookieHeader?.match(/dashdash_session=([^;]+)/)?.[1];
    const otherCookie = `dashdash_session=${otherSessionId}`;

    const boundary = '----wallpaperTestBoundary2';
    const body =
      `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="file"; filename="test.png"\r\n' +
      'Content-Type: image/png\r\n\r\n' +
      'other-user-bytes\r\n' +
      `--${boundary}--\r\n`;
    const uploadRes = await server.inject({
      method: 'POST',
      url: `/api/boards/${boardId}/wallpapers`,
      headers: { cookie: otherCookie, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
    const wallpaperId = (uploadRes.json() as { id: string }).id;

    const res = await patchWallpaper(wallpaperId);
    expect(res.statusCode).toBe(400);
  });

  it('clears the preference row on null (theme default)', async () => {
    await patchWallpaper('none');
    const res = await patchWallpaper(null);
    expect(res.statusCode).toBe(200);
    const boardRes = await server.inject({ method: 'GET', url: '/api/boards/default', headers: { cookie } });
    expect((boardRes.json() as { activeWallpaperId: string | null }).activeWallpaperId).toBeNull();
  });
});

describe('GET /api/boards/:id/background — builtin/none pref values', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('returns 404 (no content) when the stored pref is a builtin: reference', async () => {
    await patchWallpaper('builtin:classic_bg.jpg');
    const res = await server.inject({ method: 'GET', url: `/api/boards/${boardId}/background`, headers: { cookie } });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 (no content) when the stored pref is "none"', async () => {
    await patchWallpaper('none');
    const res = await server.inject({ method: 'GET', url: `/api/boards/${boardId}/background`, headers: { cookie } });
    expect(res.statusCode).toBe(404);
  });
});
