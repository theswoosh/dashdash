import { describe, it, expect } from 'vitest';
import { statsHandler } from '../handler.js';

describe('statsHandler', () => {
  it('always includes diskUsedPct and cpuTempC keys (possibly null)', async () => {
    const data = await statsHandler.fetchData({}, {} as never) as Record<string, unknown>;
    expect('diskUsedPct' in data).toBe(true);
    expect('cpuTempC' in data).toBe(true);
    if (data['diskUsedPct'] !== null) {
      expect(data['diskUsedPct']).toBeGreaterThanOrEqual(0);
      expect(data['diskUsedPct']).toBeLessThanOrEqual(100);
    }
  });
});
