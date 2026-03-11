import type { WidgetHandler, HandlerContext } from '../types.js';
import { runHealthcheck } from './check.js';

export const healthcheckHandler: WidgetHandler = {
  async fetchData(options: Record<string, unknown>, ctx: HandlerContext): Promise<unknown> {
    if (options['ping'] === false) return null;
    return runHealthcheck({
      url: (options['url'] as string | undefined) ?? '',
      port: options['port'] as number | undefined,
      timeoutMs: options['timeoutMs'] as number | undefined,
      allowPrivateNetworks: ctx.allowPrivateNetworks,
    });
  },
};
