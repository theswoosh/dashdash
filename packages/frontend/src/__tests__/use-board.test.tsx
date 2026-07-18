import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { useBoard } from '../hooks/use-board.hook';

function response(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

function isolatedCacheWrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;
}

const BOARD_ID = 'board-1';

function mockFetch({
  activeWallpaperId,
  theme = 'liquid-glass',
  builtin = [] as { name: string; file: string; url: string }[],
}: {
  activeWallpaperId: string | null;
  theme?: string;
  builtin?: { name: string; file: string; url: string }[];
}) {
  return vi.fn((url: string) => {
    if (url === '/api/preferences') {
      return Promise.resolve(response({ theme, darkMode: true, borderless: false }));
    }
    if (url === '/api/boards/default') {
      return Promise.resolve(
        response({ id: BOARD_ID, name: 'Board', slug: 'board', activeWallpaperId })
      );
    }
    if (url === `/api/boards/${BOARD_ID}/wallpapers`) {
      return Promise.resolve(response([]));
    }
    if (url === '/api/wallpapers/builtin') {
      return Promise.resolve(response({ wallpapers: builtin }));
    }
    return Promise.resolve(response({}, false));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useBoard — background resolution matrix', () => {
  it('builtin:<file> → the builtin wallpaper URL', async () => {
    global.fetch = mockFetch({ activeWallpaperId: 'builtin:ascii_bg.png' }) as unknown as typeof fetch;

    const { result } = renderHook(() => useBoard(), { wrapper: isolatedCacheWrapper });

    await waitFor(() => expect(result.current.board?.id).toBe(BOARD_ID));
    expect(result.current.backgroundUrl).toBe('/api/wallpapers/builtin/ascii_bg.png');
  });

  it("'none' → no background", async () => {
    global.fetch = mockFetch({ activeWallpaperId: 'none' }) as unknown as typeof fetch;

    const { result } = renderHook(() => useBoard(), { wrapper: isolatedCacheWrapper });

    await waitFor(() => expect(result.current.board?.id).toBe(BOARD_ID));
    expect(result.current.backgroundUrl).toBeNull();
  });

  it('null + manifest hit for the active theme → theme-default URL', async () => {
    global.fetch = mockFetch({
      activeWallpaperId: null,
      theme: 'ascii',
      builtin: [{ name: 'ascii', file: 'ascii_bg.png', url: '/api/wallpapers/builtin/ascii_bg.png' }],
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useBoard(), { wrapper: isolatedCacheWrapper });

    await waitFor(() => expect(result.current.board?.id).toBe(BOARD_ID));
    await waitFor(() => expect(result.current.backgroundUrl).toBe('/api/wallpapers/builtin/ascii_bg.png'));
  });

  it('null + no manifest entry for the active theme → no background', async () => {
    global.fetch = mockFetch({
      activeWallpaperId: null,
      theme: 'atom',
      builtin: [{ name: 'ascii', file: 'ascii_bg.png', url: '/api/wallpapers/builtin/ascii_bg.png' }],
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useBoard(), { wrapper: isolatedCacheWrapper });

    await waitFor(() => expect(result.current.board?.id).toBe(BOARD_ID));
    expect(result.current.backgroundUrl).toBeNull();
  });

  it('an upload id → the existing per-user wallpaper URL (unchanged)', async () => {
    global.fetch = mockFetch({ activeWallpaperId: 'upload-xyz' }) as unknown as typeof fetch;

    const { result } = renderHook(() => useBoard(), { wrapper: isolatedCacheWrapper });

    await waitFor(() => expect(result.current.board?.id).toBe(BOARD_ID));
    expect(result.current.backgroundUrl).toBe(`/api/boards/${BOARD_ID}/wallpapers/upload-xyz`);
  });

  it('empty builtin manifest degrades gracefully for theme default (no crash, no bg)', async () => {
    global.fetch = mockFetch({ activeWallpaperId: null, theme: 'classic', builtin: [] }) as unknown as typeof fetch;

    const { result } = renderHook(() => useBoard(), { wrapper: isolatedCacheWrapper });

    await waitFor(() => expect(result.current.board?.id).toBe(BOARD_ID));
    expect(result.current.backgroundUrl).toBeNull();
    expect(result.current.builtinWallpapers).toEqual([]);
  });
});
