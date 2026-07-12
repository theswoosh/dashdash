import { execFile } from 'child_process';
import net, { isIP } from 'net';
import dns from 'dns/promises';

const MAX_HOSTNAME_LENGTH = 253;
const MIN_PING_TIMEOUT_SEC = 1;
const DEFAULT_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 25_000;

/** Strict host validation — prevents any shell/command injection. */
const SAFE_HOST_RE = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;

/** Block RFC-1918 / loopback / link-local ranges to prevent SSRF. */
const PRIVATE_IP_RE = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd/i,
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RE.some(re => re.test(ip));
}

function extractHost(input: string): string {
  const normalized = input.includes('://') ? input : `http://${input}`;
  try {
    return new URL(normalized).hostname;
  } catch {
    return input.trim();
  }
}

export interface CheckResult {
  // 'unknown' = the check could not be performed (e.g. ICMP not permitted in
  // this container), distinct from 'down' (target actively unreachable).
  status: 'up' | 'down' | 'unknown';
  latencyMs: number;
  error?: string | undefined;
}

/**
 * Distinguish "ICMP isn't available to us" (no permission / no `ping` binary)
 * from a genuine "host is unreachable". In unprivileged LXC the container can't
 * set net.ipv4.ping_group_range and lacks CAP_NET_RAW, so `ping` fails to open
 * its socket — that must not be reported as the host being down.
 */
function isIcmpUnavailable(err: { code?: string | number | null }, stderr: string): boolean {
  // Spawn failures (binary missing / not executable) surface as a string code
  // (e.g. 'ENOENT'); a process that ran and exited has a numeric exit code.
  if (typeof err.code === 'string') return true;
  return /operation not permitted|permission denied|are you root|socket:|raw socket|not permitted/i.test(stderr);
}

/** In-process TTL cache: avoids duplicate DNS + subprocess calls within a 25s window. */
const checkCache = new Map<string, { result: CheckResult; ts: number }>();

/** Exposed for tests — clears the TTL cache between test cases. */
export function clearHealthcheckCache(): void {
  checkCache.clear();
}

interface CheckOptions {
  url: string;
  port?: number | undefined;
  timeoutMs?: number | undefined;
  allowPrivateNetworks?: boolean | undefined;
}

/** ICMP ping — is the host alive? */
function pingHost(host: string, timeoutMs: number): Promise<CheckResult> {
  return new Promise(resolve => {
    const start = Date.now();
    const timeoutSec = Math.max(MIN_PING_TIMEOUT_SEC, Math.ceil(timeoutMs / 1000));
    execFile('ping', ['-c', '1', '-W', String(timeoutSec), host], (err, _stdout, stderr) => {
      const latencyMs = Date.now() - start;
      if (!err) {
        resolve({ status: 'up', latencyMs });
        return;
      }
      if (isIcmpUnavailable(err, String(stderr ?? ''))) {
        // Can't ping from this container — report unknown, not down. Use a
        // port/URL (TCP check) for a definitive result in restricted setups.
        resolve({ status: 'unknown', error: 'ICMP unavailable', latencyMs });
        return;
      }
      resolve({ status: 'down', error: 'unreachable', latencyMs });
    });
  });
}

/** TCP connect — is the port open? */
function tcpCheck(host: string, port: number, timeoutMs: number): Promise<CheckResult> {
  return new Promise(resolve => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;
    const done = (result: CheckResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.connect(port, host, () => done({ status: 'up', latencyMs: Date.now() - start }));
    socket.on('error', () => done({ status: 'down', error: 'unreachable', latencyMs: Date.now() - start }));
    socket.on('timeout', () => done({ status: 'down', error: 'timeout', latencyMs: Date.now() - start }));
  });
}

/**
 * Resolve the effective port for a TCP check, before DNS. Returns undefined to
 * mean "no port → use ICMP ping":
 *   - explicit `port` field, or `host:port`, or a port in the URL → that port
 *   - an `http(s)://` URL with no port → 80 / 443
 *   - a bare host/IP (no scheme, no port), or a non-HTTP scheme → undefined (ICMP)
 */
function resolveEffectivePort(trimmed: string, port: number | undefined): number | undefined {
  if (port !== undefined) return port;
  const hasScheme = trimmed.includes('://');
  try {
    const parsed = new URL(hasScheme ? trimmed : `http://${trimmed}`);
    if (parsed.port) return parseInt(parsed.port, 10);
    if (hasScheme && parsed.protocol === 'https:') return 443;
    if (hasScheme && parsed.protocol === 'http:') return 80;
  } catch { /* fall back to ICMP ping */ }
  return undefined;
}

/**
 * No port → ICMP ping (is the host reachable?).
 * Port specified → TCP connect (is the service listening?).
 *
 * Results are cached for 25 s keyed by host+port so duplicate widgets
 * pointing at the same target only fire one DNS lookup + subprocess per interval.
 */
export async function runHealthcheck(opts: CheckOptions): Promise<CheckResult> {
  const { url: urlInput, port, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;

  if (!urlInput?.trim()) {
    // Target is optional — an unconfigured widget is 'unknown' (grey dot),
    // not 'down': nothing was checked, so nothing is known to be broken.
    return { status: 'unknown', error: 'No URL configured', latencyMs: 0 };
  }

  const trimmed = urlInput.trim();
  const host = extractHost(trimmed);

  if (!isIP(host) && (!SAFE_HOST_RE.test(host) || host.length > MAX_HOSTNAME_LENGTH)) {
    return { status: 'down', error: 'Invalid host', latencyMs: 0 };
  }

  // Compute effective port before DNS so the cache key is stable.
  const effectivePort = resolveEffectivePort(trimmed, port);
  const cacheKey = `${host}:${effectivePort ?? 'ping'}`;
  const cached = checkCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.result;
  }

  let targetIp: string | null = null;
  if (isIP(host)) {
    if (!opts.allowPrivateNetworks && isPrivateIp(host)) {
      return { status: 'down', error: 'Private or reserved addresses are not allowed', latencyMs: 0 };
    }
    targetIp = host;
  } else {
    const addresses = await dns.resolve4(host).catch(() => [] as string[]);
    if (addresses.length === 0) {
      return { status: 'down', error: 'Invalid host', latencyMs: 0 };
    }
    const allowed = opts.allowPrivateNetworks ? addresses : addresses.filter(ip => !isPrivateIp(ip));
    if (allowed.length === 0) {
      return { status: 'down', error: 'Private or reserved addresses are not allowed', latencyMs: 0 };
    }
    targetIp = allowed[0]!;
  }

  const result = await (effectivePort !== undefined
    ? tcpCheck(targetIp, effectivePort, timeoutMs)
    : pingHost(targetIp, timeoutMs));

  checkCache.set(cacheKey, { result, ts: Date.now() });
  return result;
}
