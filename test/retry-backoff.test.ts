import { describe, it, expect, vi } from 'vitest';
import { executeWithJitterRetry } from '../src/utils/retry-backoff.js';

const fast = { baseDelayMs: 0, maxDelayMs: 0 };

describe('executeWithJitterRetry', () => {
  it('returns the result once the operation succeeds', async () => {
    const op = vi.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('ok');
    await expect(executeWithJitterRetry(op, fast)).resolves.toBe('ok');
    expect(op).toHaveBeenCalledTimes(2);
  });

  it('rethrows the last error after maxRetries attempts', async () => {
    const op = vi.fn().mockRejectedValue(new Error('down'));
    await expect(executeWithJitterRetry(op, { ...fast, maxRetries: 2 })).rejects.toThrow('down');
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('stops early when shouldRetry returns false', async () => {
    const op = vi.fn().mockRejectedValue(new Error('invalid proof'));
    const shouldRetry = vi.fn().mockReturnValue(false);
    await expect(executeWithJitterRetry(op, { ...fast, shouldRetry })).rejects.toThrow('invalid proof');
    expect(op).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), 1);
  });

  it.each([
    ['maxRetries', -1],
    ['maxRetries', 1.5],
    ['baseDelayMs', Number.NaN],
    ['maxDelayMs', -10],
  ])('rejects invalid %s (%s) without invoking the operation', async (key, value) => {
    const op = vi.fn().mockResolvedValue('ok');
    await expect(executeWithJitterRetry(op, { [key]: value })).rejects.toThrow(RangeError);
    expect(op).not.toHaveBeenCalled();
  });
});
