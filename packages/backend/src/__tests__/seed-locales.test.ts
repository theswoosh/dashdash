import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';
import { seedLocales } from '../app.js';

let dirs: string[] = [];

function makeTmpDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

function readYaml(path: string): Record<string, unknown> {
  return yaml.load(readFileSync(path, 'utf8'), { schema: yaml.CORE_SCHEMA }) as Record<string, unknown>;
}

describe('seedLocales', () => {
  it('copies seed to destination and baseline on first run', () => {
    const seedDir = makeTmpDir('dashdash-locseed-src-');
    const configDir = makeTmpDir('dashdash-locseed-cfg-');
    writeFileSync(join(seedDir, 'en.yml'), 'themes:\n  atom:\n    description: "Pip-Boy green"\n');

    seedLocales(configDir, seedDir);

    const destPath = join(configDir, 'locales', 'en.yml');
    const baselinePath = join(configDir, 'locales', '.seed-baseline', 'en.yml');
    expect(existsSync(destPath)).toBe(true);
    expect(existsSync(baselinePath)).toBe(true);
    expect(readYaml(destPath)).toEqual({ themes: { atom: { description: 'Pip-Boy green' } } });
    expect(readYaml(baselinePath)).toEqual({ themes: { atom: { description: 'Pip-Boy green' } } });
  });

  it('refreshes a stale unedited value when seed text changes (Pip-Boy -> Post-apocalyptic)', () => {
    const seedDir = makeTmpDir('dashdash-locseed-src-');
    const configDir = makeTmpDir('dashdash-locseed-cfg-');
    const localesDir = join(configDir, 'locales');
    const baselineDir = join(localesDir, '.seed-baseline');
    mkdirSync(baselineDir, { recursive: true });

    const oldYaml = 'themes:\n  atom:\n    description: "Pip-Boy green"\n';
    writeFileSync(join(localesDir, 'en.yml'), oldYaml);
    writeFileSync(join(baselineDir, 'en.yml'), oldYaml);
    writeFileSync(join(seedDir, 'en.yml'), 'themes:\n  atom:\n    description: "Post-apocalyptic green"\n');

    seedLocales(configDir, seedDir);

    const dest = readYaml(join(localesDir, 'en.yml'));
    expect((dest['themes'] as { atom: { description: string } }).atom.description).toBe(
      'Post-apocalyptic green',
    );
    // Baseline is refreshed to match the new seed too.
    expect(readYaml(join(baselineDir, 'en.yml'))).toEqual({
      themes: { atom: { description: 'Post-apocalyptic green' } },
    });
  });

  it('preserves a user-edited value even though the seed changed', () => {
    const seedDir = makeTmpDir('dashdash-locseed-src-');
    const configDir = makeTmpDir('dashdash-locseed-cfg-');
    const localesDir = join(configDir, 'locales');
    const baselineDir = join(localesDir, '.seed-baseline');
    mkdirSync(baselineDir, { recursive: true });

    writeFileSync(
      join(localesDir, 'en.yml'),
      'themes:\n  atom:\n    description: "My custom description"\n',
    );
    writeFileSync(join(baselineDir, 'en.yml'), 'themes:\n  atom:\n    description: "Pip-Boy green"\n');
    writeFileSync(join(seedDir, 'en.yml'), 'themes:\n  atom:\n    description: "Post-apocalyptic green"\n');

    seedLocales(configDir, seedDir);

    const dest = readYaml(join(localesDir, 'en.yml'));
    expect((dest['themes'] as { atom: { description: string } }).atom.description).toBe(
      'My custom description',
    );
  });

  it('upgrade with no baseline: only adds missing keys on first run and writes a baseline for future runs', () => {
    const seedDir = makeTmpDir('dashdash-locseed-src-');
    const configDir = makeTmpDir('dashdash-locseed-cfg-');
    const localesDir = join(configDir, 'locales');
    mkdirSync(localesDir, { recursive: true });

    writeFileSync(
      join(localesDir, 'en.yml'),
      'themes:\n  atom:\n    description: "Pip-Boy green"\n',
    );
    writeFileSync(
      join(seedDir, 'en.yml'),
      'themes:\n  atom:\n    description: "Post-apocalyptic green"\n  classic:\n    description: "Classic theme"\n',
    );

    seedLocales(configDir, seedDir);

    let dest = readYaml(join(localesDir, 'en.yml'));
    // Pre-existing value left untouched — no baseline to prove it was never edited.
    expect((dest['themes'] as any).atom.description).toBe('Pip-Boy green');
    // Missing key added from seed.
    expect((dest['themes'] as any).classic.description).toBe('Classic theme');

    const baselinePath = join(localesDir, '.seed-baseline', 'en.yml');
    expect(existsSync(baselinePath)).toBe(true);
    expect(readYaml(baselinePath)).toEqual({
      themes: {
        atom: { description: 'Post-apocalyptic green' },
        classic: { description: 'Classic theme' },
      },
    });

    // Second run with another seed change. The pre-existing "atom" key's
    // dest value ("Pip-Boy green") no longer matches the baseline written
    // above ("Post-apocalyptic green") — since we could never confirm it was
    // unedited, it's now treated like a user edit and stays locked. The
    // "classic" key, added with a real baseline on the first run, refreshes
    // normally going forward — this is what "future seed changes refresh
    // properly" means for a no-baseline upgrade.
    writeFileSync(
      join(seedDir, 'en.yml'),
      'themes:\n  atom:\n    description: "Wasteland green"\n  classic:\n    description: "New classic copy"\n',
    );
    seedLocales(configDir, seedDir);

    dest = readYaml(join(localesDir, 'en.yml'));
    expect((dest['themes'] as any).atom.description).toBe('Pip-Boy green');
    expect((dest['themes'] as any).classic.description).toBe('New classic copy');
  });

  it('preserves a user-added key not present in the seed across a rewrite', () => {
    const seedDir = makeTmpDir('dashdash-locseed-src-');
    const configDir = makeTmpDir('dashdash-locseed-cfg-');
    const localesDir = join(configDir, 'locales');
    const baselineDir = join(localesDir, '.seed-baseline');
    mkdirSync(baselineDir, { recursive: true });

    const oldYaml = 'themes:\n  atom:\n    description: "Pip-Boy green"\n';
    writeFileSync(
      join(localesDir, 'en.yml'),
      'themes:\n  atom:\n    description: "Pip-Boy green"\n    customField: "user extra"\n',
    );
    writeFileSync(join(baselineDir, 'en.yml'), oldYaml);
    writeFileSync(join(seedDir, 'en.yml'), 'themes:\n  atom:\n    description: "Post-apocalyptic green"\n');

    seedLocales(configDir, seedDir);

    const dest = readYaml(join(localesDir, 'en.yml'));
    const atom = (dest['themes'] as any).atom;
    expect(atom.description).toBe('Post-apocalyptic green');
    expect(atom.customField).toBe('user extra');
  });

  it('leaves a malformed destination file byte-identical and does not crash', () => {
    const seedDir = makeTmpDir('dashdash-locseed-src-');
    const configDir = makeTmpDir('dashdash-locseed-cfg-');
    const localesDir = join(configDir, 'locales');
    mkdirSync(localesDir, { recursive: true });

    const brokenYaml = 'themes:\n  atom:\n  description: "broken indentation\n:::not yaml:::';
    writeFileSync(join(localesDir, 'en.yml'), brokenYaml);
    writeFileSync(join(seedDir, 'en.yml'), 'themes:\n  atom:\n    description: "Post-apocalyptic green"\n');

    expect(() => seedLocales(configDir, seedDir)).not.toThrow();
    expect(readFileSync(join(localesDir, 'en.yml'), 'utf8')).toBe(brokenYaml);
    // No baseline should be written for a file we skipped.
    expect(existsSync(join(localesDir, '.seed-baseline', 'en.yml'))).toBe(false);
  });

  it('tolerates a missing seed directory', () => {
    const configDir = makeTmpDir('dashdash-locseed-cfg-');
    const missingSeedDir = join(configDir, 'does-not-exist');

    expect(() => seedLocales(configDir, missingSeedDir)).not.toThrow();
    expect(existsSync(join(configDir, 'locales'))).toBe(true);
  });
});
