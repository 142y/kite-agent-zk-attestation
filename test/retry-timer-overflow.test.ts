import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeWithJitterRetry } from '../src/index.js';

describe('executeWithJitterRetry timer limits', () => {
  afterEach(() => vi.restoreAllMocks());

  it('never schedules a delay above the setTimeout maximum', async () => {
    const delays: number[] = [];
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
      delays.push(ms ?? 0);
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);
    vi.spyOn(Math, 'random').mockReturnValue(0.999999999);

    let attempts = 0;
    await executeWithJitterRetry(async () => {
      if (++attempts < 2) throw new Error('temporary failure');
      return 'ok';
    }, { maxRetries: 1, baseDelayMs: 1e10, maxDelayMs: 1e12 });

    expect(delays).toHaveLength(1);
    expect(delays[0]).toBeLessThanOrEqual(2_147_483_647);
    expect(delays[0]).toBeGreaterThan(1_000_000_000);
  });
});
