import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadLocales } from '../config/locales.js';

let tmpDir: string;

function resolve(map: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined),
    map,
  );
}

describe('loadLocales — stale runtime locale merging', () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-locales-test-'));
    mkdirSync(join(tmpDir, 'locales'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('fills keys missing from a stale runtime en.yml (chat.* added post-seed)', () => {
    // Simulates an instance whose en.yml was seeded before the chat feature.
    writeFileSync(join(tmpDir, 'locales', 'en.yml'), 'login:\n  emailLabel: "Custom email label"\n');
    const locales = loadLocales(tmpDir);
    expect(resolve(locales['en']!, 'chat.placeholder')).toBe('Message…');
    // Runtime edits still win over shipped defaults.
    expect(resolve(locales['en']!, 'login.emailLabel')).toBe('Custom email label');
  });

  it('fills keys missing from a stale non-English runtime file from the seed locale', () => {
    writeFileSync(join(tmpDir, 'locales', 'de.yml'), 'login:\n  emailLabel: "Eigenes Label"\n');
    const locales = loadLocales(tmpDir);
    expect(resolve(locales['de']!, 'chat.placeholder')).toBe('Nachricht…');
    expect(resolve(locales['de']!, 'login.emailLabel')).toBe('Eigenes Label');
  });
});
