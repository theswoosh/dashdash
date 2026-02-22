import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocketPlugin from '@fastify/websocket';
import type { WebSocket } from 'ws';
import { createDb, type Db } from './db/index.js';
import { loadServices, loadSettings } from './config/loader.js';
import { addWsClient, removeWsClient } from './config/watcher.js';
import { healthRoutes } from './routes/health.js';
import { createLayoutRoutes } from './routes/layout.js';
import { createServicesRoutes } from './routes/services.js';
import { createSettingsRoutes } from './routes/settings.js';

export interface AppOptions {
  dataDir: string;
  configDir: string;
  logger?: boolean | undefined;
}

export async function buildApp({ dataDir, configDir, logger = false }: AppOptions): Promise<{ server: ReturnType<typeof Fastify>; db: Db }> {
  const isDev = process.env['NODE_ENV'] !== 'production';

  const server = Fastify({
    logger: logger
      ? isDev
        ? { level: 'info', transport: { target: 'pino-pretty', options: { colorize: true } } }
        : { level: 'warn' }
      : false,
  });

  await server.register(cors, {
    origin: isDev ? 'http://localhost:3000' : false,
    credentials: true,
  });

  await server.register(websocketPlugin);

  const db = createDb(dataDir);
  const getServices = () => loadServices(configDir);
  const getSettings = () => loadSettings(configDir);

  await server.register(healthRoutes, { prefix: '/api' });
  await server.register(createLayoutRoutes(db), { prefix: '/api' });
  await server.register(createServicesRoutes(getServices), { prefix: '/api' });
  await server.register(createSettingsRoutes(getSettings), { prefix: '/api' });

  server.get('/api/ws', { websocket: true }, (socket: WebSocket) => {
    addWsClient(socket);
    socket.on('close', () => removeWsClient(socket));
    socket.on('error', () => removeWsClient(socket));
  });

  return { server, db };
}
