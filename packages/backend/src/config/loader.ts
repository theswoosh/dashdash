import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { RawServicesSchema, SettingsSchema, BehaviorSchema, assignIds } from './schemas.js';
import type { Services, Settings, Behavior } from './schemas.js';

interface Logger { warn: (msg: string, ...args: unknown[]) => void }

const defaultLogger: Logger = console;

function readYaml(filePath: string, logger: Logger): unknown {
  if (!existsSync(filePath)) return null;
  try {
    return yaml.load(readFileSync(filePath, 'utf8'), { schema: yaml.CORE_SCHEMA });
  } catch (err) {
    logger.warn(`Failed to parse ${filePath}:`, err);
    return null;
  }
}

export function loadServices(configDir: string, logger: Logger = defaultLogger): Services {
  const raw = readYaml(join(configDir, 'services.yml'), logger);
  if (raw === null) return [];
  const parseResult = RawServicesSchema.safeParse(raw);
  if (!parseResult.success) {
    logger.warn('services.yml validation errors:', parseResult.error.format());
    return [];
  }
  return assignIds(parseResult.data);
}

export function loadBehavior(configDir: string, logger: Logger = defaultLogger): Behavior {
  const raw = readYaml(join(configDir, 'behavior.yml'), logger);
  const parseResult = BehaviorSchema.safeParse(raw ?? {});
  if (!parseResult.success) {
    logger.warn('behavior.yml validation errors:', parseResult.error.format());
    return BehaviorSchema.parse({});
  }
  return parseResult.data;
}

export function loadSettings(configDir: string, logger: Logger = defaultLogger): Settings {
  const raw = readYaml(join(configDir, 'settings.yml'), logger);
  const parseResult = SettingsSchema.safeParse(raw ?? {});
  if (!parseResult.success) {
    logger.warn('settings.yml validation errors:', parseResult.error.format());
    return SettingsSchema.parse({});
  }
  return parseResult.data;
}
