import { describe, it, expect } from 'vitest';
import { parseThemeColor, getThemeColorDefaults } from '../utils/theme-color-defaults';

describe('parseThemeColor', () => {
  it('parses 6-digit hex', () => {
    expect(parseThemeColor('#ffffff')).toEqual({ hex: '#ffffff', alpha: 1 });
    expect(parseThemeColor('#191970')).toEqual({ hex: '#191970', alpha: 1 });
  });

  it('parses 3-digit hex by doubling digits', () => {
    expect(parseThemeColor('#fff')).toEqual({ hex: '#ffffff', alpha: 1 });
    expect(parseThemeColor('#abc')).toEqual({ hex: '#aabbcc', alpha: 1 });
  });

  it('parses rgb() without alpha', () => {
    expect(parseThemeColor('rgb(57, 255, 110)')).toEqual({ hex: '#39ff6e', alpha: 1 });
  });

  it('parses rgba() with alpha', () => {
    expect(parseThemeColor('rgba(255, 255, 255, 0.05)')).toEqual({ hex: '#ffffff', alpha: 0.05 });
  });

  it('handles surrounding whitespace', () => {
    expect(parseThemeColor('  #ffffff  ')).toEqual({ hex: '#ffffff', alpha: 1 });
    expect(parseThemeColor('rgba( 0 , 0 , 0 , 1 )')).toEqual({ hex: '#000000', alpha: 1 });
  });

  it('returns null for unparseable input', () => {
    expect(parseThemeColor('')).toBeNull();
    expect(parseThemeColor('not-a-color')).toBeNull();
    expect(parseThemeColor('color-mix(in srgb, red, blue)')).toBeNull();
  });
});

describe('getThemeColorDefaults', () => {
  it('falls back to sensible literals when no theme vars are set', () => {
    const defaults = getThemeColorDefaults(document.createElement('div'));
    expect(defaults.bg.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(defaults.fg.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('reads --card-bg and --card-fg from the given element', () => {
    const el = document.createElement('div');
    el.style.setProperty('--card-bg', '#191970');
    el.style.setProperty('--card-fg', '#8899ff');
    document.body.appendChild(el);
    const defaults = getThemeColorDefaults(el);
    expect(defaults.bg).toEqual({ hex: '#191970', alpha: 1 });
    expect(defaults.fg).toEqual({ hex: '#8899ff', alpha: 1 });
    document.body.removeChild(el);
  });

  it('falls back --card-fg to --text-primary when unset', () => {
    const el = document.createElement('div');
    el.style.setProperty('--card-bg', '#ffffff');
    el.style.setProperty('--text-primary', 'rgba(0, 0, 0, 0.88)');
    document.body.appendChild(el);
    const defaults = getThemeColorDefaults(el);
    expect(defaults.fg).toEqual({ hex: '#000000', alpha: 0.88 });
    document.body.removeChild(el);
  });
});
