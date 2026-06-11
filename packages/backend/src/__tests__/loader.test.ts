import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadServices, loadSettings } from '../config/loader.js';

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-loader-'));
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true });
});

describe('loadServices', () => {
  it('returns empty array when services.yml is missing', async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'dashdash-no-services-'));
    const services = await loadServices(emptyDir);
    expect(services).toEqual([]);
    rmSync(emptyDir, { recursive: true });
  });

  it('parses a valid services.yml', async () => {
    writeFileSync(join(tmpDir, 'services.yml'), `
- id: my-widget
  title: My Widget
  widget: clock
  layout:
    w: 2
    h: 2
`);
    const services = await loadServices(tmpDir);
    expect(services).toHaveLength(1);
    expect(services[0]!.id).toBe('my-widget');
    expect(services[0]!.layout.x).toBe(0);  // zod default
    expect(services[0]!.layout.y).toBe(0);  // zod default
  });
});

describe('loadSettings', () => {
  it('returns defaults when settings.yml is missing', async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'dashdash-no-settings-'));
    const settings = await loadSettings(emptyDir);
    expect(settings.title).toBe('dashdash');
    expect(settings.theme).toBe('dark');
    expect(settings.grid.cellSize).toBe(10);
    rmSync(emptyDir, { recursive: true });
  });

  it('parses a custom title from settings.yml', async () => {
    writeFileSync(join(tmpDir, 'settings.yml'), `
title: My Dashboard
theme: light
`);
    const settings = await loadSettings(tmpDir);
    expect(settings.title).toBe('My Dashboard');
    expect(settings.theme).toBe('light');
    expect(settings.grid.cellSize).toBe(10);  // zod default still applies
  });
});
