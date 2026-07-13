// Shared icon value handling — service.icon stores a prefixed string:
//   "si:<slug>"  — Simple Icons (monochrome brand glyphs, bundled lazy chunk)
//   "di:<name>"  — dashboard-icons (colorful logos, loaded from jsDelivr CDN;
//                  user decision: browser-direct, no backend proxy)

export const SI_PREFIX = 'si:';
export const DI_PREFIX = 'di:';

const DI_CDN_BASE = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@main';

export function slugFromValue(value: string): string | null {
  if (!value.startsWith(SI_PREFIX)) return null;
  return value.slice(SI_PREFIX.length);
}

export function diNameFromValue(value: string): string | null {
  return value.startsWith(DI_PREFIX) ? value.slice(DI_PREFIX.length) : null;
}

export function diIconUrl(name: string, format: 'svg' | 'png' = 'svg'): string {
  return `${DI_CDN_BASE}/${format}/${encodeURIComponent(name)}.${format}`;
}

export function hasServiceIcon(iconValue: string): boolean {
  return iconValue.startsWith(SI_PREFIX) || iconValue.startsWith(DI_PREFIX);
}
