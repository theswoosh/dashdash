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
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Droplets, LayoutDashboard, Terminal, Radiation } from 'lucide-react';
import { LiquidCard } from '../components/liquid-card.component';
import { ClassicCard } from '../components/classic-card.component';
import { AsciiCard } from '../components/ascii-card.component';
import { AtomCard } from '../components/atom-card.component';

/** Props that every card component must accept. */
interface CardProps {
  children: ReactNode;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}

/** One entry in the theme registry. */
interface ThemeDefinition {
  /** Matches the data-theme attribute value on <html>. */
  id: string;
  name: string;
  nameKey?: string | undefined;
  description: string;
  descriptionKey?: string | undefined;
  Icon: LucideIcon;
  /** Card component rendered by WidgetCard for this theme. */
  Card: ComponentType<CardProps>;
  /** Whether per-widget background overrides (hex or token) render under this
   * theme. Themes whose cards are their background (glass/CRT/terminal) lock it. */
  allowsWidgetBg: boolean;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'liquid-glass',
    name: 'Liquid Glass',
    nameKey: 'themes.liquidGlass.name',
    description: 'Frosted-glass cards with soft rounded corners and lens distortion',
    descriptionKey: 'themes.liquidGlass.description',
    Icon: Droplets,
    Card: LiquidCard,
    allowsWidgetBg: false,
  },
  {
    id: 'classic',
    name: 'Color',
    nameKey: 'themes.classic.name',
    description: 'Clean rounded cards — fully customizable widget colors',
    descriptionKey: 'themes.classic.description',
    Icon: LayoutDashboard,
    Card: ClassicCard,
    allowsWidgetBg: true,
  },
  {
    id: 'ascii',
    name: 'ASCII',
    nameKey: 'themes.ascii.name',
    description: 'Retro 8-bit terminal — box-drawing borders on midnight blue',
    descriptionKey: 'themes.ascii.description',
    Icon: Terminal,
    Card: AsciiCard,
    allowsWidgetBg: false,
  },
  {
    id: 'atom',
    name: 'ATOM',
    nameKey: 'themes.atom.name',
    description: 'Post-apocalyptic phosphor CRT — scanlines, vignette, green glow',
    descriptionKey: 'themes.atom.description',
    Icon: Radiation,
    Card: AtomCard,
    allowsWidgetBg: false,
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

/** Returns the currently active theme's id (matches the data-theme attribute). */
export function useThemeId(): string {
  return useContext(ThemeContext).theme.id;
}

