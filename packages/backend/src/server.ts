import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { buildApp } from './app.js';
import { startWatcher } from './config/watcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// src/ → backend/ → packages/ → repo root  (dev)
// dist/          → app/       → /           (prod, absolute env vars used instead)
const repoRoot = resolve(__dirname, '../../..');

const DATA_DIR = resolve(repoRoot, process.env['DATA_DIR'] ?? 'data');
const CONFIG_DIR = resolve(repoRoot, process.env['CONFIG_DIR'] ?? 'config');

// In production (Docker), the frontend is built into ./public next to dist/.
// This resolves to /app/public when running from /app/dist/server.js.
const PUBLIC_DIR = resolve(__dirname, '../public');
const publicDir = existsSync(PUBLIC_DIR) ? PUBLIC_DIR : undefined;

const { server, db } = await buildApp({ dataDir: DATA_DIR, configDir: CONFIG_DIR, publicDir, logger: true });

startWatcher(CONFIG_DIR, server.log);
server.log.info(`Watching config dir: ${CONFIG_DIR}`);

const shutdown = async (signal: string) => {
  server.log.info(`${signal} received, shutting down`);
  await server.close();
  // Fold the WAL back into the main db file so the -wal sidecar doesn't
  // grow unbounded across container restarts.
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    server.log.warn({ err }, 'WAL checkpoint on shutdown failed');
  }
  db.close();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

const port = Number(process.env['PORT'] ?? 4000);
const host = process.env['HOST'] ?? '0.0.0.0';

try {
  await server.listen({ port, host });
  server.log.info(`Data dir:   ${DATA_DIR}`);
  server.log.info(`Config dir: ${CONFIG_DIR}`);
  if (publicDir) server.log.info(`Serving UI: ${PUBLIC_DIR}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
