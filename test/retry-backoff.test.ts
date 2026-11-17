import { describe, expect, it } from 'vitest';
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

  it('preserves the final error and stops after the configured retries', async () => {
    const failure = new Error('unavailable');
    let attempts = 0;
    const operation = async () => {
      attempts++;
      throw failure;
    };

    await expect(executeWithJitterRetry(operation, {
      maxRetries: 2,
      baseDelayMs: 0,
      maxDelayMs: 0,
    })).rejects.toBe(failure);
    expect(attempts).toBe(3);
  });

  it.each([
    [{ maxRetries: Number.NaN }, 'maxRetries'],
    [{ maxRetries: Number.POSITIVE_INFINITY }, 'maxRetries'],
    [{ maxRetries: -1 }, 'maxRetries'],
    [{ maxRetries: 1.5 }, 'maxRetries'],
    [{ baseDelayMs: Number.NaN }, 'baseDelayMs'],
    [{ baseDelayMs: Number.POSITIVE_INFINITY }, 'baseDelayMs'],
    [{ baseDelayMs: -1 }, 'baseDelayMs'],
    [{ maxDelayMs: Number.NaN }, 'maxDelayMs'],
    [{ maxDelayMs: Number.POSITIVE_INFINITY }, 'maxDelayMs'],
    [{ maxDelayMs: -1 }, 'maxDelayMs'],
  ])('rejects invalid options before invoking the operation: %o', async (options, field) => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      throw new Error('temporary failure');
    };

    await expect(executeWithJitterRetry(operation, options)).rejects.toThrow(field);
    expect(attempts).toBe(0);
  });
});
