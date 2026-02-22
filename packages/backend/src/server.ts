import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';

const isDev = process.env['NODE_ENV'] !== 'production';

const server = Fastify({
  logger: isDev
    ? {
        level: 'info',
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }
    : { level: 'warn' },
});

// CORS — dev only, Vite dev server runs on :3000
await server.register(cors, {
  origin: isDev ? 'http://localhost:3000' : false,
  credentials: true,
});

// Routes
await server.register(healthRoutes, { prefix: '/api' });

// Graceful shutdown
const shutdown = async (signal: string) => {
  server.log.info(`${signal} received, shutting down`);
  await server.close();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start
const port = Number(process.env['PORT'] ?? 4000);
const host = process.env['HOST'] ?? '0.0.0.0';

try {
  await server.listen({ port, host });
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
