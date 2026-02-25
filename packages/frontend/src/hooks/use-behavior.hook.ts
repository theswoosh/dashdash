import useSWR from 'swr';

export interface Behavior {
  holdToDeleteMs: number;
}

const DEFAULTS: Behavior = { holdToDeleteMs: 1000 };

async function fetcher(url: string): Promise<Behavior> {
  const res = await fetch(url);
  if (!res.ok) return DEFAULTS;
  return (await res.json()) as Behavior;
}

export function useBehavior(): Behavior {
  const { data } = useSWR<Behavior>('/api/behavior', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  return data ?? DEFAULTS;
}
