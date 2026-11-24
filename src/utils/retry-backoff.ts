/** Largest delay setTimeout supports; larger values fire after ~1ms instead. */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Return false to stop retrying and rethrow the error immediately. */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
}

export async function executeWithJitterRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 200, maxDelayMs = 3000, shouldRetry } = options;

  if (!Number.isSafeInteger(maxRetries) || maxRetries < 0) {
    throw new RangeError('maxRetries must be a non-negative safe integer');
  }
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
    throw new RangeError('baseDelayMs must be a non-negative finite number');
  }
  if (!Number.isFinite(maxDelayMs) || maxDelayMs < 0) {
    throw new RangeError('maxDelayMs must be a non-negative finite number');
  }

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (err) {
      attempt++;
      if (attempt > maxRetries || (shouldRetry && !shouldRetry(err, attempt))) {
        throw err;
      }
      const expDelay = Math.min(maxDelayMs, MAX_TIMER_DELAY_MS, baseDelayMs * Math.pow(2, attempt));
      const jittered = Math.floor(Math.random() * expDelay);
      await new Promise(resolve => setTimeout(resolve, jittered));
    }
  }
}
