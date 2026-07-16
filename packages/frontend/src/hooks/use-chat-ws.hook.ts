import { useEffect, useRef } from 'react';
import type { ChatWsEvent } from '@dashdash/types';

const WS_RECONNECT_DELAY_MS = 3000;

/** Subscribes to chat:* events on /api/ws. Same connect/reconnect shape as
 *  useConfigReload — kept as a separate connection (not merged) since the
 *  event sets are unrelated and dashdash's per-tab connection count is small. */
export function useChatWs(onEvent: (event: ChatWsEvent) => void): void {
  const onEventRef = useRef(onEvent);
  // eslint-disable-next-line react-hooks/refs -- intentional stable-ref pattern (callback identity isolation)
  onEventRef.current = onEvent;

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/api/ws`;

    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    const connect = () => {
      if (destroyed) return;
      ws = new WebSocket(url);

      ws.onmessage = event => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string };
          if (typeof msg.type === 'string' && msg.type.startsWith('chat:')) {
            onEventRef.current(msg as ChatWsEvent);
          }
        } catch { /* malformed JSON from WebSocket — non-critical, skip */ }
      };

      ws.onclose = () => {
        if (!destroyed) retryTimer = setTimeout(connect, WS_RECONNECT_DELAY_MS);
      };

      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, []); // intentionally empty — url is stable, handler via ref
}
