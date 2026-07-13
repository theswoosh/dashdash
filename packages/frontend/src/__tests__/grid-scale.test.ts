import { describe, it, expect } from 'vitest';
import { computeGridCols, computeGridScale } from '../utils/grid-scale';

const REFERENCE = { cellSize: 10, gap: 4, referenceWidth: 1920 };

describe('computeGridCols', () => {
  it('matches the documented ~137 columns at defaults', () => {
    expect(computeGridCols(REFERENCE.cellSize, REFERENCE.gap, REFERENCE.referenceWidth)).toBe(137);
  });

  it('never goes below 1', () => {
    expect(computeGridCols(500, 0, 100)).toBe(1);
  });
});

describe('computeGridScale', () => {
  it('keeps cols constant across widths', () => {
    const narrow = computeGridScale({ ...REFERENCE, availableWidth: 1200 });
    const wide = computeGridScale({ ...REFERENCE, availableWidth: 3840 });
    expect(narrow.cols).toBe(wide.cols);
    expect(narrow.cols).toBe(computeGridCols(REFERENCE.cellSize, REFERENCE.gap, REFERENCE.referenceWidth));
  });

  it('scales rowHeight and gap linearly with availableWidth', () => {
    const half = computeGridScale({ ...REFERENCE, availableWidth: REFERENCE.referenceWidth / 2 });
    expect(half.scale).toBeCloseTo(0.5, 10);
    expect(half.rowHeight).toBeCloseTo(REFERENCE.cellSize * 0.5, 10);
    expect(half.gap).toBeCloseTo(REFERENCE.gap * 0.5, 10);
  });

  it('yields scale 1 at exactly the reference width', () => {
    const result = computeGridScale({ ...REFERENCE, availableWidth: REFERENCE.referenceWidth });
    expect(result.scale).toBeCloseTo(1, 10);
    expect(result.rowHeight).toBeCloseTo(REFERENCE.cellSize, 10);
    expect(result.gap).toBeCloseTo(REFERENCE.gap, 10);
  });

  it('clamps scale to a minimum instead of collapsing to zero', () => {
    const tiny = computeGridScale({ ...REFERENCE, availableWidth: 1 });
    expect(tiny.scale).toBeGreaterThanOrEqual(0.2);
    expect(tiny.rowHeight).toBeGreaterThan(0);
  });

  it('defaults to scale 1 when availableWidth is 0 or unknown', () => {
    const zero = computeGridScale({ ...REFERENCE, availableWidth: 0 });
    expect(zero.scale).toBe(1);
    expect(zero.rowHeight).toBeCloseTo(REFERENCE.cellSize, 10);
  });

  it('preserves the squareness invariant: RGL colWidth derives to ~rowHeight', () => {
    const result = computeGridScale({ ...REFERENCE, availableWidth: 1200 });
    const colWidth = (result.gridWidth - result.gap * (result.cols - 1)) / result.cols;
    expect(colWidth).toBeCloseTo(result.rowHeight, 6);
  });
});
