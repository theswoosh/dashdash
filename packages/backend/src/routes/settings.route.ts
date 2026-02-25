import type { FastifyPluginAsync } from 'fastify';
import type { Settings } from '../config/schemas.js';

export function createSettingsRoutes(getSettings: () => Settings): FastifyPluginAsync {
  return async fastify => {
    fastify.get('/settings', async () => getSettings());
  };
}
