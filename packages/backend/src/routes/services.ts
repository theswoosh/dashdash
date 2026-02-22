import type { FastifyPluginAsync } from 'fastify';
import type { Service } from '../config/schemas.js';

export function createServicesRoutes(getServices: () => Service[]): FastifyPluginAsync {
  return async fastify => {
    fastify.get('/services', async () => ({ services: getServices() }));
  };
}
