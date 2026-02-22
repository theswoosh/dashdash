import type { FastifyPluginAsync } from 'fastify';
import type { Service } from '../config/schemas.js';
import { patchService, appendService, removeService } from '../config/writer.js';
import { suppressNextBroadcast } from '../config/watcher.js';

interface PatchBody {
  title?: string;
  options?: Record<string, unknown>;
  layout?: { x: number; y: number; w: number; h: number };
}

export function createServicesRoutes(
  getServices: () => Service[],
  configDir: string
): FastifyPluginAsync {
  return async fastify => {
    // GET /api/services
    fastify.get('/services', async () => ({ services: getServices() }));

    // POST /api/services — append a new service to services.yml
    fastify.post<{ Body: Service }>(
      '/services',
      {
        schema: {
          body: {
            type: 'object',
            required: ['id', 'title', 'widget', 'layout'],
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              widget: { type: 'string' },
              layout: { type: 'object' },
              options: { type: 'object' },
              _userCreated: { type: 'boolean' },
            },
          },
        },
      },
      async (req, reply) => {
        try {
          suppressNextBroadcast();
          appendService(configDir, req.body);
          return { ok: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return reply.code(409).send({ error: message });
        }
      }
    );

    // PATCH /api/services/:id — update layout, options, or title in services.yml
    fastify.patch<{ Params: { id: string }; Body: PatchBody }>(
      '/services/:id',
      {
        schema: {
          params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
          body: { type: 'object' },
        },
      },
      async (req, reply) => {
        try {
          suppressNextBroadcast();
          patchService(configDir, req.params.id, req.body);
          return { ok: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return reply.code(404).send({ error: message });
        }
      }
    );

    // DELETE /api/services/:id — remove a service from services.yml
    fastify.delete<{ Params: { id: string } }>(
      '/services/:id',
      {
        schema: {
          params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        },
      },
      async (req, reply) => {
        try {
          suppressNextBroadcast();
          removeService(configDir, req.params.id);
          return { ok: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return reply.code(404).send({ error: message });
        }
      }
    );
  };
}
