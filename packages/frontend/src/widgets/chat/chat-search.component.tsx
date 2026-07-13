import { useState, useEffect } from 'react';
import type { ChatMessage } from '@dashdash/types';
import { useT } from '../../i18n';
import { formatMessageTime, parseMessageDate } from './chat-time';
import { resolveSenderColor } from './chat-colors';

const SEARCH_DEBOUNCE_MS = 300;

interface ChatSearchProps {
  channelId: string;
  onClose: () => void;
}

export function ChatSearch({ channelId, onClose }: ChatSearchProps) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatMessage[] | null>(null);

  // Results for an empty query are never rendered (see below), so the effect
  // only has to schedule fetches — no synchronous state reset needed.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const timer = setTimeout(() => {
      void fetch(
        `/api/chat/channels/${channelId}/messages/search?q=${encodeURIComponent(trimmed)}`,
      )
        .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((data: { messages: ChatMessage[] }) => setResults(data.messages))
        .catch(() => setResults([]));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, channelId]);

  return (
    <div className="chat-search">
      <div className="chat-search__bar">
        <input
          className="chat-search__input"
          value={query}
          placeholder={t('chat.searchPlaceholder')}
          autoFocus
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
        />
        <button type="button" className="chat-search__close" onClick={onClose} aria-label="Close search">
          ✕
        </button>
      </div>
      <div className="chat-search__results">
        {query.trim() !== '' && results !== null && results.length === 0 && (
          <div className="chat-empty">{t('chat.noResults')}</div>
        )}
        {query.trim() !== '' && results?.map(message => (
          <div key={message.id} className="chat-search__result">
            <div className="chat-search__result-meta">
              <span className="chat-sender" style={{ '--sender-color': resolveSenderColor(message) } as React.CSSProperties}>
                {message.senderName}
              </span>
              <span className="chat-time">
                {parseMessageDate(message.createdAt).toLocaleDateString()}{' '}
                {formatMessageTime(message.createdAt)}
              </span>
            </div>
            <div className="chat-search__result-body">{message.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
