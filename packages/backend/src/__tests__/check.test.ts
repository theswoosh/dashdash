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
import { runHealthcheck, clearHealthcheckCache } from '../widgets/healthcheck/check.js';

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
  it('returns down with error for empty string', async () => {
    const result = await runHealthcheck({ url: '' });
    expect(result).toEqual({ status: 'down', error: 'No URL configured', latencyMs: 0 });
  });

  it('returns down with error for whitespace-only string', async () => {
    const result = await runHealthcheck({ url: '   ' });
    expect(result).toEqual({ status: 'down', error: 'No URL configured', latencyMs: 0 });
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
      expect(result).toEqual({ status: 'down', error: 'Invalid host', latencyMs: 0 });
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
  });
});
