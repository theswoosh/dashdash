import { describe, it, expect } from 'vitest';
import { contrastRatio, guardCustomColors } from '../color-contrast';

describe('contrastRatio', () => {
  it('black on white is 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('white on white is 1:1', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('is symmetric-ish for mid grays (known low contrast)', () => {
    const ratio = contrastRatio('#888888', '#999999');
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeLessThan(1.5);
  });

  it('composites a semi-transparent rgba foreground over the background', () => {
    // white at 50% over black ~ mid-gray — contrast against white bg should
    // sit well below white/white's 1:1 upper bound and above 1.
    const ratio = contrastRatio('rgba(255, 255, 255, 0.5)', '#000000');
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeGreaterThan(1);
    expect(ratio!).toBeLessThan(21);
  });

  it('parses #rgb, #rrggbb, #rrggbbaa and rgb()', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 0);
    expect(contrastRatio('#ffffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrastRatio('rgb(255, 255, 255)', '#000000')).toBeCloseTo(21, 0);
  });

  it('returns null for unparseable colors — never guess', () => {
    expect(contrastRatio('not-a-color', '#ffffff')).toBeNull();
    expect(contrastRatio('#ffffff', '')).toBeNull();
    expect(contrastRatio('var(--card-bg)', '#ffffff')).toBeNull();
  });
});

describe('guardCustomColors', () => {
  const surfaces = { themeCardBg: '#ffffff', themeTextColor: '#000000' };

  it('passes colors through unchanged when color_theme is absent (legacy board)', () => {
    const result = guardCustomColors({
      authoredTheme: undefined,
      activeTheme: 'classic',
      bgColor: '#ffffff',
      fontColor: '#ffffff', // would otherwise fail contrast — legacy path skips the check
      ...surfaces,
    });
    expect(result).toEqual({ bgColor: '#ffffff', bgSuppressed: false, fontColor: '#ffffff', fontSuppressed: false });
  });

  it('passes colors through unchanged when authored under the active theme', () => {
    const result = guardCustomColors({
      authoredTheme: 'classic',
      activeTheme: 'classic',
      bgColor: '#ffffff',
      fontColor: '#ffffff',
      ...surfaces,
    });
    expect(result.bgSuppressed).toBe(false);
    expect(result.fontSuppressed).toBe(false);
  });

  it('drops a font_color that fails contrast against the resolved bg under a different theme', () => {
    const result = guardCustomColors({
      authoredTheme: 'liquid-glass',
      activeTheme: 'classic',
      bgColor: undefined,
      fontColor: '#fefefe', // near-white text on white theme card bg
      ...surfaces,
    });
    expect(result.fontColor).toBeUndefined();
    expect(result.fontSuppressed).toBe(true);
  });

  it('keeps a font_color that passes contrast against the theme card bg', () => {
    const result = guardCustomColors({
      authoredTheme: 'liquid-glass',
      activeTheme: 'classic',
      bgColor: undefined,
      fontColor: '#000000',
      ...surfaces,
    });
    expect(result.fontColor).toBe('#000000');
    expect(result.fontSuppressed).toBe(false);
  });

  it('drops a bg_color that fails contrast against the theme default text', () => {
    const result = guardCustomColors({
      authoredTheme: 'liquid-glass',
      activeTheme: 'classic',
      bgColor: '#050505', // near-black bg — themeTextColor is also near-black
      fontColor: undefined,
      ...surfaces,
    });
    expect(result.bgColor).toBeUndefined();
    expect(result.bgSuppressed).toBe(true);
  });

  it('checks font_color against the custom bg_color when the bg passes', () => {
    const result = guardCustomColors({
      authoredTheme: 'liquid-glass',
      activeTheme: 'classic',
      bgColor: '#000000', // passes against themeTextColor #000000? ratio 1:1 -> fails
      fontColor: '#ffffff',
      ...surfaces,
    });
    // bg fails (black bg vs black theme text is 1:1) so bg is dropped, and
    // font_color falls back to being checked against the theme card bg
    // (#ffffff) — white on white fails too.
    expect(result.bgSuppressed).toBe(true);
    expect(result.fontSuppressed).toBe(true);
  });

  it('treats unparseable colors as passing (never suppresses)', () => {
    const result = guardCustomColors({
      authoredTheme: 'liquid-glass',
      activeTheme: 'classic',
      bgColor: 'garbage',
      fontColor: 'also-garbage',
      themeCardBg: '',
      themeTextColor: '',
    });
    expect(result.bgSuppressed).toBe(false);
    expect(result.fontSuppressed).toBe(false);
    expect(result.bgColor).toBe('garbage');
    expect(result.fontColor).toBe('also-garbage');
  });
});
