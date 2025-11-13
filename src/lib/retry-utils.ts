/**
 * Retry logic with exponential backoff for API calls
 */

/**
 * Error object with optional HTTP status and code properties
 */
interface RetryableError extends Error {
  status?: number;
  code?: string | number;
}

export interface RetryOptions {
  maxRetries: number;
  initialTimeout: number;
  maxTimeout?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxRetries,
    initialTimeout,
    maxTimeout = 120000, // 120 seconds max (for rate limits)
    onRetry,
  } = options;

  let lastError: Error;
  let timeout = initialTimeout;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Check if this is a rate limit error - use longer timeout
      const isRateLimit = isRateLimitError(error);
      let waitTime = timeout;

      if (isRateLimit) {
        // For rate limits, wait longer (60s for OpenRouter free tier)
        waitTime = attempt === 0 ? 65000 : Math.min(timeout * 2, 120000);
      }

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      // Wait with exponential backoff
      await sleep(waitTime);

      // Double timeout for next attempt, capped at maxTimeout
      timeout = Math.min(timeout * 2, maxTimeout);
    }
  }

  throw lastError!;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is a rate limit error (429 status)
 */
export function isRateLimitError(error: unknown): boolean {
  const err = error as RetryableError;

  // Check for 429 status
  if (err.status === 429 || err.code === 429) {
    return true;
  }

  // Check error message for rate limit indicators
  const message = err.message?.toLowerCase() || '';
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('free-models-per-min')
  ) {
    return true;
  }

  return false;
}

/**
 * Check if error is retryable (rate limit, timeout, network issues)
 */
export function isRetryableError(error: unknown): boolean {
  const err = error as RetryableError;
  // HTTP status codes that should be retried
  const retryableStatuses = [408, 429, 500, 502, 503, 504];

  if (err.status && retryableStatuses.includes(err.status)) {
    return true;
  }

  if (err.code) {
    const retryableCodes = [
      'ECONNRESET',
      'ENOTFOUND',
      'ESOCKETTIMEDOUT',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'EHOSTUNREACH',
      'EPIPE',
      'EAI_AGAIN',
    ];

    if (typeof err.code === 'string' && retryableCodes.includes(err.code)) {
      return true;
    }
  }

  // Check error message for rate limit indicators
  const message = err.message?.toLowerCase() || '';
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('timeout') ||
    message.includes('timed out')
  ) {
    return true;
  }

  return false;
}

/**
 * Retry only if error is retryable
 */
export async function retryIfRetryable<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  return await retryWithBackoff(fn, {
    ...options,
    onRetry: (attempt, error) => {
      if (!isRetryableError(error)) {
        // Don't retry non-retryable errors
        throw error;
      }
      options.onRetry?.(attempt, error);
    },
  });
}

/**
 * Format retry error message for user
 */
export function formatRetryError(
  error: Error,
  context: string,
  attempts: number
): string {
  const err = error as RetryableError;
  const lines: string[] = [];

  lines.push(`❌ Error: Failed to ${context} after ${attempts} attempt(s)`);
  lines.push('');

  // Extract useful error info
  if (err.status) {
    lines.push(`HTTP Status: ${err.status}`);
  }

  if (err.code) {
    lines.push(`Error Code: ${err.code}`);
  }

  lines.push(`Message: ${err.message}`);

  return lines.join('\n');
}
