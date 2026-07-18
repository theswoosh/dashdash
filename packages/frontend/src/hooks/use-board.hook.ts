import useSWR from 'swr';
import { usePreferences, DEFAULT_THEME } from './use-preferences.hook';

interface BoardMeta {
  id: string;
  name: string;
  slug: string;
  activeWallpaperId: string | null;
}

export interface WallpaperEntry {
  id: string;
  url: string;
  uploadedAt: string;
}

export interface BuiltinWallpaperEntry {
  name: string;
  file: string;
  url: string;
}

async function fetchBoardMeta(url: string): Promise<BoardMeta | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as BoardMeta;
}

async function fetchWallpapers(url: string): Promise<WallpaperEntry[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  return (await res.json()) as WallpaperEntry[];
}

async function fetchBuiltinWallpapers(url: string): Promise<BuiltinWallpaperEntry[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  const body = (await res.json()) as { wallpapers: BuiltinWallpaperEntry[] };
  return body.wallpapers;
}

export function useBoard() {
  const { preferences, isLoading: preferencesLoading } = usePreferences();
  const activeThemeId = preferences?.theme ?? DEFAULT_THEME;

  const { data: board, mutate: mutateBoard } = useSWR<BoardMeta | null>(
    '/api/boards/default',
    fetchBoardMeta,
    { revalidateOnFocus: false },
  );

  const { data: wallpapers = [], mutate: mutateWallpapers } = useSWR<WallpaperEntry[]>(
    board?.id ? `/api/boards/${board.id}/wallpapers` : null,
    fetchWallpapers,
    { revalidateOnFocus: false },
  );

  const { data: builtinWallpapers = [] } = useSWR<BuiltinWallpaperEntry[]>(
    '/api/wallpapers/builtin',
    fetchBuiltinWallpapers,
    { revalidateOnFocus: false },
  );

  // Each wallpaper has its own stable URL, so switching IDs naturally busts the cache.
  const activeWallpaperId = board?.activeWallpaperId ?? null;
  let backgroundUrl: string | null = null;
  if (activeWallpaperId?.startsWith('builtin:')) {
    const file = activeWallpaperId.slice('builtin:'.length);
    backgroundUrl = `/api/wallpapers/builtin/${file}`;
  } else if (activeWallpaperId === 'none') {
    backgroundUrl = null;
  } else if (activeWallpaperId) {
    backgroundUrl = `/api/boards/${board!.id}/wallpapers/${activeWallpaperId}`;
  } else if (!preferencesLoading) {
    // null/absent → theme default: use the built-in wallpaper matching the active theme, if any.
    // Gated on preferences having actually resolved — resolving against the
    // (possibly stale/default) fallback theme here would flash the wrong
    // theme's wallpaper for an instant on cold load.
    const themeDefault = builtinWallpapers.find(w => w.name === activeThemeId);
    backgroundUrl = themeDefault?.url ?? null;
  }

  const setActiveWallpaper = async (wallpaperId: string | null): Promise<void> => {
    if (!board) return;
    void mutateBoard({ ...board, activeWallpaperId: wallpaperId }, { revalidate: false });
    const res = await fetch(`/api/boards/${board.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeWallpaperId: wallpaperId }),
    });
    if (!res.ok) {
      void mutateBoard({ ...board, activeWallpaperId: board.activeWallpaperId }, { revalidate: false });
      throw new Error('Failed to update active wallpaper');
    }
    await mutateBoard();
  };

  const uploadWallpaper = async (file: File): Promise<void> => {
    if (!board) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/boards/${board.id}/wallpapers`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Upload failed');
    await mutateWallpapers();
  };

  const deleteWallpaper = async (wallpaperId: string): Promise<void> => {
    if (!board) return;
    const res = await fetch(`/api/boards/${board.id}/wallpapers/${wallpaperId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Delete failed');
    await Promise.all([mutateWallpapers(), mutateBoard()]);
  };

  return { board, backgroundUrl, wallpapers, builtinWallpapers, setActiveWallpaper, uploadWallpaper, deleteWallpaper };
}
