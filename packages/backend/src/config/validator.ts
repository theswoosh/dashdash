import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { loadIntegrations } from './integrations.js';
import { loadWidgetTemplates } from './widgetTemplates.js';

export interface ConfigIssue {
  file: string;
  field: string;
  level: 'error' | 'warning';
  message: string;
}

const KNOWN_WIDGET_TYPES = ['clock', 'healthcheck', 'stats', 'bookmarks', 'search', 'notepad', 'iframe', 'frame'];

function readYaml(filePath: string): unknown {
  if (!existsSync(filePath)) return null;
  return yaml.load(readFileSync(filePath, 'utf8'), { schema: yaml.CORE_SCHEMA });
}

function formatPath(prefix: string, ...parts: (string | number)[]): string {
  let result = prefix;
  for (const part of parts) {
    if (typeof part === 'number') result += `[${part}]`;
    else result += result ? `.${part}` : part;
  }
  return result;
}

function checkString(issues: ConfigIssue[], file: string, field: string, value: unknown, opts: { maxLength?: number; pattern?: RegExp; patternMsg?: string; required?: boolean }): boolean {
  if (value === undefined || value === null) {
    if (opts.required) issues.push({ file, field, level: 'error', message: 'Required field is missing' });
    return false;
  }
  if (typeof value !== 'string') {
    issues.push({ file, field, level: 'error', message: `Expected string, got ${typeof value}` });
    return false;
  }
  if (opts.maxLength !== undefined && value.length > opts.maxLength) {
    issues.push({ file, field, level: 'error', message: `Too long (max ${opts.maxLength} chars, got ${value.length})` });
  }
  if (opts.pattern && !opts.pattern.test(value)) {
    issues.push({ file, field, level: 'error', message: opts.patternMsg ?? `Does not match required pattern` });
  }
  return true;
}

function checkNumber(issues: ConfigIssue[], file: string, field: string, value: unknown, opts: { min?: number; max?: number; integer?: boolean }): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'number') {
    issues.push({ file, field, level: 'error', message: `Expected number, got ${typeof value}` });
    return;
  }
  if (opts.integer && !Number.isInteger(value)) {
    issues.push({ file, field, level: 'error', message: 'Must be an integer' });
  }
  if (opts.min !== undefined && value < opts.min) {
    issues.push({ file, field, level: 'error', message: `Too small (min ${opts.min}, got ${value})` });
  }
  if (opts.max !== undefined && value > opts.max) {
    issues.push({ file, field, level: 'error', message: `Too large (max ${opts.max}, got ${value})` });
  }
}

