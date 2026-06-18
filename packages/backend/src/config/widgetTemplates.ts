import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
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
  // Partial per-type option defaults (e.g. bg_color, layoutSize) applied when a
  // new widget of this type is dropped. Merged over the catalog defaults.
  defaultOptions: z.record(z.string(), z.unknown()).optional(),
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

export interface WidgetTemplatePatch {
  defaultSize?: { w: number; h: number };
  defaultOptions?: Record<string, unknown>;
}

/**
 * Upsert a single widget type's template defaults in widgets.yml. Creates the
 * entry if the type is missing; preserves the order of existing entries. Writes
 * atomically (temp file + rename) so a partial write can never corrupt the file.
 */
export function upsertWidgetTemplate(
  configDir: string,
  type: string,
  patch: WidgetTemplatePatch,
): void {
  const filePath = join(configDir, 'widgets.yml');
  const templates = loadWidgetTemplates(configDir);

  const existing = templates.find(t => t.type === type);
  const target = existing ?? { type, defaultSize: { w: 1, h: 1 } };
  if (!existing) templates.push(target);

  if (patch.defaultSize) target.defaultSize = patch.defaultSize;

  if (patch.defaultOptions !== undefined) {
    const cleaned = Object.fromEntries(
      Object.entries(patch.defaultOptions).filter(([, v]) => v !== undefined && v !== null),
    );
    if (Object.keys(cleaned).length > 0) target.defaultOptions = cleaned;
    else delete target.defaultOptions;
  }

  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, yaml.dump(templates, { indent: 2, lineWidth: -1, schema: yaml.CORE_SCHEMA }));
  renameSync(tmpPath, filePath);
}
