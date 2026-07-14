import { noCompactor } from 'react-grid-layout';
import type { Compactor, LayoutItem } from 'react-grid-layout';

/** Id RGL assigns to the external drag-over ghost item. */
export const DROPPING_ELEMENT_ID = '__dropping-elem__';

/** No push, no compaction; overlap is allowed *during* a gesture only — every
 *  commit path (drag stop, resize stop, drop) must reject overlapping results. */
export const OVERLAP_COMPACTOR: Compactor = { ...noCompactor, allowOverlap: true };

export function layoutItemsOverlap(a: LayoutItem, b: LayoutItem): boolean {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  return a.x < bx2 && ax2 > b.x && a.y < by2 && ay2 > b.y;
}

/** Items in `layout` that overlap `item`. The item itself and the external
 *  drop ghost are always excluded; `ignoreIds` excludes additional items. */
export function findOverlappingItems(
  item: LayoutItem,
  layout: readonly LayoutItem[],
  ignoreIds?: ReadonlySet<string>,
): LayoutItem[] {
  return layout.filter(other =>
    other.i !== item.i
    && other.i !== DROPPING_ELEMENT_ID
    && !ignoreIds?.has(other.i)
    && layoutItemsOverlap(item, other),
  );
}

/** True if any child's stored (frame-relative) layout would fall outside a
 *  frame resized to `newW`x`newH` grid units. Boundary is inclusive — a child
 *  ending exactly at the new edge (x + w === newW) still fits, matching the
 *  edge-touching-is-not-overlap convention used by `layoutItemsOverlap`. */
export function wouldClipFrameChildren(
  children: readonly { layout: { x?: number | undefined; y?: number | undefined; w: number; h: number } }[],
  newW: number,
  newH: number,
): boolean {
  return children.some(child =>
    (child.layout.x ?? 0) + child.layout.w > newW || (child.layout.y ?? 0) + child.layout.h > newH,
  );
}

export type DragTargetResult =
  | { kind: 'valid' }
  | { kind: 'invalid' }
  | { kind: 'reparent'; frameId: string; frameLayout: LayoutItem };

function frameContainsTopLeft(item: LayoutItem, frame: LayoutItem): boolean {
  const withinX = item.x >= frame.x && item.x < frame.x + frame.w;
  const withinY = item.y >= frame.y && item.y < frame.y + frame.h;
  return withinX && withinY;
}

/** Classify a root-grid drag position. Non-frame items whose top-left lands
 *  inside a frame reparent into it; any other overlap is invalid. Frames never
 *  reparent — for them every overlap is invalid. */
export function evaluateRootDragTarget(
  item: LayoutItem,
  layout: readonly LayoutItem[],
  frameIds: ReadonlySet<string>,
): DragTargetResult {
  if (!frameIds.has(item.i)) {
    for (const other of layout) {
      if (other.i === item.i || !frameIds.has(other.i)) continue;
      if (frameContainsTopLeft(item, other)) {
        return { kind: 'reparent', frameId: other.i, frameLayout: other };
      }
    }
  }
  return findOverlappingItems(item, layout).length > 0 ? { kind: 'invalid' } : { kind: 'valid' };
}

export type ChildDragTarget =
  | { kind: 'same-frame' }
  | { kind: 'reparent-frame'; frameId: string }
  | { kind: 'reparent-root' }
  | { kind: 'invalid' };

/** Classify where a frame child's drag ended, from a DOM hit-test at the
 *  drop point. `hitFrameId` is the `data-frame-id` of whatever frame element
 *  (if any) is under the cursor; `isOverRootGrid` is whether the cursor is
 *  over the root grid's canvas at all. */
export function classifyChildDragTarget(
  ownFrameId: string,
  hitFrameId: string | null,
  isOverRootGrid: boolean,
): ChildDragTarget {
  if (hitFrameId === ownFrameId) return { kind: 'same-frame' };
  if (hitFrameId) return { kind: 'reparent-frame', frameId: hitFrameId };
  if (isOverRootGrid) return { kind: 'reparent-root' };
  return { kind: 'invalid' };
}

/** First position where `item` fits without overlapping `siblings`, scanning
 *  row-major from the requested spot. Used when reparenting/dropping into a
 *  frame whose target area is occupied — overlap must never persist. */
export function resolveNonOverlappingPosition(
  item: LayoutItem,
  siblings: readonly LayoutItem[],
  cols: number,
): { x: number; y: number } {
  const maxX = Math.max(0, cols - item.w);
  const startX = Math.min(Math.max(0, item.x), maxX);
  const startY = Math.max(0, item.y);

  const isFree = (x: number, y: number): boolean =>
    findOverlappingItems({ ...item, x, y }, siblings).length === 0;

  if (isFree(startX, startY)) return { x: startX, y: startY };

  // A row below the lowest sibling is always free, so the scan terminates.
  const bottom = siblings.reduce((max, s) => Math.max(max, s.y + s.h), 0);
  for (let y = startY; y <= bottom; y++) {
    for (let x = 0; x <= maxX; x++) {
      if (isFree(x, y)) return { x, y };
    }
  }
  return { x: 0, y: bottom };
}
