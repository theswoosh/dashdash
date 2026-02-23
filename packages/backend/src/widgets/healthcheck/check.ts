import { execFile } from 'child_process';
import net from 'net';

/** Strict host validation — prevents any shell/command injection. */
const SAFE_HOST_RE = /^[a-zA-Z0-9]([a-zA-Z0-9.\-]*[a-zA-Z0-9])?$/;

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
    const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000));
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
  const { url: urlInput, port, timeoutMs = 5000 } = opts;

  if (!urlInput?.trim()) {
    return { status: 'down', error: 'No URL configured', latencyMs: 0 };
  }

  const host = extractHost(urlInput.trim());

  if (!SAFE_HOST_RE.test(host) || host.length > 253) {
    return { status: 'down', error: 'Invalid host', latencyMs: 0 };
  }

  return port !== undefined
    ? tcpCheck(host, port, timeoutMs)
    : pingHost(host, timeoutMs);
}
