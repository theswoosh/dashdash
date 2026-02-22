import useSWR from 'swr';
import { useCallback } from 'react';
import type { ServiceConfig } from '@dashdash/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useServices() {
  const { data, error, isLoading, mutate } = useSWR<{ services: ServiceConfig[] }>(
    '/api/services',
    fetcher,
    { refreshInterval: 0, revalidateOnFocus: false }
  );

  const addServiceOptimistic = useCallback(
    (service: ServiceConfig) => {
      console.log('[SWR-mutate] called, current len:', (data as { services: ServiceConfig[] } | undefined)?.services?.length ?? 'undef');
      mutate(
        (current): { services: ServiceConfig[] } => {
          console.log('[SWR-mutate] updater current len:', current?.services?.length ?? 'undef');
          return { services: [...(current?.services ?? []), service] };
        },
        { revalidate: false }
      ).then(r => console.log('[SWR-mutate] result len:', r?.services?.length))
       .catch(err => console.error('[SWR-mutate] error:', err));
    },
    [mutate, data]
  );

  return {
    services: data?.services ?? [],
    isLoading,
    error,
    reload: () => mutate(),
    addServiceOptimistic,
  };
}
