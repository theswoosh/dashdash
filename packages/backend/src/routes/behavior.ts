import type { FastifyPluginAsync } from 'fastify';
import type { Behavior } from '../config/schemas.js';

export function createBehaviorRoutes(getBehavior: () => Behavior): FastifyPluginAsync {
  return async fastify => {
    fastify.get('/behavior', async () => getBehavior());
  };
}
