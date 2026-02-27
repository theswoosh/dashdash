import { useSettings } from './use-settings.hook';

export interface GridConfig {
  columns: number;
  rowHeight: number;
  gap: number;
}

const DEFAULT_GRID: GridConfig = { columns: 12, rowHeight: 80, gap: 12 };

export function useGridConfig(): GridConfig {
  const settings = useSettings();
  return {
    columns: settings.grid?.columns ?? DEFAULT_GRID.columns,
    rowHeight: settings.grid?.rowHeight ?? DEFAULT_GRID.rowHeight,
    gap: settings.grid?.gap ?? DEFAULT_GRID.gap,
  };
}