function validateSettingsYaml(raw: unknown, issues: ConfigIssue[], gridColumns: number): void {
  const file = 'settings.yml';
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    issues.push({ file, field: '(root)', level: 'error', message: 'settings.yml must be a YAML mapping' });
    return;
  }
  const data = raw as Record<string, unknown>;

  checkString(issues, file, 'title', data['title'], { maxLength: 128 });
  checkString(issues, file, 'theme', data['theme'], { maxLength: 64 });
  checkString(issues, file, 'timezone', data['timezone'], { maxLength: 64 });
  checkString(issues, file, 'language', data['language'], { maxLength: 16 });

  if (data['grid'] && typeof data['grid'] === 'object' && !Array.isArray(data['grid'])) {
    const grid = data['grid'] as Record<string, unknown>;
    checkNumber(issues, file, 'grid.cellSize', grid['cellSize'], { integer: true, min: 1, max: 100 });
    checkNumber(issues, file, 'grid.gap', grid['gap'], { integer: true, min: 0, max: 100 });
    if (grid['sizes'] !== undefined) {
      if (!Array.isArray(grid['sizes'])) {
        issues.push({ file, field: 'grid.sizes', level: 'error', message: 'Must be a list of numbers (1–100)' });
      } else {
        grid['sizes'].forEach((s, i) => checkNumber(issues, file, `grid.sizes[${i}]`, s, { integer: true, min: 1, max: 100 }));
      }
    }
  }

  if (data['background'] && typeof data['background'] === 'object' && !Array.isArray(data['background'])) {
    const bg = data['background'] as Record<string, unknown>;
    const validTypes = ['image', 'gradient', 'color', 'unsplash', 'video'];
    if (bg['type'] !== undefined && !validTypes.includes(String(bg['type']))) {
      issues.push({ file, field: 'background.type', level: 'error', message: `Invalid type "${String(bg['type'])}" — must be one of: ${validTypes.join(', ')}` });
    }
    checkNumber(issues, file, 'background.blur', bg['blur'], { min: 0, max: 100 });
    checkString(issues, file, 'background.url', bg['url'], { maxLength: 2048 });
    checkString(issues, file, 'background.value', bg['value'], { maxLength: 2048 });
    checkString(issues, file, 'background.overlay', bg['overlay'], { maxLength: 256 });
  }

  if (data['mail'] && typeof data['mail'] === 'object' && !Array.isArray(data['mail'])) {
    const mail = data['mail'] as Record<string, unknown>;
    checkString(issues, file, 'mail.from', mail['from'], { maxLength: 320 });
    if (mail['smtp'] && typeof mail['smtp'] === 'object' && !Array.isArray(mail['smtp'])) {
      const smtp = mail['smtp'] as Record<string, unknown>;
      checkString(issues, file, 'mail.smtp.host', smtp['host'], { maxLength: 253 });
      checkNumber(issues, file, 'mail.smtp.port', smtp['port'], { integer: true, min: 1, max: 65535 });
    }
  }

  checkNumber(issues, file, 'holdToDeleteMs', data['holdToDeleteMs'], { integer: true, min: 1, max: 30000 });

  if (Array.isArray(data['searchEngines'])) {
    for (let i = 0; i < data['searchEngines'].length; i++) {
      const engine = data['searchEngines'][i];
      if (!engine || typeof engine !== 'object' || Array.isArray(engine)) {
        issues.push({ file, field: `searchEngines[${i}]`, level: 'error', message: 'Each search engine must be a mapping' });
        continue;
      }
      const e = engine as Record<string, unknown>;
      const base = `searchEngines[${i}]`;
      checkString(issues, file, formatPath(base, 'id'), e['id'], { required: true, maxLength: 64, pattern: /^[a-z0-9-]+$/, patternMsg: 'ID must be lowercase letters, digits and hyphens only' });
      checkString(issues, file, formatPath(base, 'label'), e['label'], { required: true, maxLength: 64 });
      const hasUrl = checkString(issues, file, formatPath(base, 'url'), e['url'], { required: true, maxLength: 2048 });
      if (hasUrl && typeof e['url'] === 'string' && !e['url'].includes('{query}')) {
        issues.push({ file, field: formatPath(base, 'url'), level: 'warning', message: 'URL does not contain {query} placeholder — searches will not work' });
      }
      checkString(issues, file, formatPath(base, 'placeholder'), e['placeholder'], { maxLength: 128 });
    }
  }

  // Check for cross-widget layout bounds
  if (Array.isArray(data['searchEngines']) && typeof gridColumns === 'number') {
    // gridColumns is validated above; used for service layout cross-checks
  }
}

function entryPrefix(index: number, id: string | undefined): string {
  return id ? `Entry #${index + 1} ("${id}")` : `Entry #${index + 1}`;
}

