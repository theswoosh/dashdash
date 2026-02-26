import { useState } from 'react';
import useSWR from 'swr';

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

export function useBoard() {
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

  // Increment to bust the browser's image cache after active wallpaper changes.
  const [bgRevision, setBgRevision] = useState(0);

  const backgroundUrl =
    board?.activeWallpaperId
      ? `/api/boards/${board.id}/background?v=${bgRevision}`
      : null;

  const setActiveWallpaper = async (wallpaperId: string | null): Promise<void> => {
    if (!board) return;
    void mutateBoard({ ...board, activeWallpaperId: wallpaperId }, { revalidate: false });
    setBgRevision(r => r + 1);
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
    if (board.activeWallpaperId === wallpaperId) {
      setBgRevision(r => r + 1);
    }
    await Promise.all([mutateWallpapers(), mutateBoard()]);
  };

  return { board, backgroundUrl, wallpapers, setActiveWallpaper, uploadWallpaper, deleteWallpaper };
}
