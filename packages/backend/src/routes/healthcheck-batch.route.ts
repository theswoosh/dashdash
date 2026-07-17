import type { FastifyPluginAsync } from 'fastify';
import type { Service, Settings } from '../config/schemas.js';
import { runHealthcheckSwr, type CheckResult } from '../widgets/healthcheck/check.js';
import { flattenServices } from '../config/loader.js';

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

        const services = flattenServices(opts.getServices());
        const { allowPrivateNetworks } = opts.getSettings();

        // Non-blocking: answers from cache (stale allowed) or 'pending' while a
        // background probe runs — the response never waits on the slowest host.
        const entries = requestedIds.map((id): [string, CheckResult] => {
          const service = services.find(s => s.id === id);
          if (!service || service.widget !== 'healthcheck') {
            return [id, { status: 'down', error: 'not found', reason: 'invalid-host', latencyMs: 0 }];
          }
          if (service.options?.['ping'] === false) {
            return [id, { status: 'up', latencyMs: 0 }];
          }
          try {
            const result = runHealthcheckSwr({
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
        });

        return { results: Object.fromEntries(entries) };
      }
    );
  };
