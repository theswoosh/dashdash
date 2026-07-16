import { useRef, useEffect, useLayoutEffect, Fragment } from 'react';
import type { ChatMessage } from '@dashdash/types';
import { useT } from '../../i18n';
import { renderWithLinks } from '../../utils/linkify';
import { renderMarkdownLite } from '../../utils/markdown-lite';
import { formatMessageTime, parseMessageDate, messageDayKey } from './chat-time';
import { resolveSenderColor } from './chat-colors';

const SENDER_GROUP_GAP_MS = 5 * 60 * 1000;

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string | undefined;
  showTimestamps: boolean;
  markdownEnabled: boolean;
  hasMore: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
}

function dayLabel(value: string, t: (key: string) => string): string {
  const key = messageDayKey(value);
  const now = new Date();
  if (key === messageDayKey(now.toISOString())) return t('chat.today');
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === messageDayKey(yesterday.toISOString())) return t('chat.yesterday');
  return parseMessageDate(value).toLocaleDateString();
}

function MessageBubble({
  message,
  isOwn,
  showSender,
  showTimestamp,
  markdownEnabled,
}: {
  message: ChatMessage;
  isOwn: boolean;
  showSender: boolean;
  showTimestamp: boolean;
  markdownEnabled: boolean;
}) {
  const style = isOwn ? undefined : ({ '--sender-color': resolveSenderColor(message) } as React.CSSProperties);

  return (
    <div className={`chat-row${isOwn ? ' chat-row--own' : ''}`} style={style}>
      {showSender && <div className="chat-sender">{message.senderName}</div>}
      <div className="chat-bubble-wrap">
        <div className={`chat-bubble${isOwn ? ' chat-bubble--own' : ''}`}>
          {markdownEnabled ? renderMarkdownLite(message.body, 'chat-link') : renderWithLinks(message.body, 'chat-link')}
        </div>
      </div>
      {showTimestamp && (
        <div className="chat-time">{formatMessageTime(message.createdAt)}</div>
      )}
    </div>
  );
}

export function MessageList({
  messages,
  currentUserId,
  showTimestamps,
  markdownEnabled,
  hasMore,
  isLoadingOlder,
  onLoadOlder,
}: MessageListProps) {
  const t = useT();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const isPinnedToBottom = useRef(true);
  const prevFirstId = useRef<string | undefined>(undefined);
  const prevScrollHeight = useRef(0);

  const firstMessageId = messages[0]?.id;
  const lastMessageId = messages[messages.length - 1]?.id;

  // Track whether the user is reading near the bottom; only then follow new messages.
  const trackScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    isPinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  // Keep the viewport anchored when older messages are prepended: the previous
  // first message must stay where it was, so shift scrollTop by the height delta.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const wasPrepended =
      prevFirstId.current !== undefined &&
      firstMessageId !== prevFirstId.current &&
      messages.some(m => m.id === prevFirstId.current);
    if (wasPrepended) {
      el.scrollTop += el.scrollHeight - prevScrollHeight.current;
    }
    prevFirstId.current = firstMessageId;
    prevScrollHeight.current = el.scrollHeight;
  }, [messages, firstMessageId]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && isPinnedToBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastMessageId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // Load older pages when the top sentinel scrolls into view.
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root || !hasMore) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) onLoadOlder(); },
      { root, rootMargin: '80px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadOlder]);

  if (messages.length === 0) {
    return <div className="chat-empty">{t('chat.noMessages')}</div>;
  }

  return (
    <div className="chat-messages" ref={scrollRef} onScroll={trackScroll}>
      {hasMore && <div ref={topSentinelRef} className="chat-load-sentinel" />}
      {isLoadingOlder && <div className="chat-loading-older">{t('chat.loadingOlder')}</div>}
      {messages.map((message, i) => {
        const prev = messages[i - 1];
        const isOwn = currentUserId !== undefined && message.userId === currentUserId;
        const isNewDay = !prev || messageDayKey(prev.createdAt) !== messageDayKey(message.createdAt);
        const isNewGroup =
          !prev ||
          isNewDay ||
          prev.userId !== message.userId ||
          parseMessageDate(message.createdAt).getTime() - parseMessageDate(prev.createdAt).getTime() > SENDER_GROUP_GAP_MS;
        return (
          <Fragment key={message.id}>
            {isNewDay && <div className="chat-day">{dayLabel(message.createdAt, t)}</div>}
            <MessageBubble
              message={message}
              isOwn={isOwn}
              showSender={!isOwn && isNewGroup}
              showTimestamp={showTimestamps && isNewGroup}
              markdownEnabled={markdownEnabled}
            />
          </Fragment>
        );
      })}
    </div>
  );
}
