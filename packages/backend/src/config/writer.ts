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
  const stripIds = (items: Service[]): unknown[] => items.map(({ id: _id, children, ...rest }) => {
    const result: Record<string, unknown> = { ...rest };
    if (children && children.length > 0) {
      result['children'] = stripIds(children);
    }
    return result;
  });
  // Strip runtime id — it is derived at load time, never stored in YAML.
  const output = stripIds(services);
  // js-yaml quotes 'y' as a mapping key for YAML 1.1 compat; undo it since
  // 'y' as a key is never ambiguous (only scalar values can be booleans).
  const dumped = yaml.dump(output, { indent: 2, lineWidth: -1, schema: yaml.CORE_SCHEMA })
    .replace(/'y':/g, 'y:');
  writeFileSync(tmpPath, dumped);
  renameSync(tmpPath, filePath);
}

function findService(services: Service[], id: string): { service: Service; parent: Service | null; container: Service[] } | null {
  const stack: Array<{ list: Service[]; parent: Service | null }> = [{ list: services, parent: null }];
  while (stack.length > 0) {
    const { list, parent } = stack.pop()!;
    for (const svc of list) {
      if (svc.id === id) return { service: svc, parent, container: list };
      if (svc.children && svc.children.length > 0) {
        stack.push({ list: svc.children, parent: svc });
      }
    }
  }
  return null;
}

function walkServices(services: Service[], cb: (svc: Service) => void): void {
  for (const svc of services) {
    cb(svc);
    if (svc.children && svc.children.length > 0) walkServices(svc.children, cb);
  }
}

export function patchService(
  configDir: string,
  id: string,
  patch: { title?: string; icon?: string; options?: Record<string, unknown>; layout?: { x: number; y: number; w: number; h: number }; parentId?: string | null }
): void {
  const services = readServices(configDir);
  const found = findService(services, id);
  if (!found) throw new Error(`Service '${id}' not found in services.yml`);
  const svc = found.service;

  if ('parentId' in patch) {
    const currentParentId = found.parent?.id ?? null;
    const nextParentId = patch.parentId ?? null;
    if (nextParentId !== currentParentId) {
      if (svc.widget === 'frame' && nextParentId) {
        throw new Error(`Frame widgets cannot be nested inside another frame`);
      }
      const idx = found.container.findIndex(s => s.id === id);
      if (idx >= 0) found.container.splice(idx, 1);
      if (nextParentId) {
        const parentFound = findService(services, nextParentId);
        if (!parentFound) throw new Error(`Service '${nextParentId}' not found in services.yml`);
        if (parentFound.service.widget !== 'frame') {
          throw new Error(`Service '${nextParentId}' is not a frame widget`);
        }
        if (!parentFound.service.children) parentFound.service.children = [];
        parentFound.service.children.push(svc);
      } else {
        services.push(svc);
      }
    }
  }

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

export function appendService(configDir: string, service: Service, parentId?: string | undefined): void {
  const services = readServices(configDir);
  let exists = false;
  walkServices(services, svc => { if (svc.id === service.id) exists = true; });
  if (exists) {
    throw new Error(`Service '${service.id}' already exists in services.yml`);
  }
  if (parentId) {
    const parentFound = findService(services, parentId);
    if (!parentFound) throw new Error(`Service '${parentId}' not found in services.yml`);
    if (parentFound.service.widget !== 'frame') {
      throw new Error(`Service '${parentId}' is not a frame widget`);
    }
    if (!parentFound.service.children) parentFound.service.children = [];
    parentFound.service.children.push(service);
  } else {
    services.push(service);
  }
  writeServices(configDir, services);
}

export function batchPatchLayouts(
  configDir: string,
  items: Array<{ id: string; layout: { x: number; y: number; w: number; h: number } }>,
  parentId?: string | undefined
): void {
  const services = readServices(configDir);
  if (parentId) {
    const parentFound = findService(services, parentId);
    if (!parentFound) throw new Error(`Service '${parentId}' not found in services.yml`);
    if (parentFound.service.widget !== 'frame') {
      throw new Error(`Service '${parentId}' is not a frame widget`);
    }
    const children = parentFound.service.children ?? [];
    for (const item of items) {
      const svc = children.find(s => s.id === item.id);
      if (svc) svc.layout = item.layout;
    }
  } else {
    for (const item of items) {
      const found = findService(services, item.id);
      if (found) found.service.layout = item.layout;
    }
  }
  writeServices(configDir, services);
}

export function removeService(configDir: string, id: string): void {
  const services = readServices(configDir);
  const found = findService(services, id);
  if (!found) throw new Error(`Service '${id}' not found in services.yml`);
  const idx = found.container.findIndex(s => s.id === id);
  if (idx >= 0) found.container.splice(idx, 1);
  writeServices(configDir, services);
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
