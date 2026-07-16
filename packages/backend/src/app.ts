import { readFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import websocketPlugin from '@fastify/websocket';
import type { WebSocket } from 'ws';
import { createDb, type Db } from './db/index.js';
import { loadServices, loadSettings } from './config/loader.js';
import { addWsClient, removeWsClient } from './config/watcher.js';
import { healthRoutes, APP_VERSION } from './routes/health.route.js';
import { createServicesRoutes } from './routes/services.route.js';
import { createSettingsRoutes } from './routes/settings.route.js';
import { createBehaviorRoutes } from './routes/behavior.route.js';
import { createWidgetRoutes } from './routes/widget.route.js';
import { createNotepadRoutes } from './routes/notepad.route.js';
import { createPreferencesRoutes } from './routes/preferences.route.js';
import { createWidgetTemplatesRoutes } from './routes/widget-templates.route.js';
import { createHealthcheckTestRoutes } from './routes/healthcheck-test.route.js';
import { createBoardRoutes } from './routes/boards.route.js';
import { createAuthRoutes } from './routes/auth.route.js';
import type { OidcConfig } from './config/schemas.js';
import { createUsersRoutes } from './routes/users.route.js';
import { createLocalesRoutes } from './routes/locales.route.js';
import { createConfigValidateRoutes } from './routes/config-validate.route.js';
import { createHealthcheckBatchRoutes } from './routes/healthcheck-batch.route.js';
import { validateConfig } from './config/validator.js';
import { registerAuthMiddleware } from './middleware/auth.middleware.js';
import { cleanupExpiredSessions, validateSession } from './db/sessions.db.js';
import { cleanupExpiredOidcStates } from './db/oidc-state.db.js';
import { createChatRoutes } from './routes/chat.route.js';
import { createUpdateCheckRoutes } from './routes/update-check.route.js';
import { purgeExpiredChatMessages } from './db/chat.db.js';

export interface AppOptions {
  dataDir: string;
  configDir: string;
  /** When provided, the backend serves the frontend SPA from this directory. */
  publicDir?: string | undefined;
  logger?: boolean | undefined;
}

const SESSION_CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const COOKIE_NAME = 'dashdash_session';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Seed files live at src/../../seed/locales relative to this file in dev,
// or dist/../../seed/locales in prod — but in Docker we ship them inside the
// package, so resolve relative to this file regardless of env.
const SEED_LOCALES_DIR = join(__dirname, '..', 'seed', 'locales');

function seedLocales(configDir: string): void {
  const localesDir = join(configDir, 'locales');
  mkdirSync(localesDir, { recursive: true });

  if (!existsSync(SEED_LOCALES_DIR)) return;

  let seedFiles: string[];
  try {
    seedFiles = readdirSync(SEED_LOCALES_DIR).filter(f => f.endsWith('.yml'));
  } catch {
    return;
  }

  for (const file of seedFiles) {
    const dest = join(localesDir, file);
    if (!existsSync(dest)) {
      copyFileSync(join(SEED_LOCALES_DIR, file), dest);
    }
  }
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
    origin: isDev
      ? 'http://localhost:3000'
      : (process.env['BOARD_CORS_ORIGIN'] ?? false),
    credentials: true,
  });

  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        // http: too — the iframe widget embeds homelab services that are plain http on LAN
        frameSrc: ["'self'", 'https:', 'http:'],
        connectSrc: ["'self'", 'wss:', 'https://cdn.jsdelivr.net'],
      },
    },
  });

  await server.register(fastifyCookie);
  await server.register(multipart);
  await server.register(websocketPlugin);

  seedLocales(configDir);

  const db = createDb(dataDir);
  const log = server.log;
  const getSettings = () => loadSettings(configDir, log);
  const getBehavior = () => { const s = loadSettings(configDir, log); return { holdToDeleteMs: s.holdToDeleteMs }; };
  const getServices = () => loadServices(configDir, log);

  const settings = getSettings();
  const { auth: authConfig, mail: mailConfig } = settings;

  // Validate config files at startup and log any issues.
  const configIssues = validateConfig(configDir);
  for (const issue of configIssues) {
    if (issue.level === 'error') {
      log.error({ file: issue.file, field: issue.field }, `Config: ${issue.message}`);
    } else {
      log.warn({ file: issue.file, field: issue.field }, `Config: ${issue.message}`);
    }
  }
  if (configIssues.length > 0) {
    const errors = configIssues.filter(i => i.level === 'error').length;
    const warnings = configIssues.filter(i => i.level === 'warning').length;
    log.warn(`Config validation: ${errors} error(s), ${warnings} warning(s) — check the Validation tab in the admin panel`);
  }

  const oidcIssuer   = process.env['BOARD_OIDC_ISSUER']   ?? '';
  const oidcClientId = process.env['BOARD_OIDC_CLIENT_ID'] ?? '';
  const oidcSecret   = process.env['BOARD_OIDC_SECRET']   ?? '';
  const oidcConfig: OidcConfig = {
    enabled:      Boolean(oidcIssuer && oidcClientId && oidcSecret),
    issuer:       oidcIssuer,
    clientId:     oidcClientId,
    clientSecret: oidcSecret,
    scopes:       process.env['BOARD_OIDC_SCOPES']       ?? 'openid profile email',
    groupsClaim:  process.env['BOARD_OIDC_GROUPS_CLAIM'] ?? '',
    adminGroup:   process.env['BOARD_OIDC_ADMIN_GROUP']  ?? '',
    autoLink:     process.env['BOARD_OIDC_AUTO_LINK']    !== 'false',
    allowInsecureHttp: process.env['BOARD_OIDC_ALLOW_HTTP'] === 'true',
  };

  // Auth middleware runs before all route handlers.
  registerAuthMiddleware(server, db, authConfig.session.slidingWindow ? authConfig.session.maxAgeSeconds : 0);

  // Session + OIDC state cleanup scheduled every 15 minutes.
  const cleanupTimer = setInterval(() => {
    const deleted = cleanupExpiredSessions(db);
    if (deleted > 0) log.info({ deleted }, 'Cleaned up expired sessions');
    const oidcDeleted = cleanupExpiredOidcStates(db);
    if (oidcDeleted > 0) log.info({ deleted: oidcDeleted }, 'Cleaned up expired OIDC states');
    const chatPurged = purgeExpiredChatMessages(db);
    if (chatPurged > 0) log.info({ deleted: chatPurged }, 'Purged chat messages past retention');
    // SQLite's own recommendation for long-running connections: refreshes
    // query-planner statistics cheaply (no-op when nothing changed).
    db.pragma('optimize');
  }, SESSION_CLEANUP_INTERVAL_MS);
  // Don't keep process alive just for cleanup.
  cleanupTimer.unref();

  await server.register(healthRoutes, { prefix: '/api' });
  await server.register(createAuthRoutes(db, authConfig, mailConfig, oidcConfig), { prefix: '/api' });
  await server.register(createUsersRoutes(db, mailConfig), { prefix: '/api' });
  await server.register(createServicesRoutes(getServices, configDir, db), { prefix: '/api' });
  await server.register(createSettingsRoutes(getSettings, configDir), { prefix: '/api' });
  await server.register(createBehaviorRoutes(getBehavior), { prefix: '/api' });
  await server.register(createWidgetRoutes({ getServices, configDir, getSettings }), { prefix: '/api' });
  await server.register(createNotepadRoutes(db), { prefix: '/api' });
  await server.register(createChatRoutes(db), { prefix: '/api' });
  await server.register(createPreferencesRoutes(db), { prefix: '/api' });
  await server.register(createWidgetTemplatesRoutes(configDir), { prefix: '/api' });
  await server.register(createHealthcheckTestRoutes({ getSettings }), { prefix: '/api' });
  await server.register(createBoardRoutes(db, configDir), { prefix: '/api' });
  await server.register(createLocalesRoutes(configDir), { prefix: '/api' });
  await server.register(createConfigValidateRoutes(configDir), { prefix: '/api' });
  await server.register(createHealthcheckBatchRoutes({ getServices, getSettings }), { prefix: '/api' });
  await server.register(createUpdateCheckRoutes({ currentVersion: APP_VERSION }), { prefix: '/api' });

  server.get('/api/ws', { websocket: true }, (socket: WebSocket, request) => {
    const sessionId = request.cookies?.[COOKIE_NAME];
    if (!sessionId || !validateSession(db, sessionId)) {
      socket.close(4001, 'Unauthorized');
      return;
    }
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
      wildcard: false,
      index: false,                // '/' falls through to the SPA handler below
      preCompressed: true,         // serve .br/.gz siblings produced by the frontend build
      cacheControl: false,         // headers set per file class below
      setHeaders: (res, filePath) => {
        // Vite content-hashes everything under assets/ — safe to cache forever.
        // Anything else (index.html) must revalidate so deploys propagate.
        res.setHeader(
          'cache-control',
          filePath.includes('/assets/')
            ? 'public, max-age=31536000, immutable'
            : 'no-cache'
        );
      },
    });

    server.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api')) {
        void reply.code(404).send({ error: 'Not Found', path: req.url });
        return;
      }
      void reply.header('cache-control', 'no-cache').type('text/html').send(indexHtml);
    });
  }

  return { server, db };
}
