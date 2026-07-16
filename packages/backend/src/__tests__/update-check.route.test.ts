import { describe, it, expect, afterEach, vi } from 'vitest';
import type { createUpdateCheckRoutes as CreateUpdateCheckRoutes } from '../routes/update-check.route.js';
import Fastify from 'fastify';

// The route module keeps a module-level in-memory cache, so each test gets a
// fresh module instance via resetModules() + dynamic import — otherwise the
// TTL cache from one test would leak into the next within this file.
async function freshCreateUpdateCheckRoutes(): Promise<typeof CreateUpdateCheckRoutes> {
  vi.resetModules();
  const mod = await import('../routes/update-check.route.js');
  return mod.createUpdateCheckRoutes;
}

describe('update-check route', () => {
  const originalToken = process.env['BOARD_GITHUB_TOKEN'];

  afterEach(() => {
    if (originalToken === undefined) delete process.env['BOARD_GITHUB_TOKEN'];
    else process.env['BOARD_GITHUB_TOKEN'] = originalToken;
    vi.unstubAllGlobals();
  });

  it('no-ops without a token', async () => {
    delete process.env['BOARD_GITHUB_TOKEN'];
    const createUpdateCheckRoutes = await freshCreateUpdateCheckRoutes();
    const app = Fastify();
    await app.register(createUpdateCheckRoutes({ currentVersion: '0.0.2' }), { prefix: '/api' });
    const res = await app.inject({ method: 'GET', url: '/api/update-check' });
    expect(res.json()).toEqual({
      currentVersion: '0.0.2', latestVersion: null, updateAvailable: false, releaseUrl: null,
    });
  });

  it('reports updateAvailable when the fetched tag is newer', async () => {
    process.env['BOARD_GITHUB_TOKEN'] = 'test-token';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v0.0.3', html_url: 'https://github.com/theswoosh/dashdash/releases/tag/v0.0.3' }),
    }));
    const createUpdateCheckRoutes = await freshCreateUpdateCheckRoutes();
    const app = Fastify();
    await app.register(createUpdateCheckRoutes({ currentVersion: '0.0.2' }), { prefix: '/api' });
    const res = await app.inject({ method: 'GET', url: '/api/update-check' });
    const body = res.json() as { updateAvailable: boolean; latestVersion: string };
    expect(body.updateAvailable).toBe(true);
    expect(body.latestVersion).toBe('0.0.3');
  });

  it('soft no-ops when the GitHub fetch throws', async () => {
    process.env['BOARD_GITHUB_TOKEN'] = 'test-token';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const createUpdateCheckRoutes = await freshCreateUpdateCheckRoutes();
    const app = Fastify();
    await app.register(createUpdateCheckRoutes({ currentVersion: '0.0.2' }), { prefix: '/api' });
    const res = await app.inject({ method: 'GET', url: '/api/update-check' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { updateAvailable: boolean; latestVersion: string | null };
    expect(body.updateAvailable).toBe(false);
    expect(body.latestVersion).toBeNull();
  });
});
