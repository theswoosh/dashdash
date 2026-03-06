import type { FastifyPluginAsync } from 'fastify';
import type { Service } from '../config/schemas.js';
import type { Db } from '../db/index.js';
import { patchService, appendService, removeService, batchPatchLayouts } from '../config/writer.js';
import { suppressNextBroadcast } from '../config/watcher.js';

interface PatchBody {
  title?: string;
  options?: Record<string, unknown>;
  layout?: { x: number; y: number; w: number; h: number };
}

export function createServicesRoutes(
  getServices: () => Service[],
  configDir: string,
  db: Db
): FastifyPluginAsync {
  return async fastify => {
    const deleteNotepadContent = db.prepare<[string]>(`DELETE FROM notepad WHERE service_id = ?`);
    // GET /api/services
    fastify.get('/services', async () => ({ services: getServices() }));

    // PUT /api/services/layouts — batch update all service layouts in one YAML write
    fastify.put<{ Body: { items: Array<{ id: string; layout: { x: number; y: number; w: number; h: number } }> } }>(
      '/services/layouts',
      {
        schema: {
          body: {
            type: 'object',
            required: ['items'],
            properties: {
              items: { type: 'array' },
            },
          },
        },
      },
      async (req, reply) => {
        try {
          suppressNextBroadcast();
          batchPatchLayouts(configDir, req.body.items);
          return { ok: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return reply.code(500).send({ error: message });
        }
      }
    );

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
          deleteNotepadContent.run(req.params.id);
          return { ok: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return reply.code(404).send({ error: message });
        }
      }
    );
  };
}
