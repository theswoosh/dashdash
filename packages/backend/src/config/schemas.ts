import { z } from 'zod';

export const ServiceLayoutSchema = z.object({
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  x: z.number().int().nonnegative().default(0),
  y: z.number().int().nonnegative().default(0),
});

/** Schema used when reading from YAML — id is optional, auto-assigned if absent. */
export const RawServiceSchema = z.object({
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

export const ServiceSchema = z.object({
  id: z.string(),
  title: z.string(),
  icon: z.string().optional(),
  integration: z.string().optional(),
  widget: z.string(),
  layout: ServiceLayoutSchema,
  options: z.record(z.unknown()).optional(),
});

export const ServicesSchema = z.array(ServiceSchema);

export const GridSchema = z.object({
  columns: z.number().int().positive().default(12),
  rowHeight: z.number().int().positive().default(80),
  gap: z.number().int().nonnegative().default(12),
});

export const BackgroundSchema = z.object({
  type: z.enum(['image', 'gradient', 'color', 'unsplash', 'video']).default('color'),
  url: z.string().optional(),
  value: z.string().optional(),
  blur: z.number().nonnegative().default(0),
  overlay: z.string().optional(),
  parallax: z.boolean().default(false),
});

export const SettingsSchema = z.object({
  title: z.string().default('dashdash'),
  theme: z.enum(['dark', 'light']).default('dark'),
  background: BackgroundSchema.optional(),
  grid: GridSchema.default({}),
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
export type Integration = z.infer<typeof IntegrationSchema>;
export type Integrations = z.infer<typeof IntegrationsSchema>;
