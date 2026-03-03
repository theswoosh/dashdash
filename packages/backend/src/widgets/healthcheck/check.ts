import { execFile } from 'child_process';
import net, { isIP } from 'net';
import dns from 'dns/promises';

const MAX_HOSTNAME_LENGTH = 253;
const MIN_PING_TIMEOUT_SEC = 1;
const DEFAULT_TIMEOUT_MS = 5000;

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

async function isPrivateOrLoopback(host: string): Promise<boolean> {
  const addresses = isIP(host) ? [host] : await dns.resolve4(host).catch(() => [] as string[]);
  return addresses.some(ip => PRIVATE_IP_RE.some(re => re.test(ip)));
}

function extractHost(input: string): string {
  const normalized = input.includes('://') ? input : `http://${input}`;
  try {
    return new URL(normalized).hostname;
  } catch {
    return input.trim();
  }
}

export interface CheckOptions {
  url: string;
  port?: number | undefined;
  timeoutMs?: number | undefined;
}

export interface CheckResult {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string | undefined;
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

/**
 * No port → ICMP ping (is the host reachable?).
 * Port specified → TCP connect (is the service listening?).
 */
export async function runHealthcheck(opts: CheckOptions): Promise<CheckResult> {
  const { url: urlInput, port, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;

  if (!urlInput?.trim()) {
    return { status: 'down', error: 'No URL configured', latencyMs: 0 };
  }

  const trimmed = urlInput.trim();
  const host = extractHost(trimmed);

  if (!SAFE_HOST_RE.test(host) || host.length > MAX_HOSTNAME_LENGTH) {
    return { status: 'down', error: 'Invalid host', latencyMs: 0 };
  }

  if (await isPrivateOrLoopback(host)) {
    return { status: 'down', error: 'Private or reserved addresses are not allowed', latencyMs: 0 };
  }

  // Extract port from URL if not provided as an explicit option.
  let effectivePort = port;
  if (effectivePort === undefined) {
    try {
      const normalized = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
      const urlPort = new URL(normalized).port;
      if (urlPort) effectivePort = parseInt(urlPort, 10);
    } catch { /* URL parsing failed — fall back to ping without explicit port */ }
  }

  return effectivePort !== undefined
    ? tcpCheck(host, effectivePort, timeoutMs)
    : pingHost(host, timeoutMs);
}
