import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useChatMessages } from '../use-chat-messages.hook';

// Capture the onEvent callback passed to useChatWs so the test can simulate a push.
let capturedOnEvent: ((e: unknown) => void) | undefined;
vi.mock('../../../../hooks/use-chat-ws.hook', () => ({
  useChatWs: (onEvent: (e: unknown) => void) => { capturedOnEvent = onEvent; },
}));
vi.mock('../../../../hooks/use-auth.hook', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'U' } }) }));
vi.mock('../../../../hooks/use-preferences.hook', () => ({ usePreferences: () => ({ preferences: null }) }));

beforeEach(() => {
  capturedOnEvent = undefined;
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ messages: [], hasMore: false }),
  }) as unknown as typeof fetch;
});

describe('useChatMessages — WS push', () => {
  it('appends a message pushed via chat:message without waiting for the poll', async () => {
    const { result } = renderHook(() => useChatMessages('chan-1', 5));
    await waitFor(() => expect(result.current.messages).toEqual([]));

    capturedOnEvent?.({
      type: 'chat:message',
      channelId: 'chan-1',
      message: { id: 'm1', channelId: 'chan-1', userId: 'u2', senderName: 'Other', senderColor: null, body: 'hi', createdAt: new Date().toISOString() },
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0]?.body).toBe('hi');
  });

  it('ignores events for a different channel', async () => {
    // Distinct channelId from the previous test — SWR's cache is global across
    // tests in this file, so reusing 'chan-1' here would see the prior test's
    // mutated cache entry rather than a fresh fetch.
    const { result } = renderHook(() => useChatMessages('chan-2', 5));
    await waitFor(() => expect(result.current.messages).toEqual([]));

    capturedOnEvent?.({
      type: 'chat:message',
      channelId: 'chan-OTHER',
      message: { id: 'm2', channelId: 'chan-OTHER', userId: 'u2', senderName: 'Other', senderColor: null, body: 'nope', createdAt: new Date().toISOString() },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.messages).toEqual([]);
  });
});
