import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test.
// ---------------------------------------------------------------------------

vi.mock('dns/promises', () => ({
  default: { resolve4: vi.fn() },
}));

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

// Mock net.Socket so TCP checks don't make real connections in tests.
// vi.hoisted() ensures these run before vi.mock() factories and imports.
const { mockSocket, mockSocketHandlers } = vi.hoisted(() => {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  const socket = {
    setTimeout: vi.fn(),
    connect: vi.fn(),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event]!.push(cb);
    }),
    destroy: vi.fn(),
  };
  return { mockSocket: socket, mockSocketHandlers: handlers };
});

vi.mock('net', async () => {
  const actual = await vi.importActual<typeof import('net')>('net');
  // Use a regular function (not arrow) so it works as a constructor.
  function MockSocket(this: unknown) { return mockSocket; }
  return {
    ...actual,
    default: { ...actual, Socket: MockSocket },
    Socket: MockSocket,
  };
});

import dns from 'dns/promises';
import { execFile } from 'child_process';
import { runHealthcheck, runHealthcheckSwr, clearHealthcheckCache } from '../widgets/healthcheck/check.js';

const mockResolve4 = dns.resolve4 as ReturnType<typeof vi.fn>;
const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  clearHealthcheckCache();
  for (const key of Object.keys(mockSocketHandlers)) {
    delete mockSocketHandlers[key];
  }
  // Restore on() handler registration after resetAllMocks clears it.
  mockSocket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
    mockSocketHandlers[event] = mockSocketHandlers[event] ?? [];
    mockSocketHandlers[event]!.push(cb);
  });
});

// ---------------------------------------------------------------------------
// 1. Empty / blank URL — immediate return, no network calls
// ---------------------------------------------------------------------------
describe('runHealthcheck — empty URL', () => {
  it('returns unknown (not down) for empty string — target is optional', async () => {
    const result = await runHealthcheck({ url: '' });
    expect(result).toEqual({ status: 'unknown', error: 'No URL configured', reason: 'no-url', latencyMs: 0 });
  });

  it('returns unknown (not down) for whitespace-only string', async () => {
    const result = await runHealthcheck({ url: '   ' });
    expect(result).toEqual({ status: 'unknown', error: 'No URL configured', reason: 'no-url', latencyMs: 0 });
  });
});

