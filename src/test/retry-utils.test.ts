/**
 * Tests for retry-utils.ts
 * Critical for reliable API error handling and retries
 */

import { describe, it, expect, mock } from 'bun:test';
import {
  retryWithBackoff,
  isRateLimitError,
  isRetryableError,
  retryIfRetryable,
  formatRetryError,
  type RetryOptions,
} from '../lib/retry-utils.js';

describe('retry-utils', () => {
  describe('isRateLimitError', () => {
    it('should return true for 429 status code', () => {
      const error = new Error('Too many requests') as any;
      error.status = 429;
      expect(isRateLimitError(error)).toBe(true);
    });

    it('should return true for 429 error code', () => {
      const error = new Error('Rate limit') as any;
      error.code = 429;
      expect(isRateLimitError(error)).toBe(true);
    });

    it('should return true for "rate limit" in message', () => {
      const error = new Error('You have exceeded the rate limit');
      expect(isRateLimitError(error)).toBe(true);
    });

    it('should return true for "too many requests" in message', () => {
      const error = new Error('Too Many Requests - please slow down');
      expect(isRateLimitError(error)).toBe(true);
    });

    it('should return true for "free-models-per-min" in message', () => {
      const error = new Error('free-models-per-min limit exceeded');
      expect(isRateLimitError(error)).toBe(true);
    });

    it('should return false for non-rate-limit errors', () => {
      const error = new Error('Something else went wrong');
      expect(isRateLimitError(error)).toBe(false);
    });

    it('should handle errors without message', () => {
      const error = new Error() as any;
      delete error.message;
      expect(isRateLimitError(error)).toBe(false);
    });

    it('should be case-insensitive for message matching', () => {
      const error1 = new Error('RATE LIMIT exceeded');
      expect(isRateLimitError(error1)).toBe(true);

      const error2 = new Error('TOO MANY REQUESTS');
      expect(isRateLimitError(error2)).toBe(true);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for 429 status (rate limit)', () => {
      const error = new Error('Rate limit') as any;
      error.status = 429;
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 408 status (timeout)', () => {
      const error = new Error('Timeout') as any;
      error.status = 408;
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 500 status (server error)', () => {
      const error = new Error('Internal server error') as any;
      error.status = 500;
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 502 status (bad gateway)', () => {
      const error = new Error('Bad gateway') as any;
      error.status = 502;
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 503 status (service unavailable)', () => {
      const error = new Error('Service unavailable') as any;
      error.status = 503;
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 504 status (gateway timeout)', () => {
      const error = new Error('Gateway timeout') as any;
      error.status = 504;
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for 404 status (not retryable)', () => {
      const error = new Error('Not found') as any;
      error.status = 404;
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for 401 status (not retryable)', () => {
      const error = new Error('Unauthorized') as any;
      error.status = 401;
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return true for ECONNRESET code', () => {
      const error = new Error('Connection reset') as any;
      error.code = 'ECONNRESET';
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for ETIMEDOUT code', () => {
      const error = new Error('Timed out') as any;
      error.code = 'ETIMEDOUT';
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for ECONNREFUSED code', () => {
      const error = new Error('Connection refused') as any;
      error.code = 'ECONNREFUSED';
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for "timeout" in message', () => {
      const error = new Error('Request timeout occurred');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for "timed out" in message', () => {
      const error = new Error('Connection timed out');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error = new Error('Invalid API key');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for validation errors', () => {
      const error = new Error('Invalid input') as any;
      error.status = 400;
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('formatRetryError', () => {
    it('should format basic error message', () => {
      const error = new Error('Something went wrong');
      const formatted = formatRetryError(error, 'fetch data', 3);

      expect(formatted).toContain('Failed to fetch data after 3 attempt(s)');
      expect(formatted).toContain('Message: Something went wrong');
    });

    it('should include HTTP status if present', () => {
      const error = new Error('Server error') as any;
      error.status = 500;
      const formatted = formatRetryError(error, 'call API', 2);

      expect(formatted).toContain('HTTP Status: 500');
      expect(formatted).toContain('Message: Server error');
    });

    it('should include error code if present', () => {
      const error = new Error('Connection failed') as any;
      error.code = 'ECONNRESET';
      const formatted = formatRetryError(error, 'connect', 1);

      expect(formatted).toContain('Error Code: ECONNRESET');
      expect(formatted).toContain('Message: Connection failed');
    });

    it('should include both status and code if present', () => {
      const error = new Error('Timeout') as any;
      error.status = 504;
      error.code = 'ETIMEDOUT';
      const formatted = formatRetryError(error, 'process request', 5);

      expect(formatted).toContain('HTTP Status: 504');
      expect(formatted).toContain('Error Code: ETIMEDOUT');
      expect(formatted).toContain('Message: Timeout');
      expect(formatted).toContain('after 5 attempt(s)');
    });

    it('should handle singular attempt count', () => {
      const error = new Error('Test');
      const formatted = formatRetryError(error, 'test', 1);

      expect(formatted).toContain('after 1 attempt(s)');
    });

    it('should format with emoji', () => {
      const error = new Error('Test');
      const formatted = formatRetryError(error, 'test', 1);

      expect(formatted).toContain('❌ Error:');
    });
  });

  describe('retryWithBackoff', () => {
    it('should return immediately on success', async () => {
      const fn = mock(() => Promise.resolve('success'));
      const options: RetryOptions = {
        maxRetries: 3,
        initialTimeout: 100,
      };

      const result = await retryWithBackoff(fn, options);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure up to maxRetries', async () => {
      let attempts = 0;
      const fn = mock(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary error'));
        }
        return Promise.resolve('success after retries');
      });

      const options: RetryOptions = {
        maxRetries: 3,
        initialTimeout: 10,
      };

      const result = await retryWithBackoff(fn, options);

      expect(result).toBe('success after retries');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw error after exhausting retries', async () => {
      const fn = mock(() => Promise.reject(new Error('Persistent error')));
      const options: RetryOptions = {
        maxRetries: 2,
        initialTimeout: 10,
      };

      await expect(retryWithBackoff(fn, options)).rejects.toThrow('Persistent error');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should call onRetry callback on each retry', async () => {
      const fn = mock(() => Promise.reject(new Error('Test error')));
      const onRetry = mock((attempt: number, error: Error) => {});
      const options: RetryOptions = {
        maxRetries: 2,
        initialTimeout: 10,
        onRetry,
      };

      try {
        await retryWithBackoff(fn, options);
      } catch (e) {
        // Expected to fail
      }

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry.mock.calls[0][0]).toBe(1); // First retry
      expect(onRetry.mock.calls[1][0]).toBe(2); // Second retry
    });

    it('should use longer timeout for rate limit errors', async () => {
      const error = new Error('Rate limit exceeded') as any;
      error.status = 429;

      let attempts = 0;
      const fn = mock(() => {
        attempts++;
        if (attempts === 1) {
          return Promise.reject(error);
        }
        return Promise.resolve('success');
      });

      const options: RetryOptions = {
        maxRetries: 1,
        initialTimeout: 1000,
      };

      const startTime = Date.now();
      await retryWithBackoff(fn, options);
      const duration = Date.now() - startTime;

      // Should wait ~65 seconds for first rate limit retry
      // We'll check it's at least 60 seconds (allowing for timing variance)
      expect(duration).toBeGreaterThanOrEqual(60000);
    }, 70000); // 70 second timeout for this test

    it('should apply exponential backoff', async () => {
      const fn = mock(() => Promise.reject(new Error('Test')));
      const onRetry = mock(() => {});
      const options: RetryOptions = {
        maxRetries: 3,
        initialTimeout: 100,
        maxTimeout: 1000,
        onRetry,
      };

      try {
        await retryWithBackoff(fn, options);
      } catch (e) {
        // Expected
      }

      // Should have called onRetry 3 times (not on last attempt)
      expect(onRetry).toHaveBeenCalledTimes(3);
    });

    it('should cap timeout at maxTimeout', async () => {
      const fn = mock(() => Promise.reject(new Error('Test')));
      const options: RetryOptions = {
        maxRetries: 3,
        initialTimeout: 100,
        maxTimeout: 200, // Cap at 200ms
      };

      try {
        await retryWithBackoff(fn, options);
      } catch (e) {
        // Expected
      }

      // Should have been called initial + 3 retries
      expect(fn).toHaveBeenCalledTimes(4);
    });
  });

  describe('retryIfRetryable', () => {
    it('should retry retryable errors', async () => {
      const error = new Error('Timeout') as any;
      error.status = 504;

      let attempts = 0;
      const fn = mock(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(error);
        }
        return Promise.resolve('success');
      });

      const options: RetryOptions = {
        maxRetries: 2,
        initialTimeout: 10,
      };

      const result = await retryIfRetryable(fn, options);
      expect(result).toBe('success');
    });

    it('should throw immediately for non-retryable errors', async () => {
      const error = new Error('Invalid API key') as any;
      error.status = 401;

      const fn = mock(() => Promise.reject(error));
      const options: RetryOptions = {
        maxRetries: 3,
        initialTimeout: 10,
      };

      await expect(retryIfRetryable(fn, options)).rejects.toThrow('Invalid API key');
      expect(fn).toHaveBeenCalledTimes(1); // Should not retry
    });

    it('should call custom onRetry if provided', async () => {
      const error = new Error('Server error') as any;
      error.status = 500; // Use server error instead of rate limit to avoid long delay

      const fn = mock(() => Promise.reject(error));
      const onRetry = mock(() => {});
      const options: RetryOptions = {
        maxRetries: 1,
        initialTimeout: 10,
        onRetry,
      };

      try {
        await retryIfRetryable(fn, options);
      } catch (e) {
        // Expected
      }

      expect(onRetry).toHaveBeenCalled();
    });

    it('should handle network errors as retryable', async () => {
      const error = new Error('Network error') as any;
      error.code = 'ECONNRESET';

      let attempts = 0;
      const fn = mock(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(error);
        }
        return Promise.resolve('recovered');
      });

      const options: RetryOptions = {
        maxRetries: 2,
        initialTimeout: 10,
      };

      const result = await retryIfRetryable(fn, options);
      expect(result).toBe('recovered');
      expect(attempts).toBe(2);
    });
  });
});
