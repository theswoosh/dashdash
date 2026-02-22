import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocketPlugin from '@fastify/websocket';
import type { WebSocket } from 'ws';

import { createDb } from './db/index.js';
import { loadServices, loadSettings } from './config/loader.js';
import { startWatcher, addWsClient, removeWsClient } from './config/watcher.js';
import { healthRoutes } from './routes/health.js';
import { createLayoutRoutes } from './routes/layout.js';
import { createServicesRoutes } from './routes/services.js';
import { createSettingsRoutes } from './routes/settings.js';

// ── Resolve paths ─────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
// src/ → backend/ → packages/ → repo root
const repoRoot = resolve(__dirname, '../../..');

const DATA_DIR = resolve(repoRoot, process.env['DATA_DIR'] ?? 'data');
const CONFIG_DIR = resolve(repoRoot, process.env['CONFIG_DIR'] ?? 'config');

// ── Server ────────────────────────────────────────────────────────────────────
const isDev = process.env['NODE_ENV'] !== 'production';

const server = Fastify({
  logger: isDev
    ? { level: 'info', transport: { target: 'pino-pretty', options: { colorize: true } } }
    : { level: 'warn' },
});

// CORS
await server.register(cors, {
  origin: isDev ? 'http://localhost:3000' : false,
  credentials: true,
});

// WebSocket
await server.register(websocketPlugin);

// ── DB + Config ───────────────────────────────────────────────────────────────
const db = createDb(DATA_DIR);

// Config is reloaded from disk on every request so edits take effect immediately.
// (chokidar + WS notifies the frontend; frontend revalidates SWR which hits these.)
const getServices = () => loadServices(CONFIG_DIR);
const getSettings = () => loadSettings(CONFIG_DIR);

// ── Routes ────────────────────────────────────────────────────────────────────
await server.register(healthRoutes, { prefix: '/api' });
await server.register(createLayoutRoutes(db), { prefix: '/api' });
await server.register(createServicesRoutes(getServices), { prefix: '/api' });
await server.register(createSettingsRoutes(getSettings), { prefix: '/api' });

// WebSocket endpoint — clients connect here to receive config:reload pushes
server.get('/api/ws', { websocket: true }, (socket: WebSocket) => {
  addWsClient(socket);
  socket.on('close', () => removeWsClient(socket));
  socket.on('error', () => removeWsClient(socket));
});

// ── Config watcher ────────────────────────────────────────────────────────────
startWatcher(CONFIG_DIR);
server.log.info(`Watching config dir: ${CONFIG_DIR}`);

// ── Start ─────────────────────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
  server.log.info(`${signal} received, shutting down`);
  await server.close();
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
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
