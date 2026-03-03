import useSWR from 'swr';

export interface SearchEngine {
  id: string;
  label: string;
  url: string;
  placeholder?: string | undefined;
}

export interface DashSettings {
  title: string;
  timezone?: string | undefined;
  language?: string | undefined;
  searchEngines?: SearchEngine[] | undefined;
  grid?: {
    columns: number;
    rowHeight: number;
    gap: number;
  } | undefined;
}

const DEFAULTS: DashSettings = { title: 'dashdash', searchEngines: [] };

async function fetchSettings(url: string): Promise<DashSettings> {
  const res = await fetch(url);
  if (!res.ok) return DEFAULTS;
  return (await res.json()) as DashSettings;
}

export function useSettings(): DashSettings {
  const { data } = useSWR<DashSettings>('/api/settings', fetchSettings, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  return data ?? DEFAULTS;
}
