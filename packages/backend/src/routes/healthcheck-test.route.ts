import type { FastifyPluginAsync } from 'fastify';
import type { Settings } from '../config/schemas.js';
import { runHealthcheck } from '../widgets/healthcheck/check.js';

const MAX_TEST_TIMEOUT_MS = 3000;

interface TestBody {
  url: string;
  port?: number;
  timeoutMs?: number;
}

interface HealthcheckTestRouteOptions {
  getSettings: () => Settings;
}

export const createHealthcheckTestRoutes = (opts: HealthcheckTestRouteOptions): FastifyPluginAsync =>
  async fastify => {
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
        // Same private-network policy as the widget batch path — the Test
        // button must never disagree with what the widget will actually do.
        const { allowPrivateNetworks } = opts.getSettings();
        return runHealthcheck({
          url: req.body.url,
          port: req.body.port,
          // Cap test timeout so the UI doesn't wait too long.
          timeoutMs: Math.min(req.body.timeoutMs ?? MAX_TEST_TIMEOUT_MS, MAX_TEST_TIMEOUT_MS),
          allowPrivateNetworks,
        });
      }
    );
  };