// ---------------------------------------------------------------------------
// 2. Invalid hostname — SAFE_HOST_RE rejects, no network calls
// ---------------------------------------------------------------------------
describe('runHealthcheck — invalid hostname', () => {
  const cases = [
    { label: 'shell injection',       url: '; rm -rf /' },
    { label: 'space in hostname',     url: 'host name' },
    { label: 'leading dash',          url: '-invalid' },
    { label: 'leading dot',           url: '.leading-dot.com' },
    { label: 'IPv6 bracket literal',  url: 'http://[::1]/' },
  ];

  for (const { label, url } of cases) {
    it(`blocks ${label}: "${url}"`, async () => {
      const result = await runHealthcheck({ url });
      expect(result).toEqual({ status: 'down', error: 'Invalid host', reason: 'invalid-host', latencyMs: 0 });
    });
  }

  it('does not make any DNS or network calls', async () => {
    await runHealthcheck({ url: '; rm -rf /' });
    expect(mockResolve4).not.toHaveBeenCalled();
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. SSRF — direct private/reserved IP addresses (no DNS needed)
// ---------------------------------------------------------------------------
describe('runHealthcheck — SSRF via direct IP', () => {
  const blocked = [
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.0.1',
    '0.0.0.1',
  ];

  for (const ip of blocked) {
    it(`blocks private IP ${ip}`, async () => {
      const result = await runHealthcheck({ url: `http://${ip}/` });
      expect(result).toEqual({
        status: 'down',
        error: 'Private or reserved addresses are not allowed',
        reason: 'blocked-private',
        latencyMs: 0,
      });
    });
  }

  it('does not invoke ping or TCP for blocked IPs', async () => {
    await runHealthcheck({ url: 'http://10.0.0.1/' });
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. SSRF via DNS rebinding — hostname resolves to private IP
// ---------------------------------------------------------------------------
describe('runHealthcheck — SSRF via DNS', () => {
  it('blocks hostname that resolves to a private IP', async () => {
    mockResolve4.mockResolvedValue(['10.0.0.1']);

    const result = await runHealthcheck({ url: 'http://internal.corp/' });
    expect(result).toEqual({
      status: 'down',
      error: 'Private or reserved addresses are not allowed',
      reason: 'blocked-private',
      latencyMs: 0,
    });
    expect(mockResolve4).toHaveBeenCalledWith('internal.corp');
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('blocks hostname that resolves to loopback', async () => {
    mockResolve4.mockResolvedValue(['127.0.0.1']);

    const result = await runHealthcheck({ url: 'http://evil.example.com/' });
    expect(result).toEqual({
      status: 'down',
      error: 'Private or reserved addresses are not allowed',
      reason: 'blocked-private',
      latencyMs: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Valid public hostname — TCP path (http→80, https→443)
// ---------------------------------------------------------------------------
describe('runHealthcheck — valid host, TCP path', () => {
  it('returns up when TCP connect succeeds (http → port 80)', async () => {
    mockResolve4.mockResolvedValue(['93.184.216.34']);
    mockSocket.connect.mockImplementation(
      (_port: number, _host: string, cb: () => void) => { cb(); }
    );

    const result = await runHealthcheck({ url: 'http://example.com/' });
    expect(result.status).toBe('up');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('infers port 443 for https scheme', async () => {
    mockResolve4.mockResolvedValue(['93.184.216.34']);
    mockSocket.connect.mockImplementation(
      (port: number, _host: string, cb: () => void) => {
        expect(port).toBe(443);
        cb();
      }
    );

    const result = await runHealthcheck({ url: 'https://example.com/' });
    expect(result.status).toBe('up');
  });

  it('returns down when TCP connect fails', async () => {
    mockResolve4.mockResolvedValue(['93.184.216.34']);
    mockSocket.connect.mockImplementation(() => {
      // simulate async error event
      setTimeout(() => {
        for (const cb of mockSocketHandlers['error'] ?? []) cb(new Error('ECONNREFUSED'));
      }, 0);
    });

    const result = await runHealthcheck({ url: 'http://example.com/' });
    expect(result.status).toBe('down');
    expect(result.error).toBe('unreachable');
    expect(result.reason).toBe('unreachable');
  });
});

// ---------------------------------------------------------------------------
// 6b. Port-resolution routing — bare host → ICMP, explicit port → TCP
// ---------------------------------------------------------------------------
describe('runHealthcheck — port resolution routing', () => {
  it('bare host with no port uses ICMP ping (not TCP)', async () => {
    mockResolve4.mockResolvedValue(['93.184.216.34']);
    mockExecFile.mockImplementation((_f: string, _a: string[], cb: (e: unknown, o: string, s: string) => void) => cb(null, '', ''));
    const result = await runHealthcheck({ url: 'example.com' });
    expect(result.status).toBe('up');
    expect(mockExecFile).toHaveBeenCalled();
    expect(mockSocket.connect).not.toHaveBeenCalled();
  });

  it('explicit host:port uses a TCP check (not ICMP)', async () => {
    mockResolve4.mockResolvedValue(['93.184.216.34']);
    mockSocket.connect.mockImplementation((port: number, _host: string, cb: () => void) => {
      expect(port).toBe(3000);
      cb();
    });
    const result = await runHealthcheck({ url: 'example.com:3000' });
    expect(result.status).toBe('up');
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('explicit port field uses a TCP check (not ICMP)', async () => {
    mockResolve4.mockResolvedValue(['93.184.216.34']);
    mockSocket.connect.mockImplementation((port: number, _host: string, cb: () => void) => {
      expect(port).toBe(8080);
      cb();
    });
    const result = await runHealthcheck({ url: 'example.com', port: 8080 });
    expect(result.status).toBe('up');
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. ICMP ping path (non-http scheme → no inferred port → ping)
// ---------------------------------------------------------------------------
describe('runHealthcheck — ICMP ping path', () => {
  // Use a public IP with a non-http(s) scheme so resolveEffectivePort yields no
  // port and the check falls through to ICMP ping.
  const PING_URL = 'redis://8.8.8.8';

  it('returns up when ping succeeds', async () => {
    mockExecFile.mockImplementation((_f: string, _a: string[], cb: (e: unknown, o: string, s: string) => void) => cb(null, '', ''));
    const result = await runHealthcheck({ url: PING_URL });
    expect(result.status).toBe('up');
    expect(mockExecFile).toHaveBeenCalled();
  });

  it('returns down/unreachable when ping exits non-zero (host down)', async () => {
    mockExecFile.mockImplementation((_f: string, _a: string[], cb: (e: unknown, o: string, s: string) => void) =>
      cb(Object.assign(new Error('exit 1'), { code: 1 }), '', ''));
    const result = await runHealthcheck({ url: PING_URL });
    expect(result).toMatchObject({ status: 'down', error: 'unreachable', reason: 'unreachable' });
  });

  it('returns unknown/ICMP unavailable when ping lacks permission', async () => {
    mockExecFile.mockImplementation((_f: string, _a: string[], cb: (e: unknown, o: string, s: string) => void) =>
      cb(Object.assign(new Error('exit 1'), { code: 1 }), '', 'ping: permission denied (are you root?)'));
    const result = await runHealthcheck({ url: PING_URL });
    expect(result).toMatchObject({ status: 'unknown', error: 'ICMP unavailable', reason: 'icmp-unavailable' });
  });

  it('returns unknown when the ping binary is missing (ENOENT)', async () => {
    mockExecFile.mockImplementation((_f: string, _a: string[], cb: (e: unknown, o: string, s: string) => void) =>
      cb(Object.assign(new Error('spawn ping ENOENT'), { code: 'ENOENT' }), '', ''));
    const result = await runHealthcheck({ url: PING_URL });
    expect(result.status).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// 7. runHealthcheckSwr — non-blocking stale-while-revalidate (batch path)
// ---------------------------------------------------------------------------
describe('runHealthcheckSwr — stale-while-revalidate', () => {
  // Public IP + non-http scheme → ICMP path, no DNS, deterministic mock.
  const PING_URL = 'redis://8.8.8.8';
  const flushProbe = () => new Promise(resolve => setTimeout(resolve, 0));

  it('cold cache: returns pending immediately, real result on the next call', async () => {
    mockExecFile.mockImplementation((_f: string, _a: string[], cb: (e: unknown, o: string, s: string) => void) => cb(null, '', ''));

    const first = runHealthcheckSwr({ url: PING_URL });
    expect(first).toEqual({ status: 'pending', latencyMs: 0 });

    await flushProbe(); // let the background probe finish and populate the cache

    const second = runHealthcheckSwr({ url: PING_URL });
    expect(second.status).toBe('up');
    expect(mockExecFile).toHaveBeenCalledTimes(1); // second call is a cache hit
  });

  it('dedups concurrent pending polls into a single probe', async () => {
    let release: (() => void) | undefined;
    mockExecFile.mockImplementation((_f: string, _a: string[], cb: (e: unknown, o: string, s: string) => void) => {
      release = () => cb(null, '', '');
    });

    expect(runHealthcheckSwr({ url: PING_URL }).status).toBe('pending');
    expect(runHealthcheckSwr({ url: PING_URL }).status).toBe('pending');
    expect(runHealthcheckSwr({ url: PING_URL }).status).toBe('pending');
    expect(mockExecFile).toHaveBeenCalledTimes(1);

    release!();
    await flushProbe();
    expect(runHealthcheckSwr({ url: PING_URL }).status).toBe('up');
  });

  it('expired entry: serves the stale result and refreshes in the background', async () => {
    mockExecFile.mockImplementation((_f: string, _a: string[], cb: (e: unknown, o: string, s: string) => void) => cb(null, '', ''));

    runHealthcheckSwr({ url: PING_URL });
    await flushProbe(); // cache now holds an 'up' result

    // Age the cache past the fresh TTL (35 s) but inside MAX_STALE (5 min).
    const realNow = Date.now();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(realNow + 60_000);
    try {
      const stale = runHealthcheckSwr({ url: PING_URL });
      expect(stale.status).toBe('up'); // stale value, not pending
      expect(mockExecFile).toHaveBeenCalledTimes(2); // background refresh fired
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('answers no-I/O cases directly, never pending', () => {
    expect(runHealthcheckSwr({ url: '' }).status).toBe('unknown');
    expect(runHealthcheckSwr({ url: '; rm -rf /' })).toMatchObject({ status: 'down', error: 'Invalid host', reason: 'invalid-host' });
    expect(runHealthcheckSwr({ url: 'http://10.0.0.1/' })).toMatchObject({
      status: 'down',
      error: 'Private or reserved addresses are not allowed',
      reason: 'blocked-private',
    });
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cache isolation between private-network policies (dashtest regression T13/T14)
// ---------------------------------------------------------------------------
describe('runHealthcheck — cache never crosses allowPrivateNetworks contexts', () => {
  it('a privileged "up" is not served to an unprivileged caller (and vice versa)', async () => {
    mockExecFile.mockImplementation(
      (_bin: string, _args: string[], cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(null, 'ok', '');
      },
    );

    // Privileged path (widget batch with allowPrivateNetworks: true) pings fine.
    const privileged = await runHealthcheck({ url: '10.0.0.1', allowPrivateNetworks: true });
    expect(privileged.status).toBe('up');
    expect(privileged.resolvedIp).toBe('10.0.0.1');

    // The unprivileged path (e.g. a misconfigured caller) must still be
    // blocked by policy — NOT served the cached privileged "up".
    const unprivileged = await runHealthcheck({ url: '10.0.0.1' });
    expect(unprivileged.status).toBe('down');
    expect(unprivileged.error).toMatch(/Private or reserved/);
  });
});

// ---------------------------------------------------------------------------
// 8. reason field — mapping per branch
// ---------------------------------------------------------------------------
describe('runHealthcheck — reason field mapping', () => {
  it('127.0.0.1 unused port → connection-refused', async () => {
    mockSocket.connect.mockImplementation(() => {
      setTimeout(() => {
        for (const cb of mockSocketHandlers['error'] ?? []) {
          cb(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:9'), { code: 'ECONNREFUSED' }));
        }
      }, 0);
    });

    const result = await runHealthcheck({ url: '127.0.0.1', port: 9, allowPrivateNetworks: true });
    expect(result.status).toBe('down');
    expect(result.reason).toBe('connection-refused');
  });

  it('black-hole 10.255.255.1 with low timeout → timeout', async () => {
    mockSocket.connect.mockImplementation(() => {
      setTimeout(() => {
        for (const cb of mockSocketHandlers['timeout'] ?? []) cb();
      }, 0);
    });

    const result = await runHealthcheck({
      url: '10.255.255.1',
      port: 80,
      timeoutMs: 50,
      allowPrivateNetworks: true,
    });
    expect(result.status).toBe('down');
    expect(result.reason).toBe('timeout');
  });

  it('nonexistent hostname → dns-failure', async () => {
    mockResolve4.mockResolvedValue([]);

    const result = await runHealthcheck({ url: 'no-such-host.invalid' });
    expect(result.status).toBe('down');
    expect(result.reason).toBe('dns-failure');
    expect(result.error).toBe('DNS resolution failed');
  });

  it('private IP with allowPrivateNetworks: false → blocked-private', async () => {
    const result = await runHealthcheck({ url: '192.168.1.1', allowPrivateNetworks: false });
    expect(result.status).toBe('down');
    expect(result.reason).toBe('blocked-private');
  });
});
