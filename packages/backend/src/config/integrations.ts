import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { IntegrationsSchema } from './schemas.js';
import type { Integration } from './schemas.js';

interface Logger { warn: (msg: string, ...args: unknown[]) => void }

function readYaml(filePath: string, logger: Logger): unknown {
  if (!existsSync(filePath)) return null;
  try {
    return yaml.load(readFileSync(filePath, 'utf8'), { schema: yaml.CORE_SCHEMA });
  } catch (err) {
    logger.warn(`Failed to parse ${filePath}:`, err);
    return null;
  }
}

export function loadIntegrations(configDir: string, logger: Logger = console): Integration[] {
  const raw = readYaml(join(configDir, 'integrations.yml'), logger);
  if (raw === null) return [];
  const parseResult = IntegrationsSchema.safeParse(raw);
  if (!parseResult.success) {
    logger.warn('integrations.yml validation errors:', parseResult.error.format());
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
