import type { FastifyPluginAsync } from 'fastify';
import { loadWidgetTemplates, upsertWidgetTemplate, type WidgetTemplatePatch } from '../config/widgetTemplates.js';
import { suppressNextBroadcast } from '../config/watcher.js';
import { MAX_LAYOUT_SIZE_UNITS } from '../config/schemas.js';

interface PatchBody {
  defaultSize?: { w: number; h: number };
  defaultOptions?: Record<string, unknown>;
}

function isValidSize(size: { w: number; h: number }): boolean {
  const inRange = (n: number) =>
    Number.isInteger(n) && n >= 1 && n <= MAX_LAYOUT_SIZE_UNITS;
  return inRange(size.w) && inRange(size.h);
}

export function createWidgetTemplatesRoutes(configDir: string): FastifyPluginAsync {
  return async fastify => {
    fastify.get('/widget-templates', async () => {
      return loadWidgetTemplates(configDir);
    });

    // PATCH /api/widget-templates/:type — edit a widget type's template defaults
    // (default size + default options) stored in widgets.yml. Upserts the entry.
    fastify.patch<{ Params: { type: string }; Body: PatchBody }>(
      '/widget-templates/:type',
      {
        schema: {
          body: {
            type: 'object',
            properties: {
              defaultSize: {
                type: 'object',
                required: ['w', 'h'],
                properties: { w: { type: 'number' }, h: { type: 'number' } },
              },
              defaultOptions: { type: 'object' },
            },
          },
        },
      },
      async (req, reply) => {
        const { defaultSize, defaultOptions } = req.body;

        if (defaultSize && !isValidSize(defaultSize)) {
          return reply.code(400).send({
            error: `defaultSize.w/h must be integers between 1 and ${MAX_LAYOUT_SIZE_UNITS}`,
          });
        }

        const patch: WidgetTemplatePatch = {};
        if (defaultSize) patch.defaultSize = defaultSize;
        if (defaultOptions !== undefined) patch.defaultOptions = defaultOptions;

        try {
          suppressNextBroadcast();
          upsertWidgetTemplate(configDir, req.params.type, patch);
          return { ok: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return reply.code(500).send({ error: message });
        }
      }
    );
  };
}
