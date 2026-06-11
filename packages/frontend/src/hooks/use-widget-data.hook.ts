import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import type { WidgetDataResponse } from '@dashdash/types';

const REFRESH_BASE_MS = 30_000;
const STAGGER_WINDOW_MS = 10_000;

/** Spread polls across a 10 s window to avoid simultaneous bursts. */
function refreshInterval(serviceId: string): number {
  const jitter = [...serviceId].reduce((acc, c) => acc + c.charCodeAt(0), 0) % STAGGER_WINDOW_MS;
  return REFRESH_BASE_MS + jitter;
}

/**
 * Fetches widget data from the backend.
 * Passes a null SWR key for clientOnly widgets — SWR skips the fetch entirely.
 * In-flight requests are aborted when the widget unmounts (delete, type switch)
 * so slow backends don't accumulate orphaned requests.
 */
export function useWidgetData(serviceId: string, clientOnly: boolean) {
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const { data, error, isLoading } = useSWR<WidgetDataResponse>(
    clientOnly ? null : `/api/widget/${serviceId}/data`,
    (url: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      return fetch(url, { signal: controller.signal })
        .then(r => r.json() as Promise<WidgetDataResponse>);
    },
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
