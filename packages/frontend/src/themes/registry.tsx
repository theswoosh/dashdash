/**
 * Theme registry — the single source of truth for all themes.
 *
 * To add a new theme:
 *   1. Create src/themes/<name>.css with all CSS vars under:
 *      [data-theme='<id>'], [data-theme-preview='<id>'] { ... }
 *   2. Import the CSS file in App.tsx
 *   3. Add one entry to THEMES below (Card can reuse an existing card component)
 *
 * Nothing else needs to change.
 */

import { createContext, useContext, useMemo } from 'react';
import type { ComponentType, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Droplets, LayoutDashboard, Terminal } from 'lucide-react';
import { LiquidCard } from '../components/liquid-card.component';
import { ClassicCard } from '../components/classic-card.component';
import { AsciiCard } from '../components/ascii-card.component';

/** Props that every card component must accept. */
export interface CardProps {
  children: ReactNode;
  className?: string | undefined;
}

/** One entry in the theme registry. */
export interface ThemeDefinition {
  /** Matches the data-theme attribute value on <html>. */
  id: string;
  name: string;
  description: string;
  Icon: LucideIcon;
  /** Card component rendered by WidgetCard for this theme. */
  Card: ComponentType<CardProps>;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'liquid-glass',
    name: 'Liquid Glass',
    description: 'Squircle cards with backdrop blur and lens distortion',
    Icon: Droplets,
    Card: LiquidCard,
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Clean rounded cards with subtle border and shadow',
    Icon: LayoutDashboard,
    Card: ClassicCard,
  },
  {
    id: 'ascii',
    name: 'ASCII',
    description: 'Terminal aesthetic with monospace font and sharp corners',
    Icon: Terminal,
    Card: AsciiCard,
  },
];

export function getTheme(id: string): ThemeDefinition {
  return THEMES.find(t => t.id === id) ?? THEMES[0]!;
}

// ── Context ──────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: ThemeDefinition;
  Card: ComponentType<CardProps>;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: THEMES[0]!,
  Card: LiquidCard,
});

export function ThemeProvider({ themeId, children }: { themeId: string; children: ReactNode }) {
  const theme = useMemo(() => getTheme(themeId), [themeId]);
  const value = useMemo(() => ({ theme, Card: theme.Card }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Returns the Card component for the currently active theme. */
export function useThemeCard(): ComponentType<CardProps> {
  return useContext(ThemeContext).Card;
}

/** Returns the full ThemeDefinition for the currently active theme. */
export function useTheme(): ThemeDefinition {
  return useContext(ThemeContext).theme;
}
