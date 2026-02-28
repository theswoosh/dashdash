import type { FastifyPluginAsync } from 'fastify';
import { loadLocales } from '../config/locales.js';

export function createLocalesRoutes(configDir: string): FastifyPluginAsync {
  return async fastify => {
    // GET /api/locales — public (no auth required, see PUBLIC_PATHS in auth.middleware.ts)
    fastify.get('/locales', async () => {
      const translations = loadLocales(configDir);
      return {
        languages: Object.keys(translations),
        translations,
      };
    });
  };
}
