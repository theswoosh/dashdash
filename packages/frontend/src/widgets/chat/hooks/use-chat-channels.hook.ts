import useSWR from 'swr';
import type { ChatChannel } from '@dashdash/types';

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
  return {
    channels: data?.channels ?? [],
    error: error instanceof Error ? error.message : undefined,
    isLoading,
    mutate,
  };
}
