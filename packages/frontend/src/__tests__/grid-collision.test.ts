import { describe, it, expect } from 'vitest';
import type { LayoutItem } from 'react-grid-layout';
import {
  DROPPING_ELEMENT_ID,
  OVERLAP_COMPACTOR,
  layoutItemsOverlap,
  findOverlappingItems,
  evaluateRootDragTarget,
  resolveNonOverlappingPosition,
  wouldClipFrameChildren,
} from '../utils/grid-collision';

function item(i: string, x: number, y: number, w = 2, h = 2): LayoutItem {
  return { i, x, y, w, h };
}

describe('layoutItemsOverlap', () => {
  it('detects overlapping items', () => {
    expect(layoutItemsOverlap(item('a', 0, 0), item('b', 1, 1))).toBe(true);
  });

  it('treats edge-touching items as NOT overlapping', () => {
    expect(layoutItemsOverlap(item('a', 0, 0), item('b', 2, 0))).toBe(false);
    expect(layoutItemsOverlap(item('a', 0, 0), item('b', 0, 2))).toBe(false);
  });

  it('detects full containment', () => {
    expect(layoutItemsOverlap(item('a', 0, 0, 6, 6), item('b', 2, 2, 1, 1))).toBe(true);
  });
});

describe('findOverlappingItems', () => {
  const layout = [item('a', 0, 0), item('b', 1, 1), item('c', 10, 10), item(DROPPING_ELEMENT_ID, 0, 0)];

  it('returns all overlapping items, excluding self and the drop ghost', () => {
    const hits = findOverlappingItems(item('a', 0, 0), layout);
    expect(hits.map(l => l.i)).toEqual(['b']);
  });

  it('respects extra ignore ids', () => {
    const hits = findOverlappingItems(item('a', 0, 0), layout, new Set(['b']));
    expect(hits).toEqual([]);
  });

  it('reports multiple overlaps', () => {
    const hits = findOverlappingItems(item('x', 0, 0, 12, 12), layout);
    expect(hits.map(l => l.i).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('evaluateRootDragTarget', () => {
  const frame = item('frame-1', 10, 0, 8, 8);
  const widget = item('w2', 0, 0, 4, 4);
  const frameIds = new Set(['frame-1']);

  it('is valid on free space', () => {
    const result = evaluateRootDragTarget(item('w1', 20, 20), [frame, widget], frameIds);
    expect(result).toEqual({ kind: 'valid' });
  });

  it('is invalid when overlapping another widget', () => {
    const result = evaluateRootDragTarget(item('w1', 2, 2), [frame, widget], frameIds);
    expect(result).toEqual({ kind: 'invalid' });
  });

  it('reparents a non-frame item whose top-left is inside a frame', () => {
    const result = evaluateRootDragTarget(item('w1', 12, 2), [frame, widget], frameIds);
    expect(result).toEqual({ kind: 'reparent', frameId: 'frame-1', frameLayout: frame });
  });

  it('reparents the external drop ghost over a frame', () => {
    const result = evaluateRootDragTarget(item(DROPPING_ELEMENT_ID, 12, 2), [frame, widget], frameIds);
    expect(result.kind).toBe('reparent');
  });

  it('is invalid when overlapping a frame with the top-left outside it', () => {
    const result = evaluateRootDragTarget(item('w1', 8, 2, 4, 4), [frame, widget], frameIds);
    expect(result).toEqual({ kind: 'invalid' });
  });

  it('never reparents a frame — frame over frame is invalid', () => {
    const otherFrame = item('frame-2', 11, 1, 4, 4);
    const result = evaluateRootDragTarget(otherFrame, [frame, widget], new Set(['frame-1', 'frame-2']));
    expect(result).toEqual({ kind: 'invalid' });
  });

  it('frame over widget is invalid', () => {
    const movedFrame = { ...frame, x: 2, y: 2 };
    const result = evaluateRootDragTarget(movedFrame, [widget], frameIds);
    expect(result).toEqual({ kind: 'invalid' });
  });
});

describe('resolveNonOverlappingPosition', () => {
  it('keeps the requested spot when free', () => {
    const pos = resolveNonOverlappingPosition(item('w1', 4, 0), [item('a', 0, 0)], 12);
    expect(pos).toEqual({ x: 4, y: 0 });
  });

  it('finds the next free spot when the requested one is occupied', () => {
    const pos = resolveNonOverlappingPosition(item('w1', 0, 0), [item('a', 0, 0)], 4);
    expect(pos).toEqual({ x: 2, y: 0 });
  });

  it('falls back to the row below everything on a fully occupied grid', () => {
    const siblings = [item('a', 0, 0, 4, 2)];
    const pos = resolveNonOverlappingPosition(item('w1', 0, 0, 4, 2), siblings, 4);
    expect(pos).toEqual({ x: 0, y: 2 });
  });

  it('clamps x into the column range', () => {
    const pos = resolveNonOverlappingPosition(item('w1', 10, 0, 4, 2), [], 6);
    expect(pos).toEqual({ x: 2, y: 0 });
  });

  it('clamps negative coordinates to zero', () => {
    const pos = resolveNonOverlappingPosition(item('w1', -3, -2), [], 6);
    expect(pos).toEqual({ x: 0, y: 0 });
  });
});

describe('wouldClipFrameChildren', () => {
  function child(x: number, y: number, w: number, h: number) {
    return { layout: { x, y, w, h } };
  }

  it('is false when there are no children', () => {
    expect(wouldClipFrameChildren([], 4, 4)).toBe(false);
  });

  it('is false when all children fit within the new bounds', () => {
    const children = [child(0, 0, 2, 2), child(2, 0, 2, 2)];
    expect(wouldClipFrameChildren(children, 4, 4)).toBe(false);
  });

  it('is true when a child exceeds the new width', () => {
    const children = [child(2, 0, 3, 2)];
    expect(wouldClipFrameChildren(children, 4, 4)).toBe(true);
  });

  it('is true when a child exceeds the new height', () => {
    const children = [child(0, 2, 2, 3)];
    expect(wouldClipFrameChildren(children, 4, 4)).toBe(true);
  });

  it('treats a child landing exactly on the new edge as fitting', () => {
    const children = [child(0, 0, 4, 4)];
    expect(wouldClipFrameChildren(children, 4, 4)).toBe(false);
  });
});

describe('OVERLAP_COMPACTOR', () => {
  it('allows overlap and never compacts', () => {
    expect(OVERLAP_COMPACTOR.allowOverlap).toBe(true);
    expect(OVERLAP_COMPACTOR.type).toBeNull();
    const layout = [item('a', 0, 0), item('b', 0, 0)];
    const compacted = OVERLAP_COMPACTOR.compact(layout, 12);
    expect(compacted.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))).toEqual(
      layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
    );
  });
});
