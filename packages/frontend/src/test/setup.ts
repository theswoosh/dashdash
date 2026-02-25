import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom defines CSS but not CSS.supports — mock it so liquid-card.component.tsx
// doesn't throw at module load time.
if (typeof CSS === 'undefined') {
  (globalThis as Record<string, unknown>)['CSS'] = {};
}
if (typeof CSS.supports !== 'function') {
  (CSS as Record<string, unknown>)['supports'] = () => false;
}

// jsdom may provide a broken localStorage (--localstorage-file path issue).
// Replace it with a simple in-memory stub.
((): void => {
  const store = new Map<string, string>();
  const stub: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  };
  try {
    Object.defineProperty(globalThis, 'localStorage', { value: stub, writable: true, configurable: true });
  } catch { /* already non-configurable in some jsdom versions */ }
})();

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