function validateServicesYaml(raw: unknown, issues: ConfigIssue[], integrationIds: Set<string>, knownWidgetTypes: Set<string>, gridColumns: number): void {
  const file = 'services.yml';
  if (!Array.isArray(raw)) {
    if (raw != null) {
      issues.push({ file, field: '(root)', level: 'error', message: 'services.yml must be a YAML sequence (list)' });
    }
    return;
  }

  const validateEntry = (
    svc: Record<string, unknown>,
    base: string,
    prefix: string,
    parentIsFrame: boolean
  ) => {
    // Collect issues into a local list so we can rewrite messages with the entry prefix
    const entryIssues: ConfigIssue[] = [];

    checkString(entryIssues, file, formatPath(base, 'title'), svc['title'], { required: true, maxLength: 128 });
    checkString(entryIssues, file, formatPath(base, 'id'), svc['id'], { maxLength: 128 });
    checkString(entryIssues, file, formatPath(base, 'icon'), svc['icon'], { maxLength: 128 });
    checkString(entryIssues, file, formatPath(base, 'widget'), svc['widget'], { required: true, maxLength: 64 });

    // Warn if widget type is unknown
    if (typeof svc['widget'] === 'string' && !knownWidgetTypes.has(svc['widget'])) {
      entryIssues.push({ file, field: formatPath(base, 'widget'), level: 'warning', message: `Unknown widget type "${svc['widget']}"` });
    }

    const widgetType = typeof svc['widget'] === 'string' ? svc['widget'] : undefined;
    const hasChildren = svc['children'] !== undefined && svc['children'] !== null;
    if (hasChildren && widgetType !== 'frame') {
      entryIssues.push({ file, field: formatPath(base, 'children'), level: 'error', message: 'children is only allowed for widget: frame' });
    }
    if (widgetType === 'frame' && parentIsFrame) {
      entryIssues.push({ file, field: formatPath(base, 'widget'), level: 'error', message: 'nested frame widgets are not allowed' });
    }

    // Warn if integration ref doesn't exist
    if (typeof svc['integration'] === 'string') {
      checkString(entryIssues, file, formatPath(base, 'integration'), svc['integration'], { maxLength: 128 });
      if (!integrationIds.has(svc['integration'])) {
        entryIssues.push({ file, field: formatPath(base, 'integration'), level: 'warning', message: `Integration "${svc['integration']}" not found in integrations.yml` });
      }
    }

    if (svc['layout'] && typeof svc['layout'] === 'object' && !Array.isArray(svc['layout'])) {
      const layout = svc['layout'] as Record<string, unknown>;
      checkNumber(entryIssues, file, formatPath(base, 'layout.w'), layout['w'], { integer: true, min: 1, max: 48 });
      checkNumber(entryIssues, file, formatPath(base, 'layout.h'), layout['h'], { integer: true, min: 1, max: 48 });
      checkNumber(entryIssues, file, formatPath(base, 'layout.x'), layout['x'], { integer: true, min: 0, max: 200 });
      checkNumber(entryIssues, file, formatPath(base, 'layout.y'), layout['y'], { integer: true, min: 0, max: 200 });

      // Warn if widget is wider than the grid
      if (typeof layout['w'] === 'number' && layout['w'] > gridColumns) {
        entryIssues.push({ file, field: formatPath(base, 'layout.w'), level: 'warning', message: `Widget width (${layout['w']}) exceeds grid columns (${gridColumns})` });
      }
    } else if (svc['layout'] === undefined || svc['layout'] === null) {
      entryIssues.push({ file, field: formatPath(base, 'layout'), level: 'error', message: 'Required field is missing' });
    }

    // Rewrite messages to include human-readable entry prefix
    for (const issue of entryIssues) {
      const fieldName = issue.field.replace(/^\[\d+\]\.?/, '');
      const readable = fieldName
        ? `${prefix}: field "${fieldName}" — ${issue.message.charAt(0).toLowerCase()}${issue.message.slice(1)}`
        : `${prefix}: ${issue.message}`;
      issues.push({ ...issue, message: readable });
    }

    // Recurse into children if present
    if (svc['children'] !== undefined) {
      if (!Array.isArray(svc['children'])) {
        issues.push({ file, field: formatPath(base, 'children'), level: 'error', message: `${prefix}: field "children" — must be a list` });
        return;
      }
      const children = svc['children'] as unknown[];
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (!child || typeof child !== 'object' || Array.isArray(child)) {
          issues.push({ file, field: formatPath(base, 'children', i), level: 'error', message: `${prefix} > child #${i + 1}: must be a mapping` });
          continue;
        }
        const c = child as Record<string, unknown>;
        const childId = typeof c['id'] === 'string' ? c['id'] : undefined;
        const childPrefix = `${prefix} > child #${i + 1}${childId ? ` ("${childId}")` : ''}`;
        const childBase = formatPath(base, 'children', i);
        validateEntry(c, childBase, childPrefix, widgetType === 'frame');
      }
    }
  };

  for (let i = 0; i < raw.length; i++) {
    const svc = raw[i];
    if (!svc || typeof svc !== 'object' || Array.isArray(svc)) {
      issues.push({ file, field: `[${i}]`, level: 'error', message: `${entryPrefix(i, undefined)}: must be a mapping` });
      continue;
    }
    const s = svc as Record<string, unknown>;
    const base = `[${i}]`;
    const entryId = typeof s['id'] === 'string' ? s['id'] : undefined;
    const prefix = entryPrefix(i, entryId);
    validateEntry(s, base, prefix, false);
  }
}

