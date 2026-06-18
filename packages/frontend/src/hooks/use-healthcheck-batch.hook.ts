import { useMemo } from 'react';
import useSWR from 'swr';
import { useServices } from './use-services.hook';

interface CheckResult {
  status: 'up' | 'down' | 'unknown';
  latencyMs: number;
  error?: string;
}

interface BatchResponse {
  results: Record<string, CheckResult>;
}

const fetcher = ([url, ids]: [string, string]): Promise<BatchResponse> =>
  fetch(`${url}?ids=${ids}`).then(r => r.json() as Promise<BatchResponse>);

/**
 * Fetches healthcheck status for all healthcheck services in a single batch request.
 * All healthcheck WidgetCards share the same SWR cache entry because they all call
 * this hook with the same sorted IDs key — one HTTP request per 30 s interval instead of N.
 *
 * Pass serviceId=null to disable (used for non-healthcheck widgets that still call this hook).
 */
export function useHealthcheckBatch(serviceId: string | null) {
  const { services } = useServices();

  const idsKey = useMemo(
    () => services
      .filter(s => s.widget === 'healthcheck')
      .map(s => s.id)
      .sort()
      .join(','),
    [services],
  );

  const { data, error, isLoading } = useSWR<BatchResponse>(
    serviceId !== null && idsKey ? ['/api/healthcheck/batch', idsKey] : null,
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );

  const result = serviceId !== null && data ? (data.results[serviceId] ?? null) : null;
  const widgetError = !result && !isLoading && error instanceof Error ? error.message : undefined;

  return {
    data: result,
    error: widgetError,
    loading: serviceId !== null ? isLoading : false,
  };
}
