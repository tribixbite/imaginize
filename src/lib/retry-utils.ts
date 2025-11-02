/**
 * Retry logic with exponential backoff for API calls
 */

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
    maxTimeout = 60000, // 60 seconds max
    onRetry,
  } = options;

  let lastError: Error;
  let timeout = initialTimeout;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      // Wait with exponential backoff
      await sleep(timeout);

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
 * Check if error is retryable (rate limit, timeout, network issues)
 */
export function isRetryableError(error: any): boolean {
  // HTTP status codes that should be retried
  const retryableStatuses = [408, 429, 500, 502, 503, 504];

  if (error.status && retryableStatuses.includes(error.status)) {
    return true;
  }

  if (error.code) {
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

    if (retryableCodes.includes(error.code)) {
      return true;
    }
  }

  // Check error message for rate limit indicators
  const message = error.message?.toLowerCase() || '';
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
  try {
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
  } catch (error) {
    throw error;
  }
}

/**
 * Format retry error message for user
 */
export function formatRetryError(
  error: Error,
  context: string,
  attempts: number
): string {
  const lines: string[] = [];

  lines.push(`❌ Error: Failed to ${context} after ${attempts} attempt(s)`);
  lines.push('');

  // Extract useful error info
  if ((error as any).status) {
    lines.push(`HTTP Status: ${(error as any).status}`);
  }

  if ((error as any).code) {
    lines.push(`Error Code: ${(error as any).code}`);
  }

  lines.push(`Message: ${error.message}`);

  return lines.join('\n');
}
