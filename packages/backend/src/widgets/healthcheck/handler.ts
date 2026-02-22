import type { WidgetHandler, HandlerContext } from '../types.js';

export const healthcheckHandler: WidgetHandler = {
  async fetchData(options: Record<string, unknown>, _ctx: HandlerContext): Promise<unknown> {
    const url = options['url'] as string | undefined;
    if (!url) {
      return { status: 'down', error: 'No url configured' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const start = Date.now();

    try {
      const res = await fetch(url, { signal: controller.signal });
      const latencyMs = Date.now() - start;
      return {
        status: res.ok ? 'up' : 'down',
        statusCode: res.status,
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      return {
        status: 'down',
        error: isTimeout ? 'timeout' : 'unreachable',
        latencyMs,
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};
