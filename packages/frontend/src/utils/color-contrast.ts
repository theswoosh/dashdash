/** WCAG contrast checking for free-hex widget colors — see
 * `_dev/roadmap/theme_safe_widget_colors.md` M1. Hand-rolled, no dependency. */

interface RGBA { r: number; g: number; b: number; a: number }

const HEX3_RE = /^#([0-9a-f]{3})$/i;
const HEX6_RE = /^#([0-9a-f]{6})$/i;
const HEX8_RE = /^#([0-9a-f]{6})([0-9a-f]{2})$/i;
const RGB_RE = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i;

function parseColor(input: string): RGBA | null {
  const value = input.trim();
  if (value === '') return null;

  const hex3 = HEX3_RE.exec(value);
  if (hex3) {
    const [r, g, b] = hex3[1]!.split('');
    return { r: parseInt(r! + r, 16), g: parseInt(g! + g, 16), b: parseInt(b! + b, 16), a: 1 };
  }

  const hex6 = HEX6_RE.exec(value);
  if (hex6) {
    const hex = hex6[1]!;
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 1 };
  }

  const hex8 = HEX8_RE.exec(value);
  if (hex8) {
    const hex = hex8[1]!;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: parseInt(hex8[2]!, 16) / 255,
    };
  }

  const rgb = RGB_RE.exec(value);
  if (rgb) {
    return {
      r: parseInt(rgb[1]!, 10),
      g: parseInt(rgb[2]!, 10),
      b: parseInt(rgb[3]!, 10),
      a: rgb[4] !== undefined ? parseFloat(rgb[4]) : 1,
    };
  }

  return null;
}

function compositeOver(top: RGBA, base: RGBA): RGBA {
  return {
    r: top.r * top.a + base.r * (1 - top.a),
    g: top.g * top.a + base.g * (1 - top.a),
    b: top.b * top.a + base.b * (1 - top.a),
    a: 1,
  };
}

function channelLuminance(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(c: RGBA): number {
  return 0.2126 * channelLuminance(c.r) + 0.7152 * channelLuminance(c.g) + 0.0722 * channelLuminance(c.b);
}

const OPAQUE_WHITE: RGBA = { r: 255, g: 255, b: 255, a: 1 };

/** WCAG contrast ratio between two colors (#rgb/#rrggbb/#rrggbbaa/rgb()/rgba()).
 * Alpha is composited over the other color (or white, as a last-resort
 * backdrop, if both carry alpha). Returns null when either string is
 * unparseable — callers must treat null as "passing", never guess. */
export function contrastRatio(fg: string, bg: string): number | null {
  const fgParsed = parseColor(fg);
  const bgParsed = parseColor(bg);
  if (!fgParsed || !bgParsed) return null;

  const bgOpaque = bgParsed.a < 1 ? compositeOver(bgParsed, OPAQUE_WHITE) : bgParsed;
  const fgOpaque = fgParsed.a < 1 ? compositeOver(fgParsed, bgOpaque) : fgParsed;

  const l1 = relativeLuminance(fgOpaque);
  const l2 = relativeLuminance(bgOpaque);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const MIN_CONTRAST = 3;

export interface ColorGuardInput {
  /** Theme id active when the colors were last edited, or undefined (legacy). */
  authoredTheme: string | undefined;
  /** Theme id currently rendering the board. */
  activeTheme: string;
  /** Custom bg_color option value — undefined if unset or a `token:*` value. */
  bgColor: string | undefined;
  /** Custom font_color option value — undefined if unset or a `token:*` value. */
  fontColor: string | undefined;
  /** Active theme's default card background (`--card-bg`). */
  themeCardBg: string;
  /** Active theme's default text color (`--card-fg` or `--text-primary`). */
  themeTextColor: string;
}

export interface ColorGuardResult {
  bgColor: string | undefined;
  bgSuppressed: boolean;
  fontColor: string | undefined;
  fontSuppressed: boolean;
}

/** Decides which custom colors survive under the active theme. Legacy boards
 * (no `color_theme`) and colors authored under the active theme pass through
 * unchanged. Otherwise each custom color is contrast-checked against the
 * active theme's surfaces and dropped (theme default takes over) below a
 * 3:1 ratio. Pure — no DOM access — so it's testable without jsdom. */
export function guardCustomColors(input: ColorGuardInput): ColorGuardResult {
  const { authoredTheme, activeTheme, bgColor, fontColor, themeCardBg, themeTextColor } = input;

  if (authoredTheme === undefined || authoredTheme === activeTheme) {
    return { bgColor, bgSuppressed: false, fontColor, fontSuppressed: false };
  }

  let effectiveBg = bgColor;
  let bgSuppressed = false;
  if (bgColor !== undefined) {
    const ratio = contrastRatio(themeTextColor, bgColor);
    if (ratio !== null && ratio < MIN_CONTRAST) {
      effectiveBg = undefined;
      bgSuppressed = true;
    }
  }

  let effectiveFont = fontColor;
  let fontSuppressed = false;
  if (fontColor !== undefined) {
    const bgForFontCheck = effectiveBg ?? themeCardBg;
    const ratio = contrastRatio(fontColor, bgForFontCheck);
    if (ratio !== null && ratio < MIN_CONTRAST) {
      effectiveFont = undefined;
      fontSuppressed = true;
    }
  }

  return { bgColor: effectiveBg, bgSuppressed, fontColor: effectiveFont, fontSuppressed };
}
