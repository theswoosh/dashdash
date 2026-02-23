import useSWR from 'swr';

export interface WidgetTemplateSize {
  w: number;
  h: number;
}

export interface WidgetTemplateDef {
  type: string;
  defaultSize: WidgetTemplateSize;
  minSize?: WidgetTemplateSize | undefined;
}

const fetcher = (url: string) => fetch(url).then(r => r.json()) as Promise<WidgetTemplateDef[]>;

export function useWidgetTemplates(): WidgetTemplateDef[] {
  const { data } = useSWR<WidgetTemplateDef[]>('/api/widget-templates', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  return data ?? [];
}

/** Look up size defaults for a widget type, with fallbacks. */
export function getTemplateSizes(
  templates: WidgetTemplateDef[],
  type: string,
  fallback: { defaultSize: { w: number; h: number }; minSize?: { w: number; h: number } | undefined }
): { defaultW: number; defaultH: number; minW: number; minH: number } {
  const t = templates.find(t => t.type === type);
  return {
    defaultW: t?.defaultSize.w ?? fallback.defaultSize.w,
    defaultH: t?.defaultSize.h ?? fallback.defaultSize.h,
    minW: t?.minSize?.w ?? fallback.minSize?.w ?? 1,
    minH: t?.minSize?.h ?? fallback.minSize?.h ?? 1,
  };
}
