import useSWR from 'swr';

export interface LocalesResponse {
  languages: string[];
  translations: Record<string, Record<string, unknown>>;
}

const EMPTY: LocalesResponse = { languages: ['en'], translations: {} };

async function fetchLocales(url: string): Promise<LocalesResponse> {
  const res = await fetch(url);
  if (!res.ok) return EMPTY;
  return (await res.json()) as LocalesResponse;
}

export function useLocales(): LocalesResponse {
  const { data } = useSWR<LocalesResponse>('/api/locales', fetchLocales, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  return data ?? EMPTY;
}
