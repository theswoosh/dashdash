/**
 * Generates packages/frontend/src/components/service-icons.data.ts
 * from a curated list of self-hosted app slugs in simple-icons.
 *
 * Run: node packages/frontend/scripts/gen-service-icons.mjs
 */

import * as si from 'simple-icons';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dir, '../src/components/service-icons.data.ts');

// ── Curated list: [slug, category, ...extra keywords] ─────────────────────
const CURATED = [
  // Media servers
  ['plex',          'media',   'media server', 'stream'],
  ['jellyfin',      'media',   'media server', 'stream'],
  ['emby',          'media',   'media server'],
  ['kodi',          'media',   'media center'],
  ['navidrome',     'media',   'music server'],
  ['airsonic',      'media',   'music server'],
  // Arr / media management
  ['sonarr',        'media',   'tv shows', 'arr'],
  ['radarr',        'media',   'movies', 'arr'],
  ['lidarr',        'media',   'music', 'arr'],
  ['readarr',       'media',   'books', 'arr'],
  ['prowlarr',      'media',   'indexer', 'arr'],
  ['overseerr',     'media',   'requests'],
  // Photos & files
  ['immich',        'storage', 'photos', 'gallery'],
  ['nextcloud',     'storage', 'files', 'cloud'],
  ['syncthing',     'storage', 'sync', 'files'],
  ['seafile',       'storage', 'files', 'sync'],
  ['filebrowser',   'storage', 'files'],
  ['minio',         'storage', 's3', 'object storage'],
  // Notes & documents
  ['joplin',        'productivity', 'notes'],
  ['obsidian',      'productivity', 'notes', 'markdown'],
  ['standardnotes', 'productivity', 'notes', 'encrypted', 'standard notes'],
  ['bookstack',     'productivity', 'wiki', 'docs'],
  ['paperlessngx',  'productivity', 'documents', 'ocr'],
  // Passwords & secrets
  ['bitwarden',     'security', 'passwords', 'vault'],
  ['keepassxc',     'security', 'passwords'],
  // Home automation
  ['homeassistant', 'home',    'smart home', 'iot', 'automation'],
  // Network & DNS
  ['pihole',        'network', 'dns', 'adblock'],
  ['adguard',       'network', 'dns', 'adblock'],
  ['nginx',         'network', 'proxy', 'web server'],
  ['nginxproxymanager', 'network', 'proxy', 'nginx'],
  ['traefikproxy',  'network', 'proxy', 'reverse proxy', 'traefik'],
  ['caddy',         'network', 'proxy', 'web server'],
  ['haproxy',       'network', 'proxy', 'load balancer'],
  ['wireguard',     'network', 'vpn'],
  ['openvpn',       'network', 'vpn'],
  ['cloudflare',    'network', 'dns', 'cdn'],
  ['unifi',         'network', 'ubiquiti', 'wifi'],
  // Containers & infra
  ['portainer',     'infra',   'docker', 'containers'],
  ['docker',        'infra',   'containers'],
  ['kubernetes',    'infra',   'k8s', 'orchestration'],
  ['ansible',       'infra',   'automation'],
  ['terraform',     'infra',   'iac'],
  ['proxmox',       'infra',   'virtualization', 'vm'],
  ['opnsense',      'infra',   'firewall', 'router'],
  ['pfsense',       'infra',   'firewall', 'router'],
  // Monitoring & observability
  ['grafana',       'monitoring', 'dashboards', 'metrics'],
  ['prometheus',    'monitoring', 'metrics', 'alerting'],
  ['influxdb',      'monitoring', 'metrics', 'time series'],
  ['netdata',       'monitoring', 'metrics', 'realtime'],
  ['zabbix',        'monitoring', 'alerts'],
  ['uptimekuma',    'monitoring', 'uptime', 'status'],
  ['statuspage',    'monitoring', 'status', 'uptime'],
  // Databases
  ['postgresql',    'databases', 'postgres', 'sql'],
  ['mariadb',       'databases', 'mysql', 'sql'],
  ['mysql',         'databases', 'sql'],
  ['redis',         'databases', 'cache', 'key-value'],
  ['mongodb',       'databases', 'nosql'],
  ['elasticsearch', 'databases', 'search', 'nosql'],
  ['sqlite',        'databases', 'sql', 'embedded'],
  // Git & CI/CD
  ['gitea',         'dev', 'git', 'code'],
  ['gitlab',        'dev', 'git', 'ci', 'code'],
  ['github',        'dev', 'git', 'code'],
  ['jenkins',       'dev', 'ci', 'automation'],
  ['drone',         'dev', 'ci', 'automation'],
  ['woodpeckercifer', 'dev', 'ci', 'automation'],
  // Download managers
  ['qbittorrent',   'download', 'torrent', 'bittorrent'],
  ['transmission',  'download', 'torrent', 'bittorrent'],
  ['deluge',        'download', 'torrent'],
  ['sabnzbd',       'download', 'usenet', 'nzb'],
  ['nzbget',        'download', 'usenet', 'nzb'],
  // RSS & news
  ['freshrss',      'productivity', 'rss', 'news'],
  ['miniflux',      'productivity', 'rss', 'news'],
  // Other common services
  ['calibreweb',    'media',   'books', 'ebooks', 'calibre'],
  ['changedetectionio', 'monitoring', 'change detection'],
  ['diun',          'monitoring', 'docker updates'],
  ['watchtower',    'infra',   'docker', 'updates'],
  ['authentik',     'security', 'sso', 'auth', 'identity'],
  ['keycloak',      'security', 'sso', 'auth', 'identity'],
  ['authelia',      'security', 'sso', 'auth', '2fa'],
  ['vaultwarden',   'security', 'passwords', 'bitwarden'],
];

