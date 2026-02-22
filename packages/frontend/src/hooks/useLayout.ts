import useSWR from 'swr';
import { useCallback, useRef } from 'react';
import type { Layout } from 'react-grid-layout';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useLayout(boardId = 'default') {
  const { data, mutate } = useSWR<{ layout: Layout[] | null }>(
    `/api/layout?board=${boardId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Debounce timer ref — persists across renders without causing re-renders
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveLayout = useCallback(
    (layout: Layout[]) => {
      // Optimistic local update so the grid doesn't snap while debouncing
      void mutate({ layout }, { revalidate: false });

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await fetch('/api/layout', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ board: boardId, layout }),
        });
      }, 500);
    },
    [boardId, mutate]
  );

  const reload = useCallback(() => mutate(), [mutate]);

  return {
    savedLayout: data?.layout ?? null,
    isLoading: data === undefined,
    saveLayout,
    reload,
  };
}
