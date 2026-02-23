import type { FastifyPluginAsync } from 'fastify';
import { runHealthcheck } from '../widgets/healthcheck/check.js';

interface TestBody {
  url: string;
  port?: number;
  timeoutMs?: number;
}

export const healthcheckTestRoutes: FastifyPluginAsync = async fastify => {
  fastify.post<{ Body: TestBody }>(
    '/healthcheck/test',
    {
      schema: {
        body: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string' },
            port: { type: 'number' },
            timeoutMs: { type: 'number' },
          },
        },
      },
    },
    async req => {
      return runHealthcheck({
        url: req.body.url,
        port: req.body.port,
        // Cap test timeout at 3s so the UI doesn't wait too long.
        timeoutMs: Math.min(req.body.timeoutMs ?? 3000, 3000),
      });
    }
  );
};