// ── Helper: slug → simple-icons export name ────────────────────────────────

function slugToExportName(slug) {
  // simple-icons export convention: "si" + PascalCase(slug)
  // e.g. "plex" → "siPlex", "home-assistant" → "siHomeassistant"
  const normalized = slug.replace(/-/g, '').replace(/_/g, '');
  return 'si' + normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

// ── Build entries ──────────────────────────────────────────────────────────
// The FULL simple-icons set is emitted (live issue #3.1 — the curated-only
// library was too small). Curated entries keep their category + keywords and
// sort first; everything else lands in 'other', findable via search only
// (the picker renders curated + recents by default and caps search results).

const curatedBySlug = new Map();
const notFound = [];
for (const [slug, category, ...keywords] of CURATED) {
  const key = slugToExportName(slug);
  const icon = si[key];
  if (!icon) {
    notFound.push(`${slug} (tried: ${key})`);
    continue;
  }
  curatedBySlug.set(icon.slug, { category, keywords });
}

const entries = [];
for (const icon of Object.values(si)) {
  if (!icon || typeof icon !== 'object' || !icon.slug || !icon.path) continue;
  const curated = curatedBySlug.get(icon.slug);
  entries.push({
    slug: icon.slug,
    title: icon.title,
    hex: icon.hex,
    path: icon.path,
    category: curated?.category ?? 'other',
    keywords: curated?.keywords ?? [],
  });
}

// Curated first (they populate the picker's default view), then alphabetical.
entries.sort((a, b) => {
  const aCur = curatedBySlug.has(a.slug) ? 0 : 1;
  const bCur = curatedBySlug.has(b.slug) ? 0 : 1;
  return aCur - bCur || a.title.localeCompare(b.title);
});

if (notFound.length > 0) {
  console.warn('⚠ Not found in simple-icons:', notFound.join(', '));
}

// ── Emit TypeScript ────────────────────────────────────────────────────────

const ts = `// AUTO-GENERATED — do not edit manually.
// Regenerate with: node packages/frontend/scripts/gen-service-icons.mjs

export interface ServiceIcon {
  slug: string;
  title: string;
  /** Brand hex color without '#' */
  hex: string;
  /** SVG path data (viewBox 0 0 24 24) */
  path: string;
  category: string;
  keywords: string[];
}

export const SERVICE_ICONS: ServiceIcon[] = ${JSON.stringify(entries, null, 2)};
`;

writeFileSync(OUT, ts, 'utf-8');
console.log(`✓ Wrote ${entries.length} icons to ${OUT}`);
