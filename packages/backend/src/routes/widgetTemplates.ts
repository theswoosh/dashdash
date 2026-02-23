import type { FastifyPluginAsync } from 'fastify';
import { loadWidgetTemplates } from '../config/widgetTemplates.js';

export function createWidgetTemplatesRoutes(configDir: string): FastifyPluginAsync {
  return async fastify => {
    fastify.get('/widget-templates', async () => {
      return loadWidgetTemplates(configDir);
    });
  };
}
