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

import dns from 'dns/promises';
import { execFile } from 'child_process';
import { runHealthcheck } from '../widgets/healthcheck/check.js';

const mockResolve4 = dns.resolve4 as ReturnType<typeof vi.fn>;
const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
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
// 5. Valid public hostname — ping path (no port)
// ---------------------------------------------------------------------------
describe('runHealthcheck — valid host, ping path', () => {
  it('returns up when ping succeeds', async () => {
    mockResolve4.mockResolvedValue(['8.8.8.8']);
    mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
      cb(null);
    });

    const result = await runHealthcheck({ url: 'http://example.com/' });
    expect(result.status).toBe('up');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it('returns down when ping fails', async () => {
    mockResolve4.mockResolvedValue(['8.8.8.8']);
    mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
      cb(new Error('ping failed'));
    });

    const result = await runHealthcheck({ url: 'example.com' });
    expect(result.status).toBe('down');
    expect(result.error).toBe('unreachable');
  });
});
