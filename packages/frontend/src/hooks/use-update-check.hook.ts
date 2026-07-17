import useSWR from 'swr';

export interface UpdateCheck {
  updateAvailable: boolean;
  latestVersion: string | null;
  releaseUrl: string | null;
}

const updateFetcher = (url: string) => fetch(url).then(res => res.json()) as Promise<UpdateCheck>;

export function useUpdateCheck(): UpdateCheck {
  const { data } = useSWR('/api/update-check', updateFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60 * 60 * 1000,
  });

  return {
    updateAvailable: data?.updateAvailable ?? false,
    latestVersion: data?.latestVersion ?? null,
    releaseUrl: data?.releaseUrl ?? null,
  };
}
