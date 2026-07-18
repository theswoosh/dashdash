import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { seedWallpapers } from '../app.js';

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

describe('seedWallpapers', () => {
  it('copies matching seed files into config/wallpapers on first run', () => {
    const seedDir = makeTmpDir('dashdash-seed-src-');
    const configDir = makeTmpDir('dashdash-seed-cfg-');
    writeFileSync(join(seedDir, 'ascii_bg.png'), 'ascii-bytes');
    writeFileSync(join(seedDir, 'not-a-wallpaper.txt'), 'ignored');

    seedWallpapers(configDir, seedDir);

    const destDir = join(configDir, 'wallpapers');
    expect(existsSync(join(destDir, 'ascii_bg.png'))).toBe(true);
    expect(readFileSync(join(destDir, 'ascii_bg.png'), 'utf8')).toBe('ascii-bytes');
    expect(existsSync(join(destDir, 'not-a-wallpaper.txt'))).toBe(false);
  });

  it('does not overwrite a file that already exists at the destination', () => {
    const seedDir = makeTmpDir('dashdash-seed-src-');
    const configDir = makeTmpDir('dashdash-seed-cfg-');
    const destDir = join(configDir, 'wallpapers');
    mkdirSync(destDir, { recursive: true });
    writeFileSync(join(destDir, 'ascii_bg.png'), 'user-customized');
    writeFileSync(join(seedDir, 'ascii_bg.png'), 'seed-default');

    seedWallpapers(configDir, seedDir);

    expect(readFileSync(join(destDir, 'ascii_bg.png'), 'utf8')).toBe('user-customized');
  });

  it('tolerates a missing seed directory', () => {
    const configDir = makeTmpDir('dashdash-seed-cfg-');
    const missingSeedDir = join(configDir, 'does-not-exist');

    expect(() => seedWallpapers(configDir, missingSeedDir)).not.toThrow();
    expect(existsSync(join(configDir, 'wallpapers'))).toBe(true);
  });

  it('tolerates an empty seed directory', () => {
    const seedDir = makeTmpDir('dashdash-seed-src-');
    const configDir = makeTmpDir('dashdash-seed-cfg-');

    expect(() => seedWallpapers(configDir, seedDir)).not.toThrow();
    expect(existsSync(join(configDir, 'wallpapers'))).toBe(true);
  });
});
