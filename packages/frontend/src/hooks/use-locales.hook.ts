import useSWR from 'swr';
import { EN_FALLBACK } from '../i18n/en.fallback';

export interface LocalesResponse {
  languages: string[];
  translations: Record<string, Record<string, unknown>>;
}

const FALLBACK: LocalesResponse = {
  languages: ['en'],
  translations: { en: EN_FALLBACK as Record<string, unknown> },
};

async function fetchLocales(url: string): Promise<LocalesResponse> {
  const res = await fetch(url);
  if (!res.ok) return FALLBACK;
  return (await res.json()) as LocalesResponse;
}

export function useLocales(): LocalesResponse {
  const { data } = useSWR<LocalesResponse>('/api/locales', fetchLocales, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  return data ?? FALLBACK;
}
