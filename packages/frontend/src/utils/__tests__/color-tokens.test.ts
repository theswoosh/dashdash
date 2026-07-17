import { describe, it, expect } from 'vitest';
import { resolveColorOptionValue, parseTokenValue, makeTokenValue, COLOR_TOKENS } from '../color-tokens';

describe('resolveColorOptionValue', () => {
  it('resolves every known token to its CSS var', () => {
    expect(resolveColorOptionValue('token:accent')).toBe('var(--accent)');
    expect(resolveColorOptionValue('token:muted')).toBe('var(--tone-muted)');
    expect(resolveColorOptionValue('token:surface-1')).toBe('var(--tone-surface-1)');
    expect(resolveColorOptionValue('token:surface-2')).toBe('var(--tone-surface-2)');
    expect(resolveColorOptionValue('token:warn')).toBe('var(--tone-warn)');
    expect(resolveColorOptionValue('token:danger')).toBe('var(--tone-danger)');
  });

  it('covers every entry in COLOR_TOKENS', () => {
    for (const token of COLOR_TOKENS) {
      expect(resolveColorOptionValue(makeTokenValue(token))).toMatch(/^var\(--/);
    }
  });

  it('ignores an unknown token — drops the override entirely', () => {
    expect(resolveColorOptionValue('token:nonexistent')).toBeUndefined();
  });

  it('passes plain hex through unchanged', () => {
    expect(resolveColorOptionValue('#4488ff')).toBe('#4488ff');
  });

  it('passes rgba through unchanged', () => {
    expect(resolveColorOptionValue('rgba(68, 136, 255, 0.20)')).toBe('rgba(68, 136, 255, 0.20)');
  });

  it('passes undefined through unchanged', () => {
    expect(resolveColorOptionValue(undefined)).toBeUndefined();
  });
});

describe('parseTokenValue', () => {
  it('parses a valid token value', () => {
    expect(parseTokenValue('token:warn')).toBe('warn');
  });

  it('returns null for a non-token string', () => {
    expect(parseTokenValue('#ffffff')).toBeNull();
  });

  it('returns null for an unrecognized token name', () => {
    expect(parseTokenValue('token:bogus')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(parseTokenValue(null)).toBeNull();
    expect(parseTokenValue(undefined)).toBeNull();
  });
});
