import useSWR from 'swr';

export interface GridConfig {
  columns: number;
  rowHeight: number;
  gap: number;
}

const DEFAULT_GRID: GridConfig = { columns: 24, rowHeight: 40, gap: 10 };

async function fetcher(url: string): Promise<GridConfig> {
  const res = await fetch(url);
  if (!res.ok) return DEFAULT_GRID;
  const settingsResponse = await res.json() as { grid?: GridConfig };
  return settingsResponse.grid ?? DEFAULT_GRID;
}

export function useGridConfig(): GridConfig {
  const { data } = useSWR<GridConfig>('/api/settings', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  return data ?? DEFAULT_GRID;
}
