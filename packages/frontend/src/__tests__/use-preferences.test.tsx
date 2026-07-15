import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { usePreferences, DEFAULT_THEME } from '../hooks/use-preferences.hook';

function response(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

function isolatedCacheWrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePreferences — savePreferences', () => {
  it('applies an optimistic update immediately and persists via PUT after the debounce', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(init ? response({ ok: true }) : response({ theme: DEFAULT_THEME, darkMode: true, borderless: false }))
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => usePreferences(), { wrapper: isolatedCacheWrapper });

    await waitFor(() => expect(result.current.preferences?.theme).toBe(DEFAULT_THEME));

    act(() => {
      result.current.savePreferences({ theme: 'atom' });
    });

    expect(result.current.preferences?.theme).toBe('atom');

    await waitFor(
      () => {
        const putCall = fetchMock.mock.calls.find(call => (call[1] as RequestInit | undefined)?.method === 'PUT');
        expect(putCall).toBeDefined();
      },
      { timeout: 1000 }
    );

    const putCall = fetchMock.mock.calls.find(call => (call[1] as RequestInit | undefined)?.method === 'PUT');
    expect(JSON.parse((putCall?.[1] as RequestInit).body as string)).toEqual({ theme: 'atom' });
    expect(result.current.preferences?.theme).toBe('atom');
  });

  it('coalesces rapid preference changes into a single debounced PUT with the merged patch', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(init ? response({ ok: true }) : response({ theme: DEFAULT_THEME, darkMode: true, borderless: false }))
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => usePreferences(), { wrapper: isolatedCacheWrapper });
    await waitFor(() => expect(result.current.preferences?.theme).toBe(DEFAULT_THEME));

    act(() => {
      result.current.savePreferences({ theme: 'atom' });
    });
    act(() => {
      result.current.savePreferences({ darkMode: false });
    });

    expect(result.current.preferences?.theme).toBe('atom');
    expect(result.current.preferences?.darkMode).toBe(false);

    await waitFor(
      () => {
        const putCalls = fetchMock.mock.calls.filter(call => (call[1] as RequestInit | undefined)?.method === 'PUT');
        expect(putCalls.length).toBe(1);
      },
      { timeout: 1000 }
    );

    const putCall = fetchMock.mock.calls.find(call => (call[1] as RequestInit | undefined)?.method === 'PUT');
    expect(JSON.parse((putCall?.[1] as RequestInit).body as string)).toEqual({ theme: 'atom', darkMode: false });
  });

  it('rolls back the optimistic update if the debounced PUT fails', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      init
        ? Promise.resolve(response(undefined, false))
        : Promise.resolve(response({ theme: DEFAULT_THEME, darkMode: true, borderless: false }))
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => usePreferences(), { wrapper: isolatedCacheWrapper });
    await waitFor(() => expect(result.current.preferences?.theme).toBe(DEFAULT_THEME));

    act(() => {
      result.current.savePreferences({ theme: 'atom' });
    });
    expect(result.current.preferences?.theme).toBe('atom');

    await waitFor(() => expect(result.current.preferences?.theme).toBe(DEFAULT_THEME), { timeout: 1000 });
  });
});
