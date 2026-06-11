/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, CORE_SCHEMA } from 'js-yaml';
import { EN_FALLBACK } from '../i18n/en.fallback';

// Guards the 3-file i18n rule: every user-visible string must exist in
// seed/locales/en.yml, seed/locales/de.yml, and the in-memory fallback.
// The seed files are what ship in the Docker image — runtime copies under
// /config/locales are user-owned and deliberately not checked here.

const SEED_LOCALES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../backend/seed/locales');

function loadYamlKeys(file: string): Set<string> {
  const raw = readFileSync(join(SEED_LOCALES_DIR, file), 'utf8');
  const doc = load(raw, { schema: CORE_SCHEMA });
  return flattenKeys(doc);
}

function flattenKeys(node: unknown, prefix = '', out = new Set<string>()): Set<string> {
  if (typeof node !== 'object' || node === null) {
    if (prefix) out.add(prefix);
    return out;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    flattenKeys(value, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

function difference(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter(k => !b.has(k)).sort();
}

describe('i18n key sync (seed locales + frontend fallback)', () => {
  const enKeys = loadYamlKeys('en.yml');
  const deKeys = loadYamlKeys('de.yml');
  const fallbackKeys = flattenKeys(EN_FALLBACK);

  it('de.yml has every key from en.yml', () => {
    expect(difference(enKeys, deKeys)).toEqual([]);
  });

  it('en.yml has every key from de.yml', () => {
    expect(difference(deKeys, enKeys)).toEqual([]);
  });

  it('every fallback key exists in en.yml', () => {
    expect(difference(fallbackKeys, enKeys)).toEqual([]);
  });

  it('en.yml keys in fallback-covered namespaces exist in the fallback', () => {
    const fallbackNamespaces = new Set(Object.keys(EN_FALLBACK));
    const coveredEnKeys = new Set(
      [...enKeys].filter(k => fallbackNamespaces.has(k.split('.')[0]!))
    );
    expect(difference(coveredEnKeys, fallbackKeys)).toEqual([]);
  });
});
