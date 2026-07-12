import type { LayoutItem } from 'react-grid-layout';
import type { ServiceConfig } from '@dashdash/types';

export interface GridConfigLike {
  rowHeight: number;
  gap: number;
}

// Tiny-layout widgets (options.layoutSize === 'tiny') render as a header-only
// bar via CSS. The grid item must be pinned to that bar height — otherwise the
// drag ghost and collision footprint keep the full stored height behind a
// visually small widget.
const TINY_LAYOUT_BAR_PX = 38;

export function isTinyLayoutService(service: ServiceConfig): boolean {
  return service.options?.['layoutSize'] === 'tiny';
}

export function tinyLayoutHeightUnits(grid: GridConfigLike): number {
  const pitch = grid.rowHeight + grid.gap;
  return Math.max(1, Math.round((TINY_LAYOUT_BAR_PX + grid.gap) / pitch));
}

/** Build the RGL item for a service. Tiny-layout services get their height
 *  pinned (h = minH = maxH) to the bar height so it cannot be resized vertically. */
export function serviceAsGridItem(service: ServiceConfig, grid: GridConfigLike): LayoutItem {
  const item: LayoutItem = {
    i: service.id,
    x: service.layout.x ?? 0,
    y: service.layout.y ?? 0,
    w: service.layout.w,
    h: service.layout.h,
  };
  if (!isTinyLayoutService(service)) return item;
  const h = tinyLayoutHeightUnits(grid);
  return { ...item, h, minH: h, maxH: h };
}

/** Height to persist to YAML. Tiny services keep their stored height so
 *  switching back to the normal layout restores the previous size. */
export function persistedHeight(item: LayoutItem, services: ServiceConfig[]): number {
  const service = services.find(s => s.id === item.i);
  return service && isTinyLayoutService(service) ? service.layout.h : item.h;
}

function isPinnedHeight(item: LayoutItem): boolean {
  return item.minH !== undefined && item.minH === item.maxH;
}

/** Merge in-progress edit-mode positions onto a freshly rebuilt YAML layout.
 *
 *  Positions and sizes the user changed during the edit session win — except
 *  the height of items whose tiny-layout pinning changed: toggling layoutSize
 *  rebuilds the item with (or without) h = minH = maxH, and keeping the stale
 *  height would leave an invisible full-size footprint behind a bar-sized
 *  card (oversized drag ghost, phantom collisions) or a bar-sized footprint
 *  behind a restored card. Structural constraints (minH/maxH) always come
 *  from the rebuilt item. */
export function mergeEditModeLayout(
  prev: readonly LayoutItem[],
  fromYaml: readonly LayoutItem[],
): LayoutItem[] {
  const prevMap = new Map(prev.map(l => [l.i, l]));
  return fromYaml.map(item => {
    const prevItem = prevMap.get(item.i);
    if (!prevItem) return item;
    const h = isPinnedHeight(item) || isPinnedHeight(prevItem) ? item.h : prevItem.h;
    return { ...item, x: prevItem.x, y: prevItem.y, w: prevItem.w, h };
  });
}
