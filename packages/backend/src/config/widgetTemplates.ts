import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';

const SizeSchema = z.object({
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

export const WidgetTemplateSchema = z.object({
  type: z.string(),
  defaultSize: SizeSchema,
  minSize: SizeSchema.optional(),
});

export const WidgetTemplatesSchema = z.array(WidgetTemplateSchema);

export type WidgetTemplateDef = z.infer<typeof WidgetTemplateSchema>;

export function loadWidgetTemplates(configDir: string): WidgetTemplateDef[] {
  const filePath = join(configDir, 'widgets.yml');
  if (!existsSync(filePath)) return [];
  const raw = yaml.load(readFileSync(filePath, 'utf8'), { schema: yaml.CORE_SCHEMA });
  const result = WidgetTemplatesSchema.safeParse(raw);
  return result.success ? result.data : [];
}
