import type { FastifyPluginAsync } from 'fastify';
import type { Service, Settings } from '../config/schemas.js';
import { runHealthcheck, type CheckResult } from '../widgets/healthcheck/check.js';

const MAX_BATCH_SIZE = 100;

interface HealthcheckBatchRouteOptions {
  getServices: () => Service[];
  getSettings: () => Settings;
}

export const createHealthcheckBatchRoutes = (opts: HealthcheckBatchRouteOptions): FastifyPluginAsync =>
  async (fastify) => {
    fastify.get<{ Querystring: { ids?: string } }>(
      '/healthcheck/batch',
      async (request, reply) => {
        const idsParam = request.query.ids ?? '';
        const requestedIds = idsParam
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .slice(0, MAX_BATCH_SIZE);

        if (requestedIds.length === 0) {
          return reply.code(400).send({ ok: false, error: 'No ids provided' });
        }

        const services = opts.getServices();
        const { allowPrivateNetworks } = opts.getSettings();

        const entries = await Promise.all(
          requestedIds.map(async (id): Promise<[string, CheckResult]> => {
            const service = services.find(s => s.id === id);
            if (!service || service.widget !== 'healthcheck') {
              return [id, { status: 'down', error: 'not found', latencyMs: 0 }];
            }
            if (service.options?.['ping'] === false) {
              return [id, { status: 'up', latencyMs: 0 }];
            }
            try {
              const result = await runHealthcheck({
                url: (service.options?.['url'] as string | undefined) ?? '',
                port: service.options?.['port'] as number | undefined,
                timeoutMs: service.options?.['timeoutMs'] as number | undefined,
                allowPrivateNetworks,
              });
              return [id, result];
            } catch (err) {
              const message = err instanceof Error ? err.message : 'check failed';
              request.log.error({ err, serviceId: id }, 'Healthcheck batch item failed');
              return [id, { status: 'down', error: message, latencyMs: 0 }];
            }
          })
        );

        return { results: Object.fromEntries(entries) };
      }
    );
  };
