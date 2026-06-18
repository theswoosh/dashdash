import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { loginAsAdmin } from './test-helpers.js';

let server: FastifyInstance;
let db: InstanceType<typeof Database>;
let tmpDir: string;
let authCookie: string;

interface TemplateDef {
  type: string;
  defaultSize: { w: number; h: number };
  defaultOptions?: Record<string, unknown>;
}

function readWidgetsYml(): TemplateDef[] {
  return yaml.load(readFileSync(join(tmpDir, 'widgets.yml'), 'utf8'), { schema: yaml.CORE_SCHEMA }) as TemplateDef[];
}

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-wt-'));
  writeFileSync(join(tmpDir, 'widgets.yml'), `
- type: clock
  defaultSize: { w: 5, h: 5 }
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

describe('GET /api/widget-templates', () => {
  it('returns the templates from widgets.yml', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/widget-templates', headers: { cookie: authCookie } });
    expect(res.statusCode).toBe(200);
    const templates = res.json<TemplateDef[]>();
    expect(templates.find(t => t.type === 'clock')?.defaultSize).toEqual({ w: 5, h: 5 });
  });
});

describe('PATCH /api/widget-templates/:type', () => {
  it('updates defaultSize and defaultOptions for an existing type', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/widget-templates/clock',
      headers: { cookie: authCookie },
      payload: { defaultSize: { w: 8, h: 6 }, defaultOptions: { bg_color: 'rgba(1, 2, 3, 0.50)' } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const clock = readWidgetsYml().find(t => t.type === 'clock');
    expect(clock?.defaultSize).toEqual({ w: 8, h: 6 });
    expect(clock?.defaultOptions).toEqual({ bg_color: 'rgba(1, 2, 3, 0.50)' });
  });

  it('serves defaultOptions back over GET', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/widget-templates', headers: { cookie: authCookie } });
    const clock = res.json<TemplateDef[]>().find(t => t.type === 'clock');
    expect(clock?.defaultOptions?.['bg_color']).toBe('rgba(1, 2, 3, 0.50)');
  });

  it('adds a new entry when the type is missing from widgets.yml', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/widget-templates/healthcheck',
      headers: { cookie: authCookie },
      payload: { defaultSize: { w: 14, h: 14 }, defaultOptions: { layoutSize: 'tiny' } },
    });
    expect(res.statusCode).toBe(200);

    const hc = readWidgetsYml().find(t => t.type === 'healthcheck');
    expect(hc).toBeDefined();
    expect(hc?.defaultSize).toEqual({ w: 14, h: 14 });
    expect(hc?.defaultOptions).toEqual({ layoutSize: 'tiny' });
  });

  it('drops bg_color when defaultOptions clears it (null)', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/widget-templates/clock',
      headers: { cookie: authCookie },
      payload: { defaultOptions: { bg_color: null } },
    });
    expect(res.statusCode).toBe(200);

    const clock = readWidgetsYml().find(t => t.type === 'clock');
    expect(clock?.defaultOptions).toBeUndefined();
  });

  it('rejects out-of-bounds default size with 400', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/widget-templates/clock',
      headers: { cookie: authCookie },
      payload: { defaultSize: { w: 0, h: 999 } },
    });
    expect(res.statusCode).toBe(400);
  });
});
