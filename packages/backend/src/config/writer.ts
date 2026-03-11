import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { RawServicesSchema, assignIds } from './schemas.js';
import type { Service, SearchEngine } from './schemas.js';

function readServices(configDir: string): Service[] {
  const filePath = join(configDir, 'services.yml');
  if (!existsSync(filePath)) return [];
  const raw = yaml.load(readFileSync(filePath, 'utf8'));
  const parseResult = RawServicesSchema.safeParse(raw);
  return parseResult.success ? assignIds(parseResult.data) : [];
}

function writeServices(configDir: string, services: Service[]): void {
  const filePath = join(configDir, 'services.yml');
  const tmpPath = `${filePath}.tmp`;
  // Strip runtime id — it is derived at load time, never stored in YAML.
  const output = services.map(({ id: _id, ...rest }) => rest);
  // js-yaml quotes 'y' as a mapping key for YAML 1.1 compat; undo it since
  // 'y' as a key is never ambiguous (only scalar values can be booleans).
  const dumped = yaml.dump(output, { indent: 2, lineWidth: -1, schema: yaml.CORE_SCHEMA })
    .replace(/'y':/g, 'y:');
  writeFileSync(tmpPath, dumped);
  renameSync(tmpPath, filePath);
}

export function patchService(
  configDir: string,
  id: string,
  patch: { title?: string; icon?: string; options?: Record<string, unknown>; layout?: { x: number; y: number; w: number; h: number } }
): void {
  const services = readServices(configDir);
  const idx = services.findIndex(s => s.id === id);
  if (idx === -1) throw new Error(`Service '${id}' not found in services.yml`);

  const svc = services[idx]!;
  if (patch.title !== undefined) svc.title = patch.title;
  if ('icon' in patch) svc.icon = patch.icon || undefined;
  if (patch.options !== undefined) {
    const merged: Record<string, unknown> = { ...svc.options, ...patch.options };
    for (const key of Object.keys(merged)) {
      if (merged[key] === null || merged[key] === undefined) delete merged[key];
    }
    svc.options = merged;
  }
  if (patch.layout !== undefined) svc.layout = patch.layout;

  writeServices(configDir, services);
}

export function appendService(configDir: string, service: Service): void {
  const services = readServices(configDir);
  if (services.some(s => s.id === service.id)) {
    throw new Error(`Service '${service.id}' already exists in services.yml`);
  }
  services.push(service);
  writeServices(configDir, services);
}

export function batchPatchLayouts(
  configDir: string,
  items: Array<{ id: string; layout: { x: number; y: number; w: number; h: number } }>
): void {
  const services = readServices(configDir);
  for (const item of items) {
    const svc = services.find(s => s.id === item.id);
    if (svc) svc.layout = item.layout;
  }
  writeServices(configDir, services);
}

export function removeService(configDir: string, id: string): void {
  const services = readServices(configDir);
  const filtered = services.filter(s => s.id !== id);
  if (filtered.length === services.length) {
    throw new Error(`Service '${id}' not found in services.yml`);
  }
  writeServices(configDir, filtered);
}

export function writeSearchEngines(configDir: string, engines: SearchEngine[]): void {
  const filePath = join(configDir, 'settings.yml');
  const raw = existsSync(filePath)
    ? ((yaml.load(readFileSync(filePath, 'utf8'), { schema: yaml.CORE_SCHEMA }) as Record<string, unknown>) ?? {})
    : {};
  raw['searchEngines'] = engines;
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, yaml.dump(raw, { indent: 2, lineWidth: -1, schema: yaml.CORE_SCHEMA }));
  renameSync(tmpPath, filePath);
}
