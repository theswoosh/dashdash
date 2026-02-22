import '@testing-library/jest-dom';
import { vi } from 'vitest';

// LiquidCard uses ResizeObserver — mock it so jsdom doesn't throw.
// Must be a class (not an arrow function) to support `new ResizeObserver(...)`.
// Use globalThis instead of global — valid in browser (DOM) and Node alike.
(globalThis as Record<string, unknown>)['ResizeObserver'] = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Canvas getContext returns null in jsdom — mock enough for LiquidCard's
// displacement map to not crash during tests.
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => ({
    data: new Uint8ClampedArray(4),
    width: 1,
    height: 1,
  })),
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
