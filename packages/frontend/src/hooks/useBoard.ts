import { useState } from 'react';
import useSWR from 'swr';

interface BoardMeta {
  id: string;
  name: string;
  slug: string;
  hasBackground: boolean;
  wallpaperEnabled: boolean;
}

async function fetcher(url: string): Promise<BoardMeta | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as BoardMeta;
}

export function useBoard() {
  const { data: board, mutate } = useSWR<BoardMeta | null>('/api/boards/default', fetcher, {
    revalidateOnFocus: false,
  });

  // Increment to bust the browser's image cache after upload/remove.
  const [bgRevision, setBgRevision] = useState(0);

  // Only serve the URL when both an image exists AND wallpaper is enabled.
  const backgroundUrl =
    board?.hasBackground && board.wallpaperEnabled
      ? `/api/boards/${board.id}/background?v=${bgRevision}`
      : null;

  const setWallpaperEnabled = async (enabled: boolean): Promise<void> => {
    if (!board) return;
    // Optimistic update — toggle feels instant, no snap-back during refetch.
    void mutate({ ...board, wallpaperEnabled: enabled }, { revalidate: false });
    const res = await fetch(`/api/boards/${board.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallpaperEnabled: enabled }),
    });
    if (!res.ok) {
      // Revert on failure.
      void mutate({ ...board, wallpaperEnabled: !enabled }, { revalidate: false });
      throw new Error('Failed to update wallpaper setting');
    }
    await mutate();
  };

  const upload = async (file: File): Promise<void> => {
    if (!board) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/boards/${board.id}/background`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Upload failed');
    setBgRevision(r => r + 1);
    await mutate();
  };

  const uploadFromUrl = async (url: string): Promise<void> => {
    if (!board) return;
    const res = await fetch(`/api/boards/${board.id}/background/from-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error('Upload from URL failed');
    setBgRevision(r => r + 1);
    await mutate();
  };

  const remove = async (): Promise<void> => {
    if (!board) return;
    await fetch(`/api/boards/${board.id}/background`, { method: 'DELETE' });
    setBgRevision(r => r + 1);
    await mutate();
  };

  return { board, backgroundUrl, setWallpaperEnabled, upload, uploadFromUrl, remove };
}
