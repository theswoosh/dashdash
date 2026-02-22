import chokidar from 'chokidar';
import { join } from 'path';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WsSocket = { readyState: number; send: (data: string) => void };

const clients = new Set<WsSocket>();

// Counter incremented before a programmatic write to services.yml so the
// resulting chokidar event doesn't trigger a redundant frontend reload.
let suppressCount = 0;

export function suppressNextBroadcast(): void {
  suppressCount++;
}

export function addWsClient(ws: WsSocket): void {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'connected' }));
}

export function removeWsClient(ws: WsSocket): void {
  clients.delete(ws);
}

function broadcast(data: unknown): void {
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === 1) {
      try {
        ws.send(msg);
      } catch { /* client may have disconnected */ }
    }
  }
}

export function startWatcher(configDir: string) {
  const watcher = chokidar.watch(join(configDir, '*.yml'), {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });

  watcher.on('change', path => {
    if (suppressCount > 0) {
      suppressCount--;
      return;
    }
    console.log(`Config changed: ${path}`);
    broadcast({ type: 'config:reload', path });
  });

  watcher.on('add', path => {
    broadcast({ type: 'config:reload', path });
  });

  return watcher;
}
