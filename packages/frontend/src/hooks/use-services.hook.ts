import useSWR from 'swr';
import type { ServiceConfig } from '@dashdash/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useServices() {
  const { data, error, isLoading, mutate } = useSWR<{ services: ServiceConfig[]; hasConfigErrors: boolean }>(
    '/api/services',
    fetcher,
    { refreshInterval: 0, revalidateOnFocus: false }
  );

  return {
    services: data?.services ?? [],
    hasConfigErrors: data?.hasConfigErrors ?? false,
    isLoading,
    error,
    reload: () => mutate(),
  };
}
