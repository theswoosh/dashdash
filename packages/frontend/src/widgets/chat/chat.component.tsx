import { useState, useMemo, useCallback } from 'react';
import type { WidgetProps } from '@dashdash/types';
import { useT } from '../../i18n';
import { useChatChannels } from './hooks/use-chat-channels.hook';
import { useChatMessages } from './hooks/use-chat-messages.hook';
import { MessageList } from './message-list.component';
import { MessageComposer } from './message-composer.component';
import { ChatSearch } from './chat-search.component';
import { resolveChatSkin } from './skins/skin-registry';
import './ChatWidget.css';

const DEFAULT_POLLING_INTERVAL_SEC = 5;

export function ChatWidget({ options }: WidgetProps) {
  const t = useT();

  const rawInterval = options['pollingInterval'];
  const pollingInterval = typeof rawInterval === 'number' ? rawInterval : DEFAULT_POLLING_INTERVAL_SEC;
  const showTimestamps = options['showTimestamps'] !== false;

  const configuredIds = useMemo(
    () => (Array.isArray(options['channelIds'])
      ? (options['channelIds'] as unknown[]).filter((v): v is string => typeof v === 'string')
      : []),
    [options],
  );

  const { channels } = useChatChannels();
  const subscribed = useMemo(
    () => configuredIds
      .map(id => channels.find(c => c.id === id))
      .filter(c => c !== undefined),
    [configuredIds, channels],
  );

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const activeChannel =
    subscribed.find(c => c.id === selectedChannelId) ?? subscribed[0] ?? null;

  const {
    messages,
    hasMore,
    isLoading,
    isLoadingOlder,
    error,
    loadOlder,
    send,
    currentUserId,
  } = useChatMessages(activeChannel?.id ?? null, pollingInterval);

  const skin = resolveChatSkin(options['chatSkin']);

  // Stable handlers — MessageList re-attaches its IntersectionObserver when
  // onLoadOlder changes identity, which must not happen on every poll render.
  const loadOlderStable = useCallback(() => { void loadOlder(); }, [loadOlder]);

  if (subscribed.length === 0) {
    return <div className="chat-empty">{t('chat.noChannels')}</div>;
  }

  return (
    <div className={`chat-widget chat--skin-${skin}`}>
      <div className="chat-header">
        {subscribed.length > 1 ? (
          <div className="chat-tabs" role="tablist">
            {subscribed.map(channel => (
              <button
                key={channel.id}
                type="button"
                role="tab"
                aria-selected={channel.id === activeChannel?.id}
                className={`chat-tab${channel.id === activeChannel?.id ? ' chat-tab--active' : ''}`}
                onClick={() => { setSelectedChannelId(channel.id); setIsSearching(false); }}
              >
                {channel.name}
              </button>
            ))}
          </div>
        ) : <span className="chat-header__spacer" />}
        <button
          type="button"
          className={`chat-search-toggle${isSearching ? ' chat-search-toggle--active' : ''}`}
          onClick={() => setIsSearching(v => !v)}
          aria-label={t('chat.search')}
          title={t('chat.search')}
        >
          🔍
        </button>
      </div>
      {isSearching && activeChannel ? (
        <ChatSearch channelId={activeChannel.id} onClose={() => setIsSearching(false)} />
      ) : (
        <>
          {error && <div className="chat-error">{error}</div>}
          {!error && (isLoading && messages.length === 0
            ? <div className="chat-empty">…</div>
            : <MessageList
                messages={messages}
                currentUserId={currentUserId}
                showTimestamps={showTimestamps}
                hasMore={hasMore}
                isLoadingOlder={isLoadingOlder}
                onLoadOlder={loadOlderStable}
              />
          )}
          <MessageComposer onSend={send} disabled={activeChannel === null} />
        </>
      )}
    </div>
  );
}
