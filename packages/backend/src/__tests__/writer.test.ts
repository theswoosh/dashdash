import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';
import { patchService, appendService, removeService } from '../config/writer.js';
import { assignIds, RawServicesSchema } from '../config/schemas.js';

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

afterEach(() => {
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

  it('removes an option key when patched with null', () => {
    patchService(tmpDir, 'clock-1', { options: { format24h: null } });
    const services = readServices(tmpDir) as { options: Record<string, unknown> }[];
    expect(services[0]!.options).not.toHaveProperty('format24h');
  });

  it('removes an option key set to null even when other options remain', () => {
    // First add two options in one patch
    patchService(tmpDir, 'clock-1', { options: { bg_color: 'rgba(255, 0, 0, 0.30)', showSeconds: true } });
    // Ids are persisted on write — 'clock-1' survives the round-trip.
    const servicesAfterAdd = readServices(tmpDir) as { options: Record<string, unknown> }[];
    expect(servicesAfterAdd[0]!.options).toHaveProperty('bg_color');
    // Now remove bg_color via null while keeping showSeconds
    patchService(tmpDir, 'clock-1', { options: { bg_color: null } });
    const services = readServices(tmpDir) as { options: Record<string, unknown> }[];
    expect(services[0]!.options).not.toHaveProperty('bg_color');
    expect(services[0]!.options).toHaveProperty('showSeconds', true);
  });
});

describe('id stability across mutations (dashtest #14)', () => {
  const readResolved = (dir: string) =>
    assignIds(RawServicesSchema.parse(yaml.load(readFileSync(join(dir, 'services.yml'), 'utf8'))));

  it('deleting one of several same-widget services never shifts the others’ ids', () => {
    // Three id-less clocks — runtime ids derive positionally: clock, clock-2, clock-3.
    writeFileSync(join(tmpDir, 'services.yml'), `- title: Clock 1
  widget: clock
  layout: { x: 0, y: 0, w: 8, h: 8 }
- title: Clock 2
  widget: clock
  layout: { x: 10, y: 0, w: 8, h: 8 }
- title: Clock 3
  widget: clock
  layout: { x: 20, y: 0, w: 8, h: 8 }
`);
    const before = readResolved(tmpDir);
    expect(before.map(s => s.id)).toEqual(['clock', 'clock-2', 'clock-3']);

    // Any write persists the resolved ids; delete the first clock.
    removeService(tmpDir, 'clock');

    // The survivors keep their identity — no positional re-derivation.
    const after = readResolved(tmpDir);
    expect(after).toHaveLength(2);
    expect(after.find(s => s.title === 'Clock 2')!.id).toBe('clock-2');
    expect(after.find(s => s.title === 'Clock 3')!.id).toBe('clock-3');
  });

  it('persists generated ids for nested frame children on write', () => {
    writeFileSync(join(tmpDir, 'services.yml'), `- title: Group
  widget: frame
  layout: { x: 0, y: 0, w: 20, h: 20 }
  children:
    - title: Inner
      widget: clock
      layout: { x: 1, y: 1, w: 8, h: 8 }
`);
    const before = readResolved(tmpDir);
    const frameId = before[0]!.id;
    const childId = before[0]!.children![0]!.id;

    patchService(tmpDir, frameId, { title: 'Group renamed' });

    const raw = readFileSync(join(tmpDir, 'services.yml'), 'utf8');
    expect(raw).toContain(`id: ${frameId}`);
    expect(raw).toContain(`id: ${childId}`);
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
