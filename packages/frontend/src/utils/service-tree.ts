import type { ServiceConfig } from '@dashdash/types';

export function flattenServices(services: ServiceConfig[]): ServiceConfig[] {
  const result: ServiceConfig[] = [];
  const walk = (items: ServiceConfig[]) => {
    for (const svc of items) {
      result.push(svc);
      if (svc.children && svc.children.length > 0) walk(svc.children);
    }
  };
  walk(services);
  return result;
}

export function findServiceById(services: ServiceConfig[], id: string): ServiceConfig | undefined {
  const stack: ServiceConfig[] = [...services];
  while (stack.length > 0) {
    const svc = stack.pop()!;
    if (svc.id === id) return svc;
    if (svc.children && svc.children.length > 0) {
      stack.push(...svc.children);
    }
  }
  return undefined;
}

export function findServiceWithParent(
  services: ServiceConfig[],
  id: string
): { service: ServiceConfig; parent: ServiceConfig | null } | null {
  const stack: Array<{ svc: ServiceConfig; parent: ServiceConfig | null }> = services.map(s => ({ svc: s, parent: null }));
  while (stack.length > 0) {
    const { svc, parent } = stack.pop()!;
    if (svc.id === id) return { service: svc, parent };
    if (svc.children && svc.children.length > 0) {
      for (const child of svc.children) {
        stack.push({ svc: child, parent: svc });
      }
    }
  }
  return null;
}
