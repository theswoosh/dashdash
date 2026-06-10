import type { FastifyPluginAsync } from 'fastify';
import { SearchEngineSchema, GridUpdateSchema } from '../config/schemas.js';
import type { Settings } from '../config/schemas.js';
import { writeSearchEngines, writeGrid } from '../config/writer.js';

export function createSettingsRoutes(getSettings: () => Settings, configDir: string): FastifyPluginAsync {
  return async fastify => {
    fastify.get('/settings', async () => {
      const settings = getSettings();
      return {
        title: settings.title,
        timezone: settings.timezone,
        language: settings.language,
        searchEngines: settings.searchEngines,
        grid: settings.grid,
      };
    });

    fastify.put('/settings/grid', async (request, reply) => {
      if (request.userRole !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }
      const parse = GridUpdateSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.code(400).send({ error: parse.error.issues[0]?.message ?? 'Invalid input' });
      }
      writeGrid(configDir, parse.data);
      return reply.send({ ok: true });
    });

    fastify.post('/settings/search-engines', async (request, reply) => {
      if (request.userRole !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }
      const parse = SearchEngineSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.code(400).send({ error: parse.error.issues[0]?.message ?? 'Invalid input' });
      }
      const engine = parse.data;
      const current = getSettings().searchEngines;
      if (current.some(e => e.id === engine.id)) {
        return reply.code(409).send({ error: `Engine id '${engine.id}' already exists` });
      }
      writeSearchEngines(configDir, [...current, engine]);
      return reply.send({ ok: true });
    });

    fastify.put('/settings/search-engines/:id', async (request, reply) => {
      if (request.userRole !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }
      const { id } = request.params as { id: string };
      const parse = SearchEngineSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.code(400).send({ error: parse.error.issues[0]?.message ?? 'Invalid input' });
      }
      const engine = parse.data;
      const current = getSettings().searchEngines;
      const idx = current.findIndex(e => e.id === id);
      if (idx === -1) {
        return reply.code(404).send({ error: `Engine '${id}' not found` });
      }
      // If the id is being changed, ensure the new id doesn't already exist
      if (engine.id !== id && current.some(e => e.id === engine.id)) {
        return reply.code(409).send({ error: `Engine id '${engine.id}' already exists` });
      }
      const updated = current.map((e, i) => (i === idx ? engine : e));
      writeSearchEngines(configDir, updated);
      return reply.send({ ok: true });
    });

    fastify.delete('/settings/search-engines/:id', async (request, reply) => {
      if (request.userRole !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }
      const { id } = request.params as { id: string };
      const current = getSettings().searchEngines;
      const filtered = current.filter(e => e.id !== id);
      if (filtered.length === current.length) {
        return reply.code(404).send({ error: `Engine '${id}' not found` });
      }
      writeSearchEngines(configDir, filtered);
      return reply.send({ ok: true });
    });
  };
}
