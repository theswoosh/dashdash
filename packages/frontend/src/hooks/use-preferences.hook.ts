import useSWR from 'swr';
import { useCallback, useEffect, useRef } from 'react';

const SAVE_DEBOUNCE_MS = 300;
const STORAGE_KEY_THEME = 'dashdash-theme';

export const DEFAULT_THEME = 'liquid-glass';

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
  language?: string | undefined;
  chatColor?: string | undefined;
}

const DEFAULT_PREFERENCES: Preferences = { theme: DEFAULT_THEME, darkMode: true, borderless: false };

const fallbackTheme = (() => { try { return localStorage.getItem(STORAGE_KEY_THEME) ?? DEFAULT_THEME; } catch { return DEFAULT_THEME; } })();

const fetcher = (url: string) => fetch(url).then(r => r.json()) as Promise<Preferences>;

export function usePreferences() {
  const { data, mutate } = useSWR<Preferences>('/api/preferences', fetcher, {
    revalidateOnFocus: false,
    fallbackData: { ...DEFAULT_PREFERENCES, theme: fallbackTheme },
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

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
