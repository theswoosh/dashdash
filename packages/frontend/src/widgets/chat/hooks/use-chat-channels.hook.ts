import useSWR from 'swr';
import type { ChatChannel } from '@dashdash/types';
import { useChatWs } from '../../../hooks/use-chat-ws.hook';

interface ChannelsResponse {
  channels: ChatChannel[];
}

const fetcher = (url: string): Promise<ChannelsResponse> =>
  fetch(url).then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<ChannelsResponse>;
  });

/** All chat channels; shared SWR cache entry across every chat widget and the config modal. */
export function useChatChannels() {
  const { data, error, isLoading, mutate } = useSWR<ChannelsResponse>('/api/chat/channels', fetcher, {
    revalidateOnFocus: false,
  });

  useChatWs(event => {
    if (event.type === 'chat:channel-created' || event.type === 'chat:channel-updated'
      || event.type === 'chat:channel-deleted') {
      void mutate();
    }
  });

  return {
    channels: data?.channels ?? [],
    error: error instanceof Error ? error.message : undefined,
    isLoading,
    mutate,
  };
}
