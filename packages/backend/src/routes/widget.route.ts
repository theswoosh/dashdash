import type { FastifyPluginAsync } from 'fastify';
import type { Service } from '../config/schemas.js';
import { loadIntegrations, resolveCredentials } from '../config/integrations.js';
import { getHandler, isClientOnly } from '../widgets/registry.js';

interface WidgetRouteOptions {
  getServices: () => Service[];
  configDir: string;
}

export const createWidgetRoutes = (opts: WidgetRouteOptions): FastifyPluginAsync =>
  async (fastify) => {
    fastify.get<{ Params: { serviceId: string } }>(
      '/widget/:serviceId/data',
      async (request, reply) => {
        const { serviceId } = request.params;

        // Find the service in config
        const services = opts.getServices();
        const service = services.find(s => s.id === serviceId);

        if (!service) {
          return reply.code(404).send({ ok: false, error: `Service '${serviceId}' not found` });
        }

        const { widget: widgetId, integration: integrationId, options = {} } = service;

        // Client-only widgets have no server handler
        if (isClientOnly(widgetId)) {
          return reply.code(400).send({
            ok: false,
            error: `Widget '${widgetId}' is client-only and has no server data`,
          });
        }

        const handler = getHandler(widgetId);
        if (!handler) {
          return reply.code(404).send({
            ok: false,
            error: `No handler registered for widget type '${widgetId}'`,
          });
        }

        // Resolve integration if referenced
        let resolvedIntegration: import('../widgets/types.js').ResolvedIntegration | undefined;
        if (integrationId) {
          const integrations = loadIntegrations(opts.configDir);
          const integration = integrations.find(i => i.id === integrationId);
          if (integration) {
            resolvedIntegration = {
              id: integration.id,
              type: integration.type,
              credentials: resolveCredentials(integration.id),
              options: integration.options ?? {},
            };
          }
        }

        try {
          const widgetPayload = await handler.fetchData(options, { integration: resolvedIntegration });
          return { ok: true, data: widgetPayload };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          request.log.error({ err, serviceId, widgetId }, 'Widget handler failed');
          return reply.code(502).send({ ok: false, error: message });
        }
      }
    );
  };
