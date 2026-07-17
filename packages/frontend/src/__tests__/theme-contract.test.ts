/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Guards the chrome/board split (_dev/roadmap/chrome_theme.md, M4, 2026-07-17):
// board theme files may define CSS custom properties consumed by chrome
// (the --chrome-accent / --chrome-radius escape hatch), but must never
// contain rule blocks that target chrome-only surfaces — login, modals,
// admin panel, config side-panel, info/profile popups, or pickers scoped
// inside chrome. Those surfaces style themselves exclusively via
// --chrome-* vars from themes/chrome.css. If a board theme starts
// selecting one of these surfaces directly, that surface has regressed
// into being themeable again — the exact bug this project removed.

const THEMES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../themes');

const THEME_FILES = ['liquid-glass.css', 'classic.css', 'ascii.css', 'atom.css', 'base.css'];

// Matches selectors, not var *usage* inside a declaration value — a theme
// file may legitimately say `background: var(--chrome-accent)` as part of
// the escape hatch, but must never open a `.chrome-foo { ... }` rule body
// or select one of the chrome-owned surface classes/prefixes below.
const FORBIDDEN_SELECTOR_PATTERN =
  /(^|[\s,}])(\.chrome\b|\.login-|\.modal-backdrop|\.admin-|\.config-panel|\.info-overlay|\.profile-overlay|\.wp-overlay|\.cp-)/;

function selectorLines(css: string): string[] {
  // Strip comments, then keep only lines that open a rule (contain `{`)
  // — these are the selector lines, where surface-targeting would live.
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutComments
    .split('\n')
    .filter(line => line.includes('{'));
}

describe('theme contract: board themes stay out of chrome surfaces', () => {
  for (const file of THEME_FILES) {
    it(`${file} has no rule selecting a chrome-owned surface`, () => {
      const css = readFileSync(join(THEMES_DIR, file), 'utf8');
      const offendingLines = selectorLines(css).filter(line => FORBIDDEN_SELECTOR_PATTERN.test(line));
      expect(offendingLines).toEqual([]);
    });
  }
});
