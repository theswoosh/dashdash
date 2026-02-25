import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import websocketPlugin from '@fastify/websocket';
import type { WebSocket } from 'ws';
import { createDb, type Db } from './db/index.js';
import { loadServices, loadSettings, loadBehavior } from './config/loader.js';
import { addWsClient, removeWsClient } from './config/watcher.js';
import { healthRoutes } from './routes/health.route.js';
import { createServicesRoutes } from './routes/services.route.js';
import { createSettingsRoutes } from './routes/settings.route.js';
import { createBehaviorRoutes } from './routes/behavior.route.js';
import { createWidgetRoutes } from './routes/widget.route.js';
import { createNotepadRoutes } from './routes/notepad.route.js';
import { createPreferencesRoutes } from './routes/preferences.route.js';
import { createWidgetTemplatesRoutes } from './routes/widget-templates.route.js';
import { healthcheckTestRoutes } from './routes/healthcheck-test.route.js';
import { createBoardRoutes } from './routes/boards.route.js';

export interface AppOptions {
  dataDir: string;
  configDir: string;
  /** When provided, the backend serves the frontend SPA from this directory. */
  publicDir?: string | undefined;
  logger?: boolean | undefined;
}

export async function buildApp({ dataDir, configDir, publicDir, logger = false }: AppOptions): Promise<{ server: ReturnType<typeof Fastify>; db: Db }> {
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

  await server.register(multipart);
  await server.register(websocketPlugin);

  const db = createDb(dataDir);
  const log = server.log;
  const getSettings = () => loadSettings(configDir, log);
  const getBehavior = () => loadBehavior(configDir, log);
  // YAML is the single source of truth for all services
  const getServices = () => loadServices(configDir, log);

  await server.register(healthRoutes, { prefix: '/api' });
  await server.register(createServicesRoutes(getServices, configDir), { prefix: '/api' });
  await server.register(createSettingsRoutes(getSettings), { prefix: '/api' });
  await server.register(createBehaviorRoutes(getBehavior), { prefix: '/api' });
  await server.register(createWidgetRoutes({ getServices, configDir }), { prefix: '/api' });
  await server.register(createNotepadRoutes(db), { prefix: '/api' });
  await server.register(createPreferencesRoutes(db), { prefix: '/api' });
  await server.register(createWidgetTemplatesRoutes(configDir), { prefix: '/api' });
  await server.register(healthcheckTestRoutes, { prefix: '/api' });
  await server.register(createBoardRoutes(db, configDir), { prefix: '/api' });

  server.get('/api/ws', { websocket: true }, (socket: WebSocket) => {
    addWsClient(socket);
    socket.on('close', () => removeWsClient(socket));
    socket.on('error', () => removeWsClient(socket));
  });

  // Serve the frontend SPA in production (publicDir is set when ./public exists).
  if (publicDir && existsSync(publicDir)) {
    const indexHtml = readFileSync(join(publicDir, 'index.html'), 'utf8');

    await server.register(fastifyStatic, {
      root: publicDir,
      prefix: '/',
      // Don't intercept 404s — we handle them below so /api 404s return JSON.
      wildcard: false,
    });

    // SPA catch-all: any route not matched by API handlers → index.html.
    server.setNotFoundHandler((_req, reply) => {
      void reply.type('text/html').send(indexHtml);
    });
  }

  return { server, db };
}
