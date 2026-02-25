import { describe, it, expect } from 'vitest';
import { THEMES, getTheme } from '../themes/registry';

describe('THEMES', () => {
  it('has 4 entries', () => {
    expect(THEMES).toHaveLength(4);
  });

  it('liquid-glass is first (the default)', () => {
    expect(THEMES[0]!.id).toBe('liquid-glass');
  });

  it('each theme has all required fields', () => {
    for (const t of THEMES) {
      expect(t.id, `${t.id}: id`).toBeTruthy();
      expect(t.name, `${t.id}: name`).toBeTruthy();
      expect(t.description, `${t.id}: description`).toBeTruthy();
      expect(t.Icon, `${t.id}: Icon`).toBeTruthy();
      expect(t.Card, `${t.id}: Card`).toBeTypeOf('function');
    }
  });

  it('has unique ids', () => {
    const ids = THEMES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getTheme', () => {
  it('returns the matching theme by id', () => {
    expect(getTheme('ascii').id).toBe('ascii');
    expect(getTheme('atom').id).toBe('atom');
    expect(getTheme('classic').id).toBe('classic');
    expect(getTheme('liquid-glass').id).toBe('liquid-glass');
  });

  it('falls back to liquid-glass for an unknown id', () => {
    expect(getTheme('not-a-theme').id).toBe('liquid-glass');
    expect(getTheme('').id).toBe('liquid-glass');
  });
});
