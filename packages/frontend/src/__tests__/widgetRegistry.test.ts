import { describe, it, expect } from 'vitest';
import { getWidget } from '../widgets/registry';

describe('widget registry', () => {
  it('returns clockWidget for "clock" and marks it clientOnly', () => {
    const w = getWidget('clock');
    expect(w.clientOnly).toBe(true);
    expect(w.Component).toBeTruthy();
  });

  it('returns healthcheckWidget for "healthcheck" (not clientOnly)', () => {
    const w = getWidget('healthcheck');
    expect(w.clientOnly).toBeUndefined();
    expect(w.Component).toBeTruthy();
  });

  it('returns statsWidget for "stats" (not clientOnly)', () => {
    const w = getWidget('stats');
    expect(w.clientOnly).toBeUndefined();
    expect(w.Component).toBeTruthy();
  });

  it('marks bookmarks, search, iframe, frame as clientOnly', () => {
    for (const id of ['bookmarks', 'search', 'iframe', 'frame']) {
      const w = getWidget(id);
      expect(w.clientOnly).toBe(true);
    }
  });

  it('falls back to FallbackWidget (clientOnly) for unknown widget types', () => {
    const w = getWidget('totally-unknown-widget');
    expect(w.clientOnly).toBe(true);
    expect(w.Component).toBeTruthy();
  });
});
