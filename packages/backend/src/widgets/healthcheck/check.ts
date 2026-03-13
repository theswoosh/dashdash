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
  status: 'up' | 'down';
  latencyMs: number;
  error?: string | undefined;
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
    execFile('ping', ['-c', '1', '-W', String(timeoutSec), host], err => {
      const latencyMs = Date.now() - start;
      resolve(err
        ? { status: 'down', error: 'unreachable', latencyMs }
        : { status: 'up', latencyMs });
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

/** Resolve the effective port from URL scheme/explicit port, before DNS. */
function resolveEffectivePort(trimmed: string, port: number | undefined): number | undefined {
  if (port !== undefined) return port;
  try {
    const normalized = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
    const parsed = new URL(normalized);
    if (parsed.port) return parseInt(parsed.port, 10);
    if (parsed.protocol === 'https:') return 443;
    if (parsed.protocol === 'http:') return 80;
  } catch { /* fall back to ping */ }
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
    return { status: 'down', error: 'No URL configured', latencyMs: 0 };
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
