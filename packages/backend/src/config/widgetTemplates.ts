import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';
import { MAX_LAYOUT_SIZE_UNITS } from './schemas.js';

const SizeSchema = z.object({
  w: z.number().int().positive().max(MAX_LAYOUT_SIZE_UNITS),
  h: z.number().int().positive().max(MAX_LAYOUT_SIZE_UNITS),
});

const WidgetTemplateSchema = z.object({
  type: z.string().max(64),
  defaultSize: SizeSchema,
});

const WidgetTemplatesSchema = z.array(WidgetTemplateSchema);

type WidgetTemplateDef = z.infer<typeof WidgetTemplateSchema>;

export function loadWidgetTemplates(configDir: string): WidgetTemplateDef[] {
  const filePath = join(configDir, 'widgets.yml');
  if (!existsSync(filePath)) return [];
  const raw = yaml.load(readFileSync(filePath, 'utf8'), { schema: yaml.CORE_SCHEMA });
  const result = WidgetTemplatesSchema.safeParse(raw);
  return result.success ? result.data : [];
}
