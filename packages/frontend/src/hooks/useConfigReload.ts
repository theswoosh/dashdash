import { useEffect, useRef } from 'react';

export function useConfigReload(onReload: () => void) {
  // Stable ref so the WS handler always calls the latest version of onReload
  // without needing to reconnect when the callback identity changes
  const onReloadRef = useRef(onReload);
  onReloadRef.current = onReload;

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
          if (msg.type === 'config:reload') {
            onReloadRef.current();
          }
        } catch { /* ignore malformed messages */ }
      };

      ws.onclose = () => {
        if (!destroyed) {
          retryTimer = setTimeout(connect, 3000);
        }
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
