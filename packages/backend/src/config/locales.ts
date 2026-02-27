import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { EN_FALLBACK } from '../i18n/en.fallback.js';

export type TranslationMap = Record<string, Record<string, unknown>>;

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
      const parsed = yaml.load(raw);
      if (parsed && typeof parsed === 'object') {
        result[lang] = parsed as Record<string, unknown>;
      }
    } catch {
      // Skip malformed locale files — don't crash the app.
    }
  }

  // Always ensure English is available (fall back to baked-in if en.yml missing/broken).
  if (!result['en']) {
    result['en'] = EN_FALLBACK;
  }

  return result;
}
