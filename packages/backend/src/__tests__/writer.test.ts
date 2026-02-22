import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';
import { patchService, appendService, removeService } from '../config/writer.js';

const BASE_YML = `
- id: clock-1
  title: Clock
  widget: clock
  layout:
    w: 2
    h: 2
    x: 0
    y: 0
  options:
    format24h: true
`.trimStart();

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-writer-'));
  writeFileSync(join(tmpDir, 'services.yml'), BASE_YML);
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function readServices(dir: string): unknown[] {
  return yaml.load(readFileSync(join(dir, 'services.yml'), 'utf8')) as unknown[];
}

describe('patchService', () => {
  it('updates title', () => {
    patchService(tmpDir, 'clock-1', { title: 'My Clock' });
    const services = readServices(tmpDir) as { id: string; title: string }[];
    expect(services[0]!.title).toBe('My Clock');
  });

  it('merges options without losing existing keys', () => {
    patchService(tmpDir, 'clock-1', { options: { showSeconds: true } });
    const services = readServices(tmpDir) as { id: string; options: Record<string, unknown> }[];
    expect(services[0]!.options).toMatchObject({ format24h: true, showSeconds: true });
  });

  it('updates layout', () => {
    patchService(tmpDir, 'clock-1', { layout: { x: 3, y: 1, w: 4, h: 3 } });
    const services = readServices(tmpDir) as { id: string; layout: Record<string, number> }[];
    expect(services[0]!.layout).toEqual({ x: 3, y: 1, w: 4, h: 3 });
  });

  it('throws for unknown id', () => {
    expect(() => patchService(tmpDir, 'no-such', {})).toThrow("'no-such'");
  });
});

describe('appendService', () => {
  it('adds a new service', () => {
    appendService(tmpDir, {
      id: 'stats-1',
      title: 'Stats',
      widget: 'stats',
      layout: { x: 2, y: 0, w: 3, h: 2 },
    });
    const services = readServices(tmpDir) as { widget: string }[];
    expect(services).toHaveLength(2);
    expect(services[1]!.widget).toBe('stats');
  });

  it('throws when id already exists', () => {
    expect(() =>
      appendService(tmpDir, {
        id: 'clock-1',
        title: 'Dup',
        widget: 'clock',
        layout: { x: 0, y: 0, w: 2, h: 2 },
      })
    ).toThrow("'clock-1'");
  });
});

describe('removeService', () => {
  it('removes by id', () => {
    removeService(tmpDir, 'clock-1');
    const services = readServices(tmpDir) as unknown[];
    expect(services).toHaveLength(0);
  });

  it('throws for unknown id', () => {
    expect(() => removeService(tmpDir, 'ghost')).toThrow("'ghost'");
  });
});
