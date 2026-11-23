import { describe, expect, it, vi } from 'vitest';
import { executeWithJitterRetry } from '../src/index.js';

describe('executeWithJitterRetry', () => {
  it('retries a failed operation until it succeeds', async () => {
    let attempts = 0;
    const result = await executeWithJitterRetry(async () => {
      attempts++;
      if (attempts < 3) throw new Error('temporary failure');
      return 'ok';
    }, { maxRetries: 3, baseDelayMs: 0, maxDelayMs: 0 });
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });
  it('preserves the final error and stops after configured retries', async () => {
    const failure = new Error('unavailable');
    let attempts = 0;
    await expect(executeWithJitterRetry(async () => {
      attempts++;
      throw failure;
    }, { maxRetries: 2, baseDelayMs: 0, maxDelayMs: 0 })).rejects.toBe(failure);
    expect(attempts).toBe(3);
  });
  it('stops when shouldRetry returns false', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('invalid proof'));
    const shouldRetry = vi.fn().mockReturnValue(false);
    await expect(executeWithJitterRetry(operation, {
      baseDelayMs: 0, maxDelayMs: 0, shouldRetry,
    })).rejects.toThrow('invalid proof');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), 1);
  });
  it.each([
    [{ maxRetries: Number.NaN }, 'maxRetries'],
    [{ maxRetries: Number.POSITIVE_INFINITY }, 'maxRetries'],
    [{ maxRetries: Number.MAX_SAFE_INTEGER + 1 }, 'maxRetries'],
    [{ maxRetries: -1 }, 'maxRetries'],
    [{ maxRetries: 1.5 }, 'maxRetries'],
    [{ baseDelayMs: Number.NaN }, 'baseDelayMs'],
    [{ baseDelayMs: Number.POSITIVE_INFINITY }, 'baseDelayMs'],
    [{ baseDelayMs: -1 }, 'baseDelayMs'],
    [{ maxDelayMs: Number.NaN }, 'maxDelayMs'],
    [{ maxDelayMs: Number.POSITIVE_INFINITY }, 'maxDelayMs'],
    [{ maxDelayMs: -1 }, 'maxDelayMs'],
  ])('rejects invalid options before invoking operation: %o', async (options, field) => {
    const operation = vi.fn().mockResolvedValue('ok');
    await expect(executeWithJitterRetry(operation, options)).rejects.toThrow(field);
    expect(operation).not.toHaveBeenCalled();
  });

  it('rejects a non-function operation immediately instead of retrying it', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    try {
      await expect(
        executeWithJitterRetry(undefined as never, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 10 })
      ).rejects.toThrow('operation must be a function');
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it('never schedules a NaN delay when the exponent overflows', async () => {
    const delays: unknown[] = [];
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
      delays.push(ms);
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);
    try {
      await expect(
        executeWithJitterRetry(async () => { throw new Error('down'); }, {
          maxRetries: 1100, baseDelayMs: 0, maxDelayMs: 10,
        })
      ).rejects.toThrow('down');
      expect(delays).toHaveLength(1100);
      expect(delays.every((d) => Number.isFinite(d as number))).toBe(true);
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });
});
