import type { FastifyPluginAsync } from 'fastify';

export function createBehaviorRoutes(getBehavior: () => { holdToDeleteMs: number }): FastifyPluginAsync {
  return async fastify => {
    fastify.get('/behavior', async () => getBehavior());
  };
}
