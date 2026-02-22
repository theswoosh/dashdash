import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { ServicesSchema } from './schemas.js';
import type { Service } from './schemas.js';

function readServices(configDir: string): Service[] {
  const filePath = join(configDir, 'services.yml');
  if (!existsSync(filePath)) return [];
  const raw = yaml.load(readFileSync(filePath, 'utf8'));
  const result = ServicesSchema.safeParse(raw);
  return result.success ? result.data : [];
}

function writeServices(configDir: string, services: Service[]): void {
  const filePath = join(configDir, 'services.yml');
  const tmpPath = filePath + '.tmp';
  writeFileSync(tmpPath, yaml.dump(services, { indent: 2, lineWidth: -1 }));
  renameSync(tmpPath, filePath);
}

export function patchService(
  configDir: string,
  id: string,
  patch: { title?: string; options?: Record<string, unknown>; layout?: { x: number; y: number; w: number; h: number } }
): void {
  const services = readServices(configDir);
  const idx = services.findIndex(s => s.id === id);
  if (idx === -1) throw new Error(`Service '${id}' not found in services.yml`);

  const svc = services[idx]!;
  if (patch.title !== undefined) svc.title = patch.title;
  if (patch.options !== undefined) svc.options = { ...(svc.options ?? {}), ...patch.options };
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

export function removeService(configDir: string, id: string): void {
  const services = readServices(configDir);
  const filtered = services.filter(s => s.id !== id);
  if (filtered.length === services.length) {
    throw new Error(`Service '${id}' not found in services.yml`);
  }
  writeServices(configDir, filtered);
}
