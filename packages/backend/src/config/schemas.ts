import { z } from 'zod';

const ServiceLayoutSchema = z.object({
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  x: z.number().int().nonnegative().default(0),
  y: z.number().int().nonnegative().default(0),
});

/** Schema used when reading from YAML — id is optional, auto-assigned if absent. */
const RawServiceSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  icon: z.string().optional(),
  integration: z.string().optional(),
  widget: z.string(),
  layout: ServiceLayoutSchema,
  options: z.record(z.unknown()).optional(),
});

export const RawServicesSchema = z.array(RawServiceSchema);

/** Assigns stable readable IDs to services that don't have one. */
export function assignIds(
  services: Array<z.infer<typeof RawServiceSchema>>
): Service[] {
  const usedIds = new Set(services.filter(s => s.id).map(s => s.id!));
  return services.map(s => {
    if (s.id) return s as Service;
    let id = s.widget;
    let suffix = 2;
    while (usedIds.has(id)) { id = `${s.widget}-${suffix++}`; }
    usedIds.add(id);
    return { ...s, id };
  });
}

const ServiceSchema = z.object({
  id: z.string(),
  title: z.string(),
  icon: z.string().optional(),
  integration: z.string().optional(),
  widget: z.string(),
  layout: ServiceLayoutSchema,
  options: z.record(z.unknown()).optional(),
});

const ServicesSchema = z.array(ServiceSchema);

const GridSchema = z.object({
  columns: z.number().int().positive().default(12),
  rowHeight: z.number().int().positive().default(80),
  gap: z.number().int().nonnegative().default(12),
});

const BackgroundSchema = z.object({
  type: z.enum(['image', 'gradient', 'color', 'unsplash', 'video']).default('color'),
  url: z.string().optional(),
  value: z.string().optional(),
  blur: z.number().nonnegative().default(0),
  overlay: z.string().optional(),
  parallax: z.boolean().default(false),
});

const AuthSessionSchema = z.object({
  maxAgeSeconds: z.number().int().nonnegative().default(604800),
  slidingWindow: z.boolean().default(true),
}).default({});

const AuthRegistrationSchema = z.object({
  enabled: z.boolean().default(true),
}).default({});

const AuthConfigSchema = z.object({
  registration: AuthRegistrationSchema,
  session: AuthSessionSchema,
  oidc: z.object({
    enabled: z.boolean().default(false),
    issuer: z.string().default(''),
    clientId: z.string().default(''),
    scopes: z.string().default('openid profile email'),
    groupsClaim: z.string().default(''),
    adminGroup: z.string().default(''),
    autoLink: z.boolean().default(true),
  }).default({}),
  local: z.object({
    enabled: z.boolean().default(true),
  }).default({}),
}).default({});

const MailConfigSchema = z.object({
  smtp: z.object({
    host: z.string().default(''),
    port: z.number().int().default(587),
    secure: z.boolean().default(false),
  }).default({}),
  from: z.string().default(''),
}).default({});

export const SearchEngineSchema = z.object({
  id: z.string(),
  label: z.string(),
  url: z.string(),
  placeholder: z.string().optional(),
});

export const SearchEnginesSchema = z.array(SearchEngineSchema);

export const SettingsSchema = z.object({
  title: z.string().default('dashdash'),
  timezone: z.string().optional(),
  theme: z.enum(['dark', 'light']).default('dark'),
  language: z.string().optional(),
  background: BackgroundSchema.optional(),
  grid: GridSchema.default({}),
  auth: AuthConfigSchema,
  mail: MailConfigSchema,
  searchEngines: SearchEnginesSchema.default([]),
});

export const BehaviorSchema = z.object({
  holdToDeleteMs: z.number().int().positive().default(1000),
});

export const IntegrationSchema = z.object({
  id: z.string(),
  type: z.string(),
  url: z.string().optional(),
  options: z.record(z.unknown()).optional(),
});

export const IntegrationsSchema = z.array(IntegrationSchema);

export type Behavior = z.infer<typeof BehaviorSchema>;
export type Services = z.infer<typeof ServicesSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type SearchEngine = z.infer<typeof SearchEngineSchema>;
export type Integration = z.infer<typeof IntegrationSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type MailConfig = z.infer<typeof MailConfigSchema>;
