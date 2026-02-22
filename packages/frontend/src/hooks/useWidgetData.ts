import useSWR from 'swr';
import type { WidgetDataResponse } from '@dashdash/types';

const fetcher = (url: string): Promise<WidgetDataResponse> =>
  fetch(url).then(r => r.json() as Promise<WidgetDataResponse>);

/**
 * Fetches widget data from the backend.
 * Passes a null SWR key for clientOnly widgets — SWR skips the fetch entirely.
 */
export function useWidgetData(serviceId: string, clientOnly: boolean) {
  const { data, error, isLoading } = useSWR<WidgetDataResponse>(
    clientOnly ? null : `/api/widget/${serviceId}/data`,
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false }
  );

  const widgetData = data && data.ok ? data.data : null;
  const widgetError = data && !data.ok ? data.error : error instanceof Error ? error.message : undefined;

  return {
    data: widgetData,
    error: widgetError,
    loading: isLoading,
  };
}
