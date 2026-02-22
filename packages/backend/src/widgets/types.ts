export interface ResolvedIntegration {
  id: string;
  type: string;
  credentials: Record<string, string>;
  options: Record<string, unknown>;
}

export interface HandlerContext {
  integration: ResolvedIntegration | undefined;
}

export interface WidgetHandler {
  fetchData(options: Record<string, unknown>, ctx: HandlerContext): Promise<unknown>;
}
