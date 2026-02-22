import type { FastifyPluginAsync } from 'fastify';
import type { Services } from '../config/schemas.js';

export function createServicesRoutes(getServices: () => Services): FastifyPluginAsync {
  return async fastify => {
    fastify.get('/services', async () => ({ services: getServices() }));
  };
}
