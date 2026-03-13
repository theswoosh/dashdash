import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { RawServicesSchema, SettingsSchema, assignIds } from './schemas.js';
import type { Services, Settings, Service } from './schemas.js';

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

export function flattenServices(services: Services): Service[] {
  const items: Service[] = [];
  const walk = (list: Service[]) => {
    for (const svc of list) {
      items.push(svc);
      if (svc.children && svc.children.length > 0) walk(svc.children);
    }
  };
  walk(services);
  return items;
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
