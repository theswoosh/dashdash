import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { EN_FALLBACK } from '../i18n/en.fallback.js';

// Same resolution as seedLocales() in app.ts: src/../../seed/locales in dev,
// dist/../../seed/locales in prod/Docker.
const SEED_LOCALES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'seed', 'locales');

type TranslationMap = Record<string, Record<string, unknown>>;

/** Recursively merges `defaults` under `overrides` — overrides win on conflict. */
function deepMerge(
  defaults: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(overrides)) {
    const d = defaults[key];
    const o = overrides[key];
    if (d && o && typeof d === 'object' && typeof o === 'object' && !Array.isArray(d)) {
      result[key] = deepMerge(d as Record<string, unknown>, o as Record<string, unknown>);
    } else {
      result[key] = o;
    }
  }
  return result;
}

/**
 * Loads all *.yml files from configDir/locales/.
 * Filename (without .yml) = language code.
 * Falls back to baked-in English when the directory is missing or empty.
 */
export function loadLocales(configDir: string): TranslationMap {
  const localesDir = join(configDir, 'locales');

  if (!existsSync(localesDir)) {
    return { en: EN_FALLBACK };
  }

  let files: string[];
  try {
    files = readdirSync(localesDir).filter(f => f.endsWith('.yml'));
  } catch {
    return { en: EN_FALLBACK };
  }

  if (files.length === 0) {
    return { en: EN_FALLBACK };
  }

  const result: TranslationMap = {};

  for (const file of files) {
    const lang = file.replace(/\.yml$/, '');
    try {
      const raw = readFileSync(join(localesDir, file), 'utf8');
      const parsed = yaml.load(raw, { schema: yaml.CORE_SCHEMA });
      if (parsed && typeof parsed === 'object') {
        // Merge the shipped seed locale as base: runtime files are copied
        // only on first run, so keys added in later releases would otherwise
        // stay missing forever. User edits (runtime file) win per key.
        result[lang] = deepMerge(readSeedLocale(lang), parsed as Record<string, unknown>);
      }
    } catch {
      // Skip malformed locale files — don't crash the app.
    }
  }

  // Always ensure English is available. Merge EN_FALLBACK as base so that
  // keys added after the user's en.yml was first seeded are still resolved.
  result['en'] = deepMerge(EN_FALLBACK as Record<string, unknown>, result['en'] ?? {});

  return result;
}

function readSeedLocale(lang: string): Record<string, unknown> {
  try {
    const raw = readFileSync(join(SEED_LOCALES_DIR, `${lang}.yml`), 'utf8');
    const parsed = yaml.load(raw, { schema: yaml.CORE_SCHEMA });
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
