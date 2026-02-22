import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { RawServicesSchema, SettingsSchema, assignIds } from './schemas.js';
import type { Services, Settings } from './schemas.js';

function readYaml(filePath: string): unknown {
  if (!existsSync(filePath)) return null;
  try {
    return yaml.load(readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.warn(`Failed to parse ${filePath}:`, err);
    return null;
  }
}

export function loadServices(configDir: string): Services {
  const raw = readYaml(join(configDir, 'services.yml'));
  if (raw === null) return [];
  const result = RawServicesSchema.safeParse(raw);
  if (!result.success) {
    console.warn('services.yml validation errors:', result.error.format());
    return [];
  }
  return assignIds(result.data);
}

export function loadSettings(configDir: string): Settings {
  const raw = readYaml(join(configDir, 'settings.yml'));
  const result = SettingsSchema.safeParse(raw ?? {});
  if (!result.success) {
    console.warn('settings.yml validation errors:', result.error.format());
    return SettingsSchema.parse({});
  }
  return result.data;
}
