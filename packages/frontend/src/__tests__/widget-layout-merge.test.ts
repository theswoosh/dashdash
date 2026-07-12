import { describe, it, expect } from 'vitest';
import type { LayoutItem } from 'react-grid-layout';
import { mergeEditModeLayout } from '../utils/widget-layout';

const item = (partial: Partial<LayoutItem> & { i: string }): LayoutItem => ({
  x: 0, y: 0, w: 10, h: 10, ...partial,
});

describe('mergeEditModeLayout', () => {
  it('preserves in-progress positions and sizes for unchanged items', () => {
    const prev = [item({ i: 'a', x: 5, y: 7, w: 12, h: 8 })];
    const fromYaml = [item({ i: 'a', x: 0, y: 0, w: 10, h: 10 })];
    expect(mergeEditModeLayout(prev, fromYaml)[0]).toMatchObject({ x: 5, y: 7, w: 12, h: 8 });
  });

  it('new items fall back to their YAML entry', () => {
    const fromYaml = [item({ i: 'new', x: 3, y: 4 })];
    expect(mergeEditModeLayout([], fromYaml)[0]).toMatchObject({ i: 'new', x: 3, y: 4 });
  });

  it('drops items no longer in YAML', () => {
    const prev = [item({ i: 'gone' })];
    expect(mergeEditModeLayout(prev, [])).toEqual([]);
  });

  it('takes the pinned height when an item became tiny mid-session', () => {
    // was normal (h=14), toggled to tiny — rebuilt entry pins h=minH=maxH=3
    const prev = [item({ i: 'hc', x: 40, y: 0, w: 16, h: 14 })];
    const fromYaml = [item({ i: 'hc', x: 40, y: 0, w: 16, h: 3, minH: 3, maxH: 3 })];
    const merged = mergeEditModeLayout(prev, fromYaml)[0]!;
    expect(merged).toMatchObject({ h: 3, minH: 3, maxH: 3 });
  });

  it('restores the stored height when an item left tiny mid-session', () => {
    const prev = [item({ i: 'hc', w: 16, h: 3, minH: 3, maxH: 3 })];
    const fromYaml = [item({ i: 'hc', w: 16, h: 14 })];
    const merged = mergeEditModeLayout(prev, fromYaml)[0]!;
    expect(merged.h).toBe(14);
    expect(merged.minH).toBeUndefined();
    expect(merged.maxH).toBeUndefined();
  });

  it('keeps the user-dragged position when pinning changes', () => {
    const prev = [item({ i: 'hc', x: 22, y: 9, w: 16, h: 14 })];
    const fromYaml = [item({ i: 'hc', x: 40, y: 0, w: 16, h: 3, minH: 3, maxH: 3 })];
    expect(mergeEditModeLayout(prev, fromYaml)[0]).toMatchObject({ x: 22, y: 9, h: 3 });
  });
});
