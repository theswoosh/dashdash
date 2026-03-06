import type { FastifyPluginAsync } from 'fastify';
import { validateConfig, type ConfigIssue } from '../config/validator.js';

export function createConfigValidateRoutes(configDir: string): FastifyPluginAsync {
  return async fastify => {
    fastify.get('/config/validate', async (request, reply) => {
      if (request.userRole !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }
      const issues: ConfigIssue[] = validateConfig(configDir);
      return reply.send({ issues });
    });
  };
}
