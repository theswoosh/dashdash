import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import type { ChatMessage, ChatMessagesPage } from '@dashdash/types';
import { useAuth } from '../../../hooks/use-auth.hook';
import { usePreferences } from '../../../hooks/use-preferences.hook';
import { useChatWs } from '../../../hooks/use-chat-ws.hook';

const PAGE_SIZE = 50;
const FALLBACK_POLL_INTERVAL_MS = 30_000; // safety net only — WS is primary

const pageFetcher = ([url]: [string, string]): Promise<ChatMessagesPage> =>
  fetch(url).then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<ChatMessagesPage>;
  });

/**
 * Messages of one channel: SWR-polled latest page + locally accumulated older
 * pages (cursor pagination). Only mount this hook for the visible channel —
 * every instance polls.
 */
export function useChatMessages(channelId: string | null, pollingIntervalSec: number) {
  const { user } = useAuth();
  const { preferences } = usePreferences();

  // Older pages live outside SWR: they never change and shouldn't be re-fetched on poll.
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  useEffect(() => {
    setOlder([]);
    setHasMoreOlder(false);
  }, [channelId]);

  const { data, error, isLoading, mutate } = useSWR<ChatMessagesPage>(
    channelId ? [`/api/chat/channels/${channelId}/messages?limit=${PAGE_SIZE}`, channelId] : null,
    pageFetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: pollingIntervalSec > 0 ? FALLBACK_POLL_INTERVAL_MS : 0,
    },
  );

  useChatWs(event => {
    if (event.type !== 'chat:message' || event.channelId !== channelId) return;
    void mutate(current => ({
      messages: current && current.messages.some(m => m.id === event.message.id)
        ? current.messages
        : [...(current?.messages ?? []), event.message],
      hasMore: current?.hasMore ?? false,
    }), { revalidate: false });
  });

  // hasMore from the server only counts messages behind the latest page; once
  // older pages are loaded, the flag from the deepest loaded page wins.
  const hasMore = older.length > 0 ? hasMoreOlder : (data?.hasMore ?? false);

  const latest = data?.messages ?? [];
  const olderIds = new Set(older.map(m => m.id));
  const merged = [...older, ...latest.filter(m => !olderIds.has(m.id))];

  const loadOlder = useCallback(async () => {
    const oldestId = older[0]?.id ?? data?.messages[0]?.id;
    if (!channelId || !oldestId || isLoadingOlder) return;
    setIsLoadingOlder(true);
    try {
      const res = await fetch(
        `/api/chat/channels/${channelId}/messages?limit=${PAGE_SIZE}&before=${encodeURIComponent(oldestId)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const page = (await res.json()) as ChatMessagesPage;
      setOlder(prev => [...page.messages, ...prev]);
      setHasMoreOlder(page.hasMore);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [channelId, older, data, isLoadingOlder]);

  const send = useCallback(
    async (body: string) => {
      if (!channelId || !user) return;
      const tempMessage: ChatMessage = {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        channelId,
        userId: user.id,
        senderName: user.name,
        senderColor: preferences?.chatColor || null,
        body,
        createdAt: new Date().toISOString(),
      };
      await mutate(
        async current => {
          const res = await fetch(`/api/chat/channels/${channelId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const { message } = (await res.json()) as { message: ChatMessage };
          return {
            messages: [...(current?.messages ?? []), message],
            hasMore: current?.hasMore ?? false,
          };
        },
        {
          optimisticData: current => ({
            messages: [...(current?.messages ?? []), tempMessage],
            hasMore: current?.hasMore ?? false,
          }),
          rollbackOnError: true,
          revalidate: false,
        },
      );
    },
    [channelId, user, preferences?.chatColor, mutate],
  );

  return {
    messages: merged,
    hasMore,
    isLoading,
    isLoadingOlder,
    error: error instanceof Error ? error.message : undefined,
    loadOlder,
    send,
    currentUserId: user?.id,
  };
}
