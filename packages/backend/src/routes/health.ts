import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async fastify => {
  fastify.get('/health', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      version: '0.0.1',
      timestamp: new Date().toISOString(),
    });
  });
};