function validateIntegrationsYaml(raw: unknown, issues: ConfigIssue[]): void {
  const file = 'integrations.yml';
  if (!Array.isArray(raw)) {
    if (raw != null) {
      issues.push({ file, field: '(root)', level: 'error', message: 'integrations.yml must be a YAML sequence (list)' });
    }
    return;
  }

  for (let i = 0; i < raw.length; i++) {
    const integ = raw[i];
    if (!integ || typeof integ !== 'object' || Array.isArray(integ)) {
      issues.push({ file, field: `[${i}]`, level: 'error', message: 'Each integration must be a mapping' });
      continue;
    }
    const it = integ as Record<string, unknown>;
    const base = `[${i}]`;

    checkString(issues, file, formatPath(base, 'id'), it['id'], { required: true, maxLength: 128 });
    checkString(issues, file, formatPath(base, 'type'), it['type'], { required: true, maxLength: 64 });

    if (it['url'] !== undefined && it['url'] !== null) {
      const hasUrl = checkString(issues, file, formatPath(base, 'url'), it['url'], { maxLength: 2048 });
      if (hasUrl && typeof it['url'] === 'string' && !/^https?:\/\//i.test(it['url'])) {
        issues.push({ file, field: formatPath(base, 'url'), level: 'warning', message: 'URL should start with http:// or https://' });
      }
    }
  }
}

function validateWidgetsYaml(raw: unknown, issues: ConfigIssue[], knownWidgetTypes: Set<string>): void {
  const file = 'widgets.yml';
  if (!Array.isArray(raw)) {
    if (raw != null) {
      issues.push({ file, field: '(root)', level: 'error', message: 'widgets.yml must be a YAML sequence (list)' });
    }
    return;
  }

  for (let i = 0; i < raw.length; i++) {
    const tmpl = raw[i];
    if (!tmpl || typeof tmpl !== 'object' || Array.isArray(tmpl)) {
      issues.push({ file, field: `[${i}]`, level: 'error', message: 'Each widget template must be a mapping' });
      continue;
    }
    const t = tmpl as Record<string, unknown>;
    const base = `[${i}]`;

    checkString(issues, file, formatPath(base, 'type'), t['type'], { required: true, maxLength: 64 });

    if (typeof t['type'] === 'string' && !knownWidgetTypes.has(t['type'])) {
      issues.push({ file, field: formatPath(base, 'type'), level: 'warning', message: `Unknown widget type "${t['type']}"` });
    }

    for (const sizeField of ['defaultSize', 'minSize']) {
      if (t[sizeField] && typeof t[sizeField] === 'object' && !Array.isArray(t[sizeField])) {
        const sz = t[sizeField] as Record<string, unknown>;
        checkNumber(issues, file, formatPath(base, `${sizeField}.w`), sz['w'], { integer: true, min: 1, max: 48 });
        checkNumber(issues, file, formatPath(base, `${sizeField}.h`), sz['h'], { integer: true, min: 1, max: 48 });
      }
    }
  }
}

export function validateConfig(configDir: string): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  // Build context for cross-file checks
  const integrations = loadIntegrations(configDir);
  const integrationIds = new Set(integrations.map(i => i.id));

  const widgetTemplates = loadWidgetTemplates(configDir);
  const knownWidgetTypes = new Set([...KNOWN_WIDGET_TYPES, ...widgetTemplates.map(t => t.type)]);

  // Column count is derived per-screen (fill-to-width), so there is no fixed
  // column bound for layout-width checks — a high value disables that warning.
  const gridColumns = 1000;

  // Parse and validate each config file
  const files: Array<{ name: string; validate: (raw: unknown) => void }> = [
    {
      name: 'settings.yml',
      validate: (raw) => validateSettingsYaml(raw, issues, gridColumns),
    },
    {
      name: 'services.yml',
      validate: (raw) => validateServicesYaml(raw, issues, integrationIds, knownWidgetTypes, gridColumns),
    },
    {
      name: 'integrations.yml',
      validate: (raw) => validateIntegrationsYaml(raw, issues),
    },
    {
      name: 'widgets.yml',
      validate: (raw) => validateWidgetsYaml(raw, issues, knownWidgetTypes),
    },
  ];

  for (const { name, validate } of files) {
    const filePath = join(configDir, name);
    if (!existsSync(filePath)) continue;

    let raw: unknown;
    try {
      raw = readYaml(filePath);
    } catch (err) {
      issues.push({
        file: name,
        field: '(yaml)',
        level: 'error',
        message: `YAML parse error: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    validate(raw);
  }

  // Sort: errors first, then by file name
  issues.sort((a, b) => {
    if (a.level !== b.level) return a.level === 'error' ? -1 : 1;
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.field.localeCompare(b.field);
  });

  return issues;
}
