export type ThemeId = 'glass' | 'dark' | 'light' | 'custom';

export type BackgroundType = 'image' | 'gradient' | 'color' | 'unsplash' | 'video';

export interface BackgroundConfig {
  type: BackgroundType;
  url?: string;
  blur?: number;
  overlay?: string;
  parallax?: boolean;
}

export interface GridConfig {
  columns: number;
  rowHeight: number;
  gap: number;
}

export interface OidcConfig {
  enabled: boolean;
  issuer: string;
  clientId: string;
  scopes: string;
  groupsClaim?: string;
}

export interface AuthConfig {
  oidc?: OidcConfig;
  local?: { enabled: boolean };
}

export interface Settings {
  title: string;
  theme: ThemeId;
  background?: BackgroundConfig;
  grid: GridConfig;
  auth?: AuthConfig;
  css?: { custom?: string };
}

export interface IntegrationConfig {
  id: string;
  type: string;
  url: string;
  [key: string]: unknown;
}

export interface ServiceLayout {
  w: number;
  h: number;
  x?: number;
  y?: number;
}

export interface ServiceConfig {
  id: string; // always present after load (auto-assigned from widget type if absent in YAML)
  title: string;
  icon?: string | undefined;
  integration?: string | undefined;
  widget: string;
  layout: ServiceLayout;
  options?: Record<string, unknown> | undefined;
}
