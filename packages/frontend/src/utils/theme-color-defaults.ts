const HEX3_RE = /^#([0-9a-fA-F]{3})$/;
const HEX6_RE = /^#([0-9a-fA-F]{6})$/;
const RGB_RE = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/;

const FALLBACK_BG = { hex: '#ffffff', alpha: 1 };
const FALLBACK_FG = { hex: '#191919', alpha: 1 };

/** Parse a plain `#rgb`, `#rrggbb`, `rgb()` or `rgba()` color string. */
export function parseThemeColor(raw: string): { hex: string; alpha: number } | null {
  const value = raw.trim();
  if (value === '') return null;

  const hex3 = HEX3_RE.exec(value);
  if (hex3) {
    const [r, g, b] = hex3[1]!.split('');
    return { hex: `#${r}${r}${g}${g}${b}${b}`.toLowerCase(), alpha: 1 };
  }

  const hex6 = HEX6_RE.exec(value);
  if (hex6) {
    return { hex: `#${hex6[1]}`.toLowerCase(), alpha: 1 };
  }

  const rgb = RGB_RE.exec(value);
  if (rgb) {
    const r = parseInt(rgb[1]!, 10);
    const g = parseInt(rgb[2]!, 10);
    const b = parseInt(rgb[3]!, 10);
    const alpha = rgb[4] !== undefined ? parseFloat(rgb[4]) : 1;
    const hex = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
    return { hex, alpha };
  }

  return null;
}

function readVar(element: Element, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

/**
 * Reads the active theme's default card background/text colors from the CSS
 * custom properties themes set at the root, so widget-config color pickers
 * can seed from what an UNSET color actually renders as.
 */
export function getThemeColorDefaults(element: Element = document.documentElement): {
  bg: { hex: string; alpha: number };
  fg: { hex: string; alpha: number };
} {
  const cardBg = readVar(element, '--card-bg');
  const cardFg = readVar(element, '--card-fg');
  const textPrimary = readVar(element, '--text-primary');

  const bg = (cardBg !== '' ? parseThemeColor(cardBg) : null) ?? FALLBACK_BG;
  const fg = (cardFg !== '' ? parseThemeColor(cardFg) : null)
    ?? (textPrimary !== '' ? parseThemeColor(textPrimary) : null)
    ?? FALLBACK_FG;

  return { bg, fg };
}
