export interface WidgetSize {
  w: number;
  h: number;
}

export interface WidgetDefinition {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  integrationTypes?: string[];
  defaultSize: WidgetSize;
}

export interface WidgetDataRequest {
  widgetId: string;
  serviceId: string;
}

export type WidgetDataResponse<T = unknown> =
  | { ok: true; data: T; cachedAt?: number }
  | { ok: false; error: string };
