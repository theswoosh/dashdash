import useSWR from 'swr';
import type { WidgetDataResponse } from '@dashdash/types';

const REFRESH_BASE_MS = 30_000;
const STAGGER_WINDOW_MS = 10_000;

const fetcher = (url: string): Promise<WidgetDataResponse> =>
  fetch(url).then(r => r.json() as Promise<WidgetDataResponse>);

/** Spread polls across a 10 s window to avoid simultaneous bursts. */
function refreshInterval(serviceId: string): number {
  const jitter = [...serviceId].reduce((acc, c) => acc + c.charCodeAt(0), 0) % STAGGER_WINDOW_MS;
  return REFRESH_BASE_MS + jitter;
}

/**
 * Fetches widget data from the backend.
 * Passes a null SWR key for clientOnly widgets — SWR skips the fetch entirely.
 */
export function useWidgetData(serviceId: string, clientOnly: boolean) {
  const { data, error, isLoading } = useSWR<WidgetDataResponse>(
    clientOnly ? null : `/api/widget/${serviceId}/data`,
    fetcher,
    { refreshInterval: refreshInterval(serviceId), revalidateOnFocus: false }
  );

  const widgetData = data && data.ok ? data.data : null;
  const widgetError = data && !data.ok ? data.error : error instanceof Error ? error.message : undefined;

  return {
    data: widgetData,
    error: widgetError,
    loading: isLoading,
  };
}
