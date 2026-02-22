import { z } from 'zod';

export const ServiceLayoutSchema = z.object({
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  x: z.number().int().nonnegative().default(0),
  y: z.number().int().nonnegative().default(0),
});

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

export type Services = z.infer<typeof ServicesSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Service = z.infer<typeof ServiceSchema>;
