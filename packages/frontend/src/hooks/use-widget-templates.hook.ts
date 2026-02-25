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

const fetcher = (url: string) => fetch(url).then(res => res.json()) as Promise<WidgetTemplateDef[]>;

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
  const matchedTemplate = templates.find(tmpl => tmpl.type === type);
  return {
    defaultW: matchedTemplate?.defaultSize.w ?? fallback.defaultSize.w,
    defaultH: matchedTemplate?.defaultSize.h ?? fallback.defaultSize.h,
    minW: matchedTemplate?.minSize?.w ?? fallback.minSize?.w ?? 1,
    minH: matchedTemplate?.minSize?.h ?? fallback.minSize?.h ?? 1,
  };
}
