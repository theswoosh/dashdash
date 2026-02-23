import useSWR from 'swr';
import { useCallback, useRef } from 'react';

interface Preferences {
  theme: string;
  darkMode: boolean;
  boardName?: string | undefined;
}

const fetcher = (url: string) => fetch(url).then(r => r.json()) as Promise<Preferences>;

export function usePreferences() {
  const { data, mutate } = useSWR<Preferences>('/api/preferences', fetcher, {
    revalidateOnFocus: false,
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savePreferences = useCallback(
    (patch: Partial<Preferences>) => {
      void mutate(current => ({ ...(current ?? { theme: 'liquid-glass', darkMode: true }), ...patch }), {
        revalidate: false,
      });

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void fetch('/api/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
      }, 300);
    },
    [mutate]
  );

  return {
    preferences: data,
    savePreferences,
  };
}
