import useSWR from 'swr';

interface WidgetTemplateSize {
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
