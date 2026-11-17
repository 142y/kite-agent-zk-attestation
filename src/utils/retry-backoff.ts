export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Return false to stop retrying and rethrow the error immediately. */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
}

function assertNonNegativeInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer, received ${value}`);
  }
}

export async function executeWithJitterRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 200, maxDelayMs = 3000, shouldRetry } = options;
  assertNonNegativeInteger('maxRetries', maxRetries);
  assertNonNegativeInteger('baseDelayMs', baseDelayMs);
  assertNonNegativeInteger('maxDelayMs', maxDelayMs);
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (err) {
      attempt++;
      if (attempt > maxRetries || (shouldRetry && !shouldRetry(err, attempt))) {
        throw err;
      }
      const expDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
      const jittered = Math.floor(Math.random() * expDelay);
      await new Promise(resolve => setTimeout(resolve, jittered));
    }
  }
}
