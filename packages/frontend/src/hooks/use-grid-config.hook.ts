import { useMemo } from 'react';
import { useSettings } from './use-settings.hook';

export interface GridConfig {
  /** Reference cell size in px, valid at `referenceWidth`. */
  rowHeight: number;
  /** Reference gap in px, valid at `referenceWidth`. */
  gap: number;
  /** Viewport width at which rowHeight/gap apply at 1:1 scale. */
  referenceWidth: number;
}

// Hardcoded fine-grid fallback — used when settings.yml has no grid block.
const DEFAULT_GRID: GridConfig = { rowHeight: 10, gap: 4, referenceWidth: 1920 };

export function useGridConfig(): GridConfig {
  const settings = useSettings();
  const grid = settings.grid;
  // Square cells: rowHeight is the reference cell size; columns are derived
  // once from rowHeight/gap/referenceWidth and stay constant across widths.
  const rowHeight = grid?.cellSize ?? DEFAULT_GRID.rowHeight;
  const gap = grid?.gap ?? DEFAULT_GRID.gap;
  const referenceWidth = grid?.referenceWidth ?? DEFAULT_GRID.referenceWidth;
  // Stable reference — this object is passed as a prop to memoized components.
  return useMemo(() => ({ rowHeight, gap, referenceWidth }), [rowHeight, gap, referenceWidth]);
}
