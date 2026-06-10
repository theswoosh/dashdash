import { z } from 'zod';

const ServiceLayoutSchema = z.object({
  w: z.number().int().positive().max(48),
  h: z.number().int().positive().max(48),
  x: z.number().int().nonnegative().max(200).default(0),
  y: z.number().int().nonnegative().max(200).default(0),
});

/** Schema used when reading from YAML — id is optional, auto-assigned if absent. */
const RawServiceSchemaBase = z.object({
  id: z.string().max(128).optional(),
  title: z.string().max(128),
  icon: z.string().max(128).optional(),
  integration: z.string().max(128).optional(),
  widget: z.string().max(64),
  layout: ServiceLayoutSchema,
  options: z.record(z.string(), z.unknown()).optional(),
});

type RawService = z.infer<typeof RawServiceSchemaBase> & { children?: RawService[] | undefined };

const RawServiceSchema: z.ZodType<RawService> = z.lazy(() =>
  RawServiceSchemaBase.extend({
    children: z.array(RawServiceSchema).optional(),
  }).superRefine((value, ctx) => {
    if (value.children && value.widget !== 'frame') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['children'],
        message: 'children is only allowed for widget: frame',
      });
    }
    if (value.children && value.children.some(child => child.widget === 'frame')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['children'],
        message: 'nested frame widgets are not allowed',
      });
    }
  })
);

export const RawServicesSchema = z.array(RawServiceSchema);

/** Assigns stable readable IDs to services that don't have one. */
export function assignIds(
  services: RawService[]
): Service[] {
  const usedIds = new Set<string>();

  const reserveId = (id: string) => { usedIds.add(id); };
  const gather = (items: RawService[]) => {
    for (const item of items) {
      if (item.id) reserveId(item.id);
      if (item.children && item.children.length > 0) gather(item.children);
    }
  };
  gather(services);

  const ensureId = (item: RawService): Service => {
    let id = item.id;
    if (!id) {
      const base = item.widget;
      let suffix = 2;
      id = base;
      while (usedIds.has(id)) { id = `${base}-${suffix++}`; }
      reserveId(id);
    }

    const children = item.children?.map(child => ensureId(child));
    return { ...(item as Service), id, ...(children ? { children } : {}) };
  };

  return services.map(s => ensureId(s));
}

export interface Service {
  id: string;
  title: string;
  icon?: string | undefined;
  integration?: string | undefined;
  widget: string;
  layout: { w: number; h: number; x: number; y: number };
  options?: Record<string, unknown> | undefined;
  children?: Service[] | undefined;
}

export const ServiceSchema: z.ZodType<Service> = z.object({
  id: z.string().max(128),
  title: z.string().max(128),
  icon: z.string().max(128).optional(),
  integration: z.string().max(128).optional(),
  widget: z.string().max(64),
  layout: ServiceLayoutSchema,
  options: z.record(z.string(), z.unknown()).optional(),
  children: z.array(z.lazy(() => ServiceSchema)).optional(),
}).superRefine((value, ctx) => {
  if (value.children && value.widget !== 'frame') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['children'],
      message: 'children is only allowed for widget: frame',
    });
  }
  if (value.children && value.children.some(child => child.widget === 'frame')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['children'],
      message: 'nested frame widgets are not allowed',
    });
  }
});


// Square-cell grid. `sizes` are the slider stops (each value = N for an N×N cell);
// `cellSize` is the active stop. Column count is derived to fill the viewport.
const GRID_SIZE_STOPS = [10, 20, 40, 60, 80];

const GridSchema = z.object({
  sizes: z.array(z.number().int().min(1).max(100)).min(1).default(GRID_SIZE_STOPS).catch(GRID_SIZE_STOPS),
  cellSize: z.number().int().min(1).max(100).default(40).catch(40),
  gap: z.number().int().nonnegative().max(100).default(4).catch(4),
});

// Body schema for the admin grid write — just the active (square) cell size.
export const GridUpdateSchema = z.object({
  cellSize: z.number().int().min(1).max(100),
});

const BackgroundSchema = z.object({
  type: z.enum(['image', 'gradient', 'color', 'unsplash', 'video']).default('color').catch('color'),
  url: z.string().max(2048).optional(),
  value: z.string().max(2048).optional(),
  blur: z.number().nonnegative().max(100).default(0).catch(0),
  overlay: z.string().max(256).optional(),
  parallax: z.boolean().default(false),
});

const AuthSessionSchema = z.object({
  maxAgeSeconds: z.number().int().nonnegative().default(604800),
  slidingWindow: z.boolean().default(true),
}).default({ maxAgeSeconds: 604800, slidingWindow: true });

const AuthRegistrationSchema = z.object({
  enabled: z.boolean().default(true),
}).default({ enabled: true });

const AuthConfigSchema = z.object({
  registration: AuthRegistrationSchema,
  session: AuthSessionSchema,
  local: z.object({
    enabled: z.boolean().default(true),
  }).default({ enabled: true }),
}).default({ registration: { enabled: true }, session: { maxAgeSeconds: 604800, slidingWindow: true }, local: { enabled: true } });

export interface OidcConfig {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  groupsClaim: string;
  adminGroup: string;
  autoLink: boolean;
}

const MailConfigSchema = z.object({
  smtp: z.object({
    host: z.string().max(253).default(''),
    port: z.number().int().min(1).max(65535).default(587).catch(587),
    secure: z.boolean().default(false),
  }).default({ host: '', port: 587, secure: false }),
  from: z.string().max(320).default(''),
}).default({ smtp: { host: '', port: 587, secure: false }, from: '' });

export const SearchEngineSchema = z.object({
  id: z.string().max(64).regex(/^[a-z0-9-]+$/, 'ID must be lowercase letters, digits and hyphens only'),
  label: z.string().max(64),
  url: z.string().max(2048),
  placeholder: z.string().max(128).optional(),
});

export const SearchEnginesSchema = z.array(SearchEngineSchema);

export const SettingsSchema = z.object({
  title: z.string().max(128).default('dashdash'),
  timezone: z.string().max(64).optional(),
  theme: z.string().max(64).default('dark').catch('dark'),
  language: z.string().max(16).optional(),
  background: BackgroundSchema.optional(),
  grid: GridSchema.default({ sizes: [10, 20, 40, 60, 80], cellSize: 40, gap: 4 }),
  auth: AuthConfigSchema,
  mail: MailConfigSchema,
  searchEngines: SearchEnginesSchema.default([]),
  holdToDeleteMs: z.number().int().positive().max(30000).default(1000).catch(1000),
  allowPrivateNetworks: z.boolean().default(false),
});

export const IntegrationSchema = z.object({
  id: z.string().max(128),
  type: z.string().max(64),
  url: z.string().max(2048).optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

export const IntegrationsSchema = z.array(IntegrationSchema);

export type Services = Service[];
export type Settings = z.infer<typeof SettingsSchema>;
export type SearchEngine = z.infer<typeof SearchEngineSchema>;
export type Integration = z.infer<typeof IntegrationSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type MailConfig = z.infer<typeof MailConfigSchema>;
