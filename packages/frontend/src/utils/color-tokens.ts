/** Theme-relative color tokens for widget `bg_color`/`font_color` options.
 * A token value is stored as `token:<name>` in the same options keys that
 * otherwise hold a plain hex/rgba string — see widget-card.component.tsx. */

export const COLOR_TOKENS = ['accent', 'muted', 'surface-1', 'surface-2', 'warn', 'danger'] as const;
export type ColorToken = typeof COLOR_TOKENS[number];

export const TOKEN_VALUE_PREFIX = 'token:';

const TOKEN_CSS_VAR: Record<ColorToken, string> = {
  accent: '--accent',
  muted: '--tone-muted',
  'surface-1': '--tone-surface-1',
  'surface-2': '--tone-surface-2',
  warn: '--tone-warn',
  danger: '--tone-danger',
};

const TOKEN_I18N_SUFFIX: Record<ColorToken, string> = {
  accent: 'accent',
  muted: 'muted',
  'surface-1': 'surface1',
  'surface-2': 'surface2',
  warn: 'warn',
  danger: 'danger',
};

export function isColorToken(name: string): name is ColorToken {
  return (COLOR_TOKENS as readonly string[]).includes(name);
}

export function tokenCssVar(token: ColorToken): string {
  return TOKEN_CSS_VAR[token];
}

export function tokenI18nKey(token: ColorToken): string {
  return `widgetConfig.colors.token.${TOKEN_I18N_SUFFIX[token]}`;
}

export function makeTokenValue(token: ColorToken): string {
  return `${TOKEN_VALUE_PREFIX}${token}`;
}

/** Parse a stored option value into its token name, or null if it isn't a
 * (recognized) token value. */
export function parseTokenValue(raw: string | undefined | null): ColorToken | null {
  if (!raw || !raw.startsWith(TOKEN_VALUE_PREFIX)) return null;
  const name = raw.slice(TOKEN_VALUE_PREFIX.length);
  return isColorToken(name) ? name : null;
}

/** Resolve a stored `bg_color`/`font_color` option value into a CSS-usable
 * value. Plain hex/rgba strings pass through unchanged. A `token:<name>`
 * value maps to the matching CSS var; an unrecognized token is dropped
 * (returns undefined) so the caller falls back to the theme default. */
export function resolveColorOptionValue(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  if (raw.startsWith(TOKEN_VALUE_PREFIX)) {
    const token = parseTokenValue(raw);
    return token ? `var(${tokenCssVar(token)})` : undefined;
  }
  return raw;
}
