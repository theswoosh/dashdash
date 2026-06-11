import { useMemo } from 'react';
import { useSettings } from './use-settings.hook';

export interface GridConfig {
  rowHeight: number;
  gap: number;
}

const DEFAULT_GRID: GridConfig = { rowHeight: 40, gap: 4 };

export function useGridConfig(): GridConfig {
  const settings = useSettings();
  const grid = settings.grid;
  // Square cells: rowHeight is the active cell size; columns are derived to fill width.
  const rowHeight = grid?.cellSize ?? DEFAULT_GRID.rowHeight;
  const gap = grid?.gap ?? DEFAULT_GRID.gap;
  // Stable reference — this object is passed as a prop to memoized components.
  return useMemo(() => ({ rowHeight, gap }), [rowHeight, gap]);
}
