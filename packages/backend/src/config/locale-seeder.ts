import { readFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

type YamlMap = Record<string, unknown>;

function isPlainObject(value: unknown): value is YamlMap {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(key => deepEqual(a[key], b[key]));
}

function parseYamlFile(path: string): YamlMap | undefined {
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = yaml.load(raw, { schema: yaml.CORE_SCHEMA });
    return isPlainObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Recursively merges `seed` into `dest`, using `baseline` (the seed as last
 * applied) to distinguish "user never touched this" from "user edited this":
 * - Leaf present in both dest and baseline, and dest still equals baseline
 *   → the user never edited it, so the new seed value wins (refresh).
 * - Leaf where dest differs from baseline (or baseline lacks it) → user edit,
 *   dest value is preserved.
 * - Leaf missing from dest → added from seed.
 * - Keys present only in dest (user-added) are always preserved as-is.
 *
 * When `baseline` is undefined (upgrade from an older install with no stored
 * baseline), we cannot tell edited from unedited, so we conservatively only
 * fill in missing keys and never overwrite existing dest values.
 */
function mergeWithBaseline(seed: YamlMap, dest: YamlMap, baseline: YamlMap | undefined): YamlMap {
  const merged: YamlMap = { ...dest };

  for (const key of Object.keys(seed)) {
    const seedValue = seed[key];
    const destValue = dest[key];
    const baselineValue = baseline ? baseline[key] : undefined;

    if (!(key in dest)) {
      merged[key] = seedValue;
      continue;
    }

    if (isPlainObject(seedValue) && isPlainObject(destValue)) {
      merged[key] = mergeWithBaseline(
        seedValue,
        destValue,
        isPlainObject(baselineValue) ? baselineValue : undefined,
      );
      continue;
    }

    if (baseline && key in baseline && deepEqual(destValue, baselineValue)) {
      // Destination still matches the baseline the seed last shipped —
      // the user never touched this key, so the refreshed seed text wins.
      merged[key] = seedValue;
    }
    // Otherwise: no baseline to compare against, or the user's value
    // diverges from the baseline — keep the destination value untouched.
  }

  return merged;
}

/**
 * Copies seed locale files into `<configDir>/locales/`, refreshing keys the
 * user never edited when the shipped seed text changes, while preserving
 * both user edits and user-added keys. A copy of each seed file, as last
 * applied, is kept in `<configDir>/locales/.seed-baseline/` so a later run
 * can tell "user edited this" apart from "seed text changed since we last
 * wrote it".
 *
 * `seedDir` defaults to the real bundled dir; tests override it to stay
 * isolated from the (real) repo seed directory, mirroring seedWallpapers().
 */
export function seedLocales(configDir: string, seedDir: string): void {
  const localesDir = join(configDir, 'locales');
  const baselineDir = join(localesDir, '.seed-baseline');
  mkdirSync(localesDir, { recursive: true });

  if (!existsSync(seedDir)) return;

  let seedFiles: string[];
  try {
    seedFiles = readdirSync(seedDir).filter(f => f.endsWith('.yml'));
  } catch {
    return;
  }

  if (seedFiles.length > 0) {
    mkdirSync(baselineDir, { recursive: true });
  }

  for (const file of seedFiles) {
    const seedPath = join(seedDir, file);
    const destPath = join(localesDir, file);
    const baselinePath = join(baselineDir, file);

    if (!existsSync(destPath)) {
      copyFileSync(seedPath, destPath);
      copyFileSync(seedPath, baselinePath);
      continue;
    }

    const seedParsed = parseYamlFile(seedPath);
    const destParsed = parseYamlFile(destPath);
    if (!seedParsed || !destParsed) {
      // Malformed seed (shouldn't happen) or malformed destination (user's
      // file is broken) — don't touch the destination or its baseline.
      continue;
    }

    const baselineParsed = parseYamlFile(baselinePath);
    const merged = mergeWithBaseline(seedParsed, destParsed, baselineParsed);

    // Rewriting drops any comments the user had in the runtime file — an
    // accepted tradeoff, and we only pay it when something actually changed.
    if (!deepEqual(merged, destParsed)) {
      writeFileSync(destPath, yaml.dump(merged, { lineWidth: -1 }), 'utf8');
    }

    copyFileSync(seedPath, baselinePath);
  }
}
