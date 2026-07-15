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

  const pendingPatch = useRef<Partial<Preferences>>({});
  const pendingMerged = useRef<Preferences>({ ...DEFAULT_PREFERENCES, theme: fallbackTheme });
  const cyclePromise = useRef<Promise<Preferences> | null>(null);
  const cycleSettle = useRef<{ resolve: (data: Preferences) => void; reject: (error: unknown) => void } | null>(null);

  const savePreferences = useCallback(
    (patch: Partial<Preferences>) => {
      pendingPatch.current = { ...pendingPatch.current, ...patch };

      if (!cyclePromise.current) {
        cyclePromise.current = new Promise<Preferences>((resolve, reject) => {
          cycleSettle.current = { resolve, reject };
        });
      }
      const cycle = cyclePromise.current;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const finalPatch = pendingPatch.current;
        const settle = cycleSettle.current;
        pendingPatch.current = {};
        cyclePromise.current = null;
        cycleSettle.current = null;

        fetch('/api/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalPatch),
        })
          .then(res => {
            if (!res.ok) throw new Error('preferences save failed');
            settle?.resolve(pendingMerged.current);
          })
          .catch(error => settle?.reject(error));
      }, SAVE_DEBOUNCE_MS);

      void mutate(cycle, {
        optimisticData: current => {
          const merged = { ...(current ?? DEFAULT_PREFERENCES), ...pendingPatch.current };
          pendingMerged.current = merged;
          return merged;
        },
        populateCache: false,
        revalidate: false,
        rollbackOnError: true,
      }).catch(() => { /* preference save is best-effort */ });
    },
    [mutate]
  );

  return {
    preferences: data,
    savePreferences,
  };
}
