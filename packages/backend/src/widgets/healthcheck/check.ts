import https from 'https';
import http from 'http';

function normalizeUrl(urlStr: string, port?: number): string {
  let url = urlStr.trim();
  if (!url.includes('://')) url = `http://${url}`;
  if (port !== undefined) {
    try {
      const parsed = new URL(url);
      parsed.port = String(port);
      url = parsed.toString();
    } catch { /* keep as-is */ }
  }
  return url;
}

/** Fetch without TLS certificate validation (for self-signed certs). */
function fetchIgnoreTls(url: string, signal: AbortSignal): Promise<{ statusCode: number }> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { rejectUnauthorized: false }, res => {
      resolve({ statusCode: res.statusCode ?? 0 });
      res.resume(); // drain body so socket is released
    });
    req.on('error', reject);
    signal.addEventListener('abort', () => { try { req.destroy(); } catch { /* ignore */ } });
    req.end();
  });
}

export interface CheckOptions {
  url: string;
  port?: number | undefined;
  ignoreTls?: boolean | undefined;
  timeoutMs?: number | undefined;
}

export interface CheckResult {
  status: 'up' | 'down';
  statusCode?: number | undefined;
  latencyMs: number;
  error?: string | undefined;
}

/** Run a healthcheck against a URL. Any HTTP response = up; only true failures = down. */
export async function runHealthcheck(opts: CheckOptions): Promise<CheckResult> {
  const { url: urlInput, port, ignoreTls = false, timeoutMs = 5000 } = opts;

  if (!urlInput?.trim()) {
    return { status: 'down', error: 'No URL configured', latencyMs: 0 };
  }

  const url = normalizeUrl(urlInput, port);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    let statusCode: number;
    if (ignoreTls) {
      const result = await fetchIgnoreTls(url, controller.signal);
      statusCode = result.statusCode;
    } else {
      const res = await fetch(url, { signal: controller.signal });
      statusCode = res.status;
    }
    const latencyMs = Date.now() - start;
    return { status: 'up', statusCode, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return { status: 'down', error: isTimeout ? 'timeout' : 'unreachable', latencyMs };
  } finally {
    clearTimeout(timer);
  }
}
