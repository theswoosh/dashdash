import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { IntegrationsSchema } from './schemas.js';
import type { Integration } from './schemas.js';

function readYaml(filePath: string): unknown {
  if (!existsSync(filePath)) return null;
  try {
    return yaml.load(readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.warn(`Failed to parse ${filePath}:`, err);
    return null;
  }
}

export function loadIntegrations(configDir: string): Integration[] {
  const raw = readYaml(join(configDir, 'integrations.yml'));
  if (raw === null) return [];
  const parseResult = IntegrationsSchema.safeParse(raw);
  if (!parseResult.success) {
    console.warn('integrations.yml validation errors:', parseResult.error.format());
    return [];
  }
  return parseResult.data;
}

/**
 * Resolve credentials for an integration from environment variables.
 * Convention: DASHDASH_INTEGRATION_{ID_UPPER}_{FIELD} → credentials.field
 * e.g. DASHDASH_INTEGRATION_MYROUTER_PASSWORD → credentials.password
 */
export function resolveCredentials(id: string): Record<string, string> {
  const prefix = `DASHDASH_INTEGRATION_${id.toUpperCase().replace(/-/g, '_')}_`;
  const credentials: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && value !== undefined) {
      const field = key.slice(prefix.length).toLowerCase();
      credentials[field] = value;
    }
  }
  return credentials;
}
