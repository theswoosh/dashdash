import type { WidgetHandler, HandlerContext } from '../types.js';
import { runHealthcheck } from './check.js';

export const healthcheckHandler: WidgetHandler = {
  async fetchData(options: Record<string, unknown>, _ctx: HandlerContext): Promise<unknown> {
    return runHealthcheck({
      url: (options['url'] as string | undefined) ?? '',
      port: options['port'] as number | undefined,
      ignoreTls: options['ignoreTls'] === true,
      timeoutMs: options['timeoutMs'] as number | undefined,
    });
  },
};
