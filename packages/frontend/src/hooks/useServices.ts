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
      void mutate(
        (current): { services: ServiceConfig[] } =>
          ({ services: [...(current?.services ?? []), service] }),
        { revalidate: false }
      );
    },
    [mutate]
  );

  return {
    services: data?.services ?? [],
    isLoading,
    error,
    reload: () => mutate(),
    addServiceOptimistic,
  };
}
