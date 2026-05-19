import { scopedLogger } from "../logger/logger";

const log = scopedLogger("retry");

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

const DEFAULT_OPTS: Required<Omit<RetryOptions, "onRetry">> = {
  maxAttempts: 3,
  delayMs: 1500,
  backoffMultiplier: 1.5,
};

/**
 * Executes `fn` up to `maxAttempts` times with exponential back-off.
 * Throws the last error if all attempts fail.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
  label = "operation",
): Promise<T> {
  const { maxAttempts, delayMs, backoffMultiplier } = { ...DEFAULT_OPTS, ...opts };

  let lastError: unknown;
  let wait = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      log.warn(`${label} failed (attempt ${attempt}/${maxAttempts})`, {
        error: err instanceof Error ? err.message : String(err),
      });

      if (opts.onRetry) opts.onRetry(attempt, err);

      if (attempt < maxAttempts) {
        await sleep(wait);
        wait = Math.floor(wait * backoffMultiplier);
      }
    }
  }

  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
