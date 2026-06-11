import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { FastifyPluginAsync } from 'fastify';

// Single source of truth for the app version: the backend package.json.
// dev:  src/routes → ../../package.json = packages/backend/package.json
// prod: dist/routes → ../../package.json = /app/package.json (pnpm deploy bundle)
const PACKAGE_JSON_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

const APP_VERSION = readPackageVersion();

export const healthRoutes: FastifyPluginAsync = async fastify => {
  fastify.get('/health', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    });
  });
};
