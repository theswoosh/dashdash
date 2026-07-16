import type { FastifyPluginAsync } from 'fastify';

const GITHUB_REPO = 'theswoosh/dashdash';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — releases aren't time-sensitive

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string | null; // null when no token configured or fetch failed
  updateAvailable: boolean;
  releaseUrl: string | null;
}

interface GithubRelease {
  tag_name: string;
  html_url: string;
}

interface UpdateCheckResultInternal {
  latestVersion: string | null;
  releaseUrl: string | null;
}

let cached: { result: UpdateCheckResultInternal; fetchedAt: number } | null = null;

/** Strips a leading `v` if present (GitHub tags are commonly `v0.0.2`). */
function normalizeTag(tag: string): string {
  return tag.startsWith('v') ? tag.slice(1) : tag;
}

/** Simple ZeroVer-safe numeric compare: split on '.', compare each segment
 *  numerically, left to right. Returns true if `latest` is strictly newer
 *  than `current`. Non-numeric segments fall back to string inequality on
 *  that segment only (defensive — GitHub tags are expected to be plain
 *  dotted-numeric here). */
function isNewer(current: string, latest: string): boolean {
  const a = current.split('.').map(Number);
  const b = latest.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (Number.isNaN(av) || Number.isNaN(bv)) return latest !== current;
    if (bv > av) return true;
    if (bv < av) return false;
  }
  return false;
}

async function fetchLatestRelease(token: string): Promise<UpdateCheckResultInternal> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'dashdash-update-check',
    },
  });
  if (!res.ok) return { latestVersion: null, releaseUrl: null };
  const release = (await res.json()) as GithubRelease;
  return { latestVersion: normalizeTag(release.tag_name), releaseUrl: release.html_url };
}

export function createUpdateCheckRoutes(deps: { currentVersion: string }): FastifyPluginAsync {
  return async fastify => {
    fastify.get('/update-check', async (_req, reply) => {
      const token = process.env['DASHDASH_GITHUB_TOKEN'];
      if (!token) {
        return reply.send({
          currentVersion: deps.currentVersion,
          latestVersion: null,
          updateAvailable: false,
          releaseUrl: null,
        });
      }

      if (!cached || Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
        try {
          cached = { result: await fetchLatestRelease(token), fetchedAt: Date.now() };
        } catch {
          cached = { result: { latestVersion: null, releaseUrl: null }, fetchedAt: Date.now() };
        }
      }

      return reply.send({
        currentVersion: deps.currentVersion,
        latestVersion: cached.result.latestVersion,
        updateAvailable: cached.result.latestVersion !== null
          && isNewer(deps.currentVersion, cached.result.latestVersion),
        releaseUrl: cached.result.releaseUrl,
      });
    });
  };
}
