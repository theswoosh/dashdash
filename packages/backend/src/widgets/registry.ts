import type { WidgetHandler } from './types.js';
import { healthcheckHandler } from './healthcheck/handler.js';
import { statsHandler } from './stats/handler.js';

const HANDLERS = new Map<string, WidgetHandler>([
  ['healthcheck', healthcheckHandler],
  ['stats', statsHandler],
]);

/** Returns the handler for a widget type, or undefined if it's client-only or unknown. */
export function getHandler(widgetId: string): WidgetHandler | undefined {
  return HANDLERS.get(widgetId);
}

/** Returns true if the widget type is known (either server-side or client-only). */
const CLIENT_ONLY_WIDGETS = new Set(['clock', 'bookmarks', 'search', 'iframe', 'fallback']);

export function isClientOnly(widgetId: string): boolean {
  return CLIENT_ONLY_WIDGETS.has(widgetId);
}
