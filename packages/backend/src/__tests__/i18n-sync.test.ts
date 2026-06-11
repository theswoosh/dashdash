import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load, CORE_SCHEMA } from 'js-yaml';
import { EN_FALLBACK } from '../i18n/en.fallback.js';

// Backend twin of the frontend i18n-sync test: the backend fallback (used when
// /config/locales is absent) must stay aligned with the shipped seed locales.

const SEED_LOCALES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../seed/locales');

function loadYamlKeys(file: string): Set<string> {
  const raw = readFileSync(join(SEED_LOCALES_DIR, file), 'utf8');
  return flattenKeys(load(raw, { schema: CORE_SCHEMA }));
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

describe('i18n key sync (backend fallback vs seed locales)', () => {
  const enKeys = loadYamlKeys('en.yml');
  const fallbackKeys = flattenKeys(EN_FALLBACK);

  it('every backend fallback key exists in en.yml', () => {
    expect(difference(fallbackKeys, enKeys)).toEqual([]);
  });

  it('en.yml keys in fallback-covered namespaces exist in the backend fallback', () => {
    const fallbackNamespaces = new Set(Object.keys(EN_FALLBACK));
    const coveredEnKeys = new Set(
      [...enKeys].filter(k => fallbackNamespaces.has(k.split('.')[0]!))
    );
    expect(difference(coveredEnKeys, fallbackKeys)).toEqual([]);
  });
});
