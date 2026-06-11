import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadServices } from '../config/loader.js';

// A-030: edge cases for the services.yml `layout` field. One invalid layout
// fails the whole RawServicesSchema parse and loadServices returns [] (the
// board renders empty) — these tests pin the bounds so that behavior only
// triggers on genuinely invalid input, never on legal fine-grid values.

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-layout-'));
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true });
});

function writeServices(yml: string): void {
  writeFileSync(join(tmpDir, 'services.yml'), yml);
}

function serviceWithLayout(layout: string): string {
  return `
- id: w1
  title: Widget
  widget: clock
  layout: ${layout}
`;
}

describe('services.yml layout bounds', () => {
  it('accepts the maximum legal size (w/h = 500)', async () => {
    writeServices(serviceWithLayout('{ x: 0, y: 0, w: 500, h: 500 }'));
    const services = await loadServices(tmpDir);
    expect(services).toHaveLength(1);
    expect(services[0]!.layout.w).toBe(500);
  });

  it('accepts the maximum legal position (x/y = 2000)', async () => {
    writeServices(serviceWithLayout('{ x: 2000, y: 2000, w: 1, h: 1 }'));
    const services = await loadServices(tmpDir);
    expect(services).toHaveLength(1);
    expect(services[0]!.layout.x).toBe(2000);
  });

  it('rejects width above the maximum (w = 501)', async () => {
    writeServices(serviceWithLayout('{ x: 0, y: 0, w: 501, h: 1 }'));
    expect(await loadServices(tmpDir)).toEqual([]);
  });

  it('rejects position above the maximum (x = 2001)', async () => {
    writeServices(serviceWithLayout('{ x: 2001, y: 0, w: 1, h: 1 }'));
    expect(await loadServices(tmpDir)).toEqual([]);
  });

  it('rejects a zero-size widget (w = 0)', async () => {
    writeServices(serviceWithLayout('{ x: 0, y: 0, w: 0, h: 1 }'));
    expect(await loadServices(tmpDir)).toEqual([]);
  });

  it('rejects a negative position (x = -1)', async () => {
    writeServices(serviceWithLayout('{ x: -1, y: 0, w: 1, h: 1 }'));
    expect(await loadServices(tmpDir)).toEqual([]);
  });

  it('rejects non-integer values (w = 2.5)', async () => {
    writeServices(serviceWithLayout('{ x: 0, y: 0, w: 2.5, h: 1 }'));
    expect(await loadServices(tmpDir)).toEqual([]);
  });

  it('rejects a service without a layout', async () => {
    writeServices(`
- id: w1
  title: Widget
  widget: clock
`);
    expect(await loadServices(tmpDir)).toEqual([]);
  });

  it('rejects a layout missing w/h', async () => {
    writeServices(serviceWithLayout('{ x: 0, y: 0 }'));
    expect(await loadServices(tmpDir)).toEqual([]);
  });
});

describe('frame children layout validation', () => {
  it('parses valid frame-relative child layouts', async () => {
    writeServices(`
- id: f1
  title: Frame
  widget: frame
  layout: { x: 0, y: 0, w: 84, h: 56 }
  children:
    - id: c1
      title: Child
      widget: clock
      layout: { x: 2, y: 2, w: 8, h: 8 }
`);
    const services = await loadServices(tmpDir);
    expect(services).toHaveLength(1);
    expect(services[0]!.children?.[0]?.layout.w).toBe(8);
  });

  it('rejects an out-of-bounds child layout (recursive validation)', async () => {
    writeServices(`
- id: f1
  title: Frame
  widget: frame
  layout: { x: 0, y: 0, w: 84, h: 56 }
  children:
    - id: c1
      title: Child
      widget: clock
      layout: { x: 0, y: 0, w: 501, h: 8 }
`);
    expect(await loadServices(tmpDir)).toEqual([]);
  });
});

describe('blanking behavior (documented trade-off)', () => {
  it('one invalid widget rejects the entire file, including valid siblings', async () => {
    writeServices(`
- id: ok
  title: Fine
  widget: clock
  layout: { x: 0, y: 0, w: 8, h: 8 }
- id: bad
  title: Broken
  widget: clock
  layout: { x: 0, y: 0, w: 501, h: 8 }
`);
    expect(await loadServices(tmpDir)).toEqual([]);
  });
});
