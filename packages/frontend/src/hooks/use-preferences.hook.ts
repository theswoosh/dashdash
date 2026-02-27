import useSWR from 'swr';
import { useCallback, useRef } from 'react';

const SAVE_DEBOUNCE_MS = 300;

interface Preferences {
  theme: string;
  darkMode: boolean;
  boardName?: string | undefined;
  borderless?: boolean | undefined;
  headerIcon?: string | undefined;
  showBoardName?: boolean | undefined;
  headerClock?: boolean | undefined;
  headerClockFormat?: string | undefined;
  headerClockTimezone?: string | undefined;
  headerClockShowSeconds?: boolean | undefined;
  headerSearch?: boolean | undefined;
  headerSearchEngine?: string | undefined;
  headerSearchPlaceholder?: string | undefined;
  hideTopbar?: boolean | undefined;
}

const DEFAULT_PREFERENCES: Preferences = { theme: 'liquid-glass', darkMode: true, borderless: false };

const fetcher = (url: string) => fetch(url).then(r => r.json()) as Promise<Preferences>;

export function usePreferences() {
  const { data, mutate } = useSWR<Preferences>('/api/preferences', fetcher, {
    revalidateOnFocus: false,
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savePreferences = useCallback(
    (patch: Partial<Preferences>) => {
      void mutate(current => ({ ...(current ?? DEFAULT_PREFERENCES), ...patch }), {
        revalidate: false,
      });

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void fetch('/api/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        }).catch(() => { /* preference save is best-effort */ });
      }, SAVE_DEBOUNCE_MS);
    },
    [mutate]
  );

  return {
    preferences: data,
    savePreferences,
  };
}
