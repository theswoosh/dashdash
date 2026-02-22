import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { buildApp } from './app.js';
import { startWatcher } from './config/watcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// src/ → backend/ → packages/ → repo root
const repoRoot = resolve(__dirname, '../../..');

const DATA_DIR = resolve(repoRoot, process.env['DATA_DIR'] ?? 'data');
const CONFIG_DIR = resolve(repoRoot, process.env['CONFIG_DIR'] ?? 'config');

const { server, db } = await buildApp({ dataDir: DATA_DIR, configDir: CONFIG_DIR, logger: true });

startWatcher(CONFIG_DIR);
server.log.info(`Watching config dir: ${CONFIG_DIR}`);

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
