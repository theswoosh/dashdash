import { describe, it, expect } from 'vitest';
import { isValidHealthcheckTarget, sanitizeHealthcheckTarget } from '../utils/healthcheck-target';

describe('isValidHealthcheckTarget', () => {
  it('accepts empty input — target is optional', () => {
    expect(isValidHealthcheckTarget('')).toBe(true);
    expect(isValidHealthcheckTarget('   ')).toBe(true);
  });

  it('accepts bare hostnames and IPv4 addresses', () => {
    expect(isValidHealthcheckTarget('example.com')).toBe(true);
    expect(isValidHealthcheckTarget('192.168.1.1')).toBe(true);
    expect(isValidHealthcheckTarget('my-server')).toBe(true);
  });

  it('accepts host:port', () => {
    expect(isValidHealthcheckTarget('example.com:8080')).toBe(true);
    expect(isValidHealthcheckTarget('192.168.1.1:443')).toBe(true);
  });

  it('rejects out-of-range ports', () => {
    expect(isValidHealthcheckTarget('example.com:0')).toBe(false);
    expect(isValidHealthcheckTarget('example.com:70000')).toBe(false);
  });

  it('accepts http(s) URLs, rejects other schemes', () => {
    expect(isValidHealthcheckTarget('https://service.internal')).toBe(true);
    expect(isValidHealthcheckTarget('http://example.com:3000/path')).toBe(true);
    expect(isValidHealthcheckTarget('ftp://example.com')).toBe(false);
    expect(isValidHealthcheckTarget('file:///etc/passwd')).toBe(false);
  });

  it('accepts bare IPv6', () => {
    expect(isValidHealthcheckTarget('::1')).toBe(true);
    expect(isValidHealthcheckTarget('fe80::1')).toBe(true);
  });

  it('rejects garbage', () => {
    expect(isValidHealthcheckTarget('not a host')).toBe(false);
    expect(isValidHealthcheckTarget('host_with_underscores')).toBe(false);
    expect(isValidHealthcheckTarget('-leading-dash')).toBe(false);
    expect(isValidHealthcheckTarget('a'.repeat(300))).toBe(false);
  });

  it('validates the trimmed value', () => {
    expect(isValidHealthcheckTarget('  example.com  ')).toBe(true);
  });
});

describe('sanitizeHealthcheckTarget', () => {
  it('trims whitespace', () => {
    expect(sanitizeHealthcheckTarget('  example.com  ')).toBe('example.com');
  });
});
