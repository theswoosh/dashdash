/** Minimum scale factor — guards against a collapsed/zero measured width
 *  (e.g. before first layout) shrinking cells to nothing. */
const MIN_SCALE = 0.2;

export interface GridScaleInput {
  /** Reference cell size in px, valid at `referenceWidth`. */
  cellSize: number;
  /** Reference gap in px, valid at `referenceWidth`. */
  gap: number;
  /** Viewport width at which cellSize/gap apply at 1:1 scale. */
  referenceWidth: number;
  /** Currently measured container width in px (0/NaN before first paint). */
  availableWidth: number;
}

export interface GridScaleResult {
  /** availableWidth / referenceWidth, clamped to [MIN_SCALE, +inf). */
  scale: number;
  /** Column count — constant regardless of availableWidth. */
  cols: number;
  /** Scaled cell size (rowHeight) in px. */
  rowHeight: number;
  /** Scaled gap in px. */
  gap: number;
  /** Total grid width in px (cols * scaled pitch - scaled gap). */
  gridWidth: number;
}

/** Fixed logical column count derived once from the reference cell size — it
 *  never changes with viewport width, so persisted layouts (in grid units)
 *  never get clamped into fewer columns. */
export function computeGridCols(cellSize: number, gap: number, referenceWidth: number): number {
  return Math.max(1, Math.floor((referenceWidth + gap) / (cellSize + gap)));
}

/** Derive the scaled cell size/gap/width for the current viewport, keeping
 *  the column count constant and cells square (colWidth ≈ rowHeight). */
export function computeGridScale({ cellSize, gap, referenceWidth, availableWidth }: GridScaleInput): GridScaleResult {
  const cols = computeGridCols(cellSize, gap, referenceWidth);
  const rawScale = availableWidth > 0 ? availableWidth / referenceWidth : 1;
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? Math.max(MIN_SCALE, rawScale) : 1;
  const rowHeight = cellSize * scale;
  const scaledGap = gap * scale;
  const gridWidth = cols * (rowHeight + scaledGap) - scaledGap;
  return { scale, cols, rowHeight, gap: scaledGap, gridWidth };
}
