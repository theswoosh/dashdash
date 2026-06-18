import useSWR from 'swr';

interface WidgetTemplateSize {
  w: number;
  h: number;
}

export interface WidgetTemplateDef {
  type: string;
  defaultSize: WidgetTemplateSize;
  // Partial per-type option defaults (e.g. bg_color, layoutSize) edited via the
  // sidebar config popup and merged over catalog defaults when a widget is dropped.
  defaultOptions?: Record<string, unknown>;
}

const fetcher = (url: string) => fetch(url).then(res => res.json()) as Promise<WidgetTemplateDef[]>;

// Module-level constant so the loading state returns a stable reference.
const NO_TEMPLATES: WidgetTemplateDef[] = [];

export function useWidgetTemplates(): WidgetTemplateDef[] {
  const { data } = useSWR<WidgetTemplateDef[]>('/api/widget-templates', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  return data ?? NO_TEMPLATES;
}
