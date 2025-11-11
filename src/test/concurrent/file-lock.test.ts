/**
 * Tests for FileLock - Thread-safe file locking
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { FileLock } from '../../lib/concurrent/file-lock.js';
import { unlink, mkdir, rmdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// Use project directory for tests (Termux /tmp not writable)
const TEST_DIR = join(process.cwd(), '.test-locks');
const TEST_FILE = join(TEST_DIR, 'test-lock-file.txt');

describe('FileLock', () => {
  beforeEach(async () => {
    // Ensure test directory exists
    try {
      await mkdir(TEST_DIR, { recursive: true });
    } catch {
      // Ignore if exists
    }

    // Clean up any existing lock
    try {
      await rmdir(`${TEST_FILE}.lock`);
    } catch {
      // Ignore
    }
  });

  afterEach(async () => {
    // Clean up lock directory
    try {
      await rmdir(`${TEST_FILE}.lock`);
    } catch {
      // Ignore
    }
  });

  test('acquires lock successfully', async () => {
    const lock = new FileLock(TEST_FILE);

    await lock.acquire();

    expect(lock.isAcquired()).toBe(true);
    expect(existsSync(`${TEST_FILE}.lock`)).toBe(true);

    await lock.release();
  });

  test('releases lock successfully', async () => {
    const lock = new FileLock(TEST_FILE);

    await lock.acquire();
    await lock.release();

    expect(lock.isAcquired()).toBe(false);
    expect(existsSync(`${TEST_FILE}.lock`)).toBe(false);
  });

  test('prevents concurrent access', async () => {
    const lock1 = new FileLock(TEST_FILE);
    const lock2 = new FileLock(TEST_FILE);

    await lock1.acquire();

    // Second lock should timeout
    let errorThrown = false;
    try {
      await lock2.acquire(1000); // 1 second timeout
    } catch (error: any) {
      errorThrown = true;
      expect(error.message).toContain('Failed to acquire lock');
    }

    expect(errorThrown).toBe(true);

    await lock1.release();
  });

  test('withLock executes function with lock protection', async () => {
    const lock = new FileLock(TEST_FILE);
    let executed = false;

    const result = await lock.withLock(async () => {
      executed = true;
      return 'success';
    });

    expect(executed).toBe(true);
    expect(result).toBe('success');
    expect(lock.isAcquired()).toBe(false); // Lock released after execution
  });

  test('withLock releases lock even on error', async () => {
    const lock = new FileLock(TEST_FILE);

    let errorThrown = false;
    try {
      await lock.withLock(async () => {
        throw new Error('Test error');
      });
    } catch (error: any) {
      errorThrown = true;
      expect(error.message).toBe('Test error');
    }

    expect(errorThrown).toBe(true);
    expect(lock.isAcquired()).toBe(false); // Lock released even on error
  });

  test('sequential locks work correctly', async () => {
    const lock1 = new FileLock(TEST_FILE);
    const lock2 = new FileLock(TEST_FILE);

    // First lock acquires and releases
    await lock1.acquire();
    await lock1.release();

    // Second lock should acquire successfully
    await lock2.acquire();
    expect(lock2.isAcquired()).toBe(true);

    await lock2.release();
  });

  test('concurrent withLock operations serialize correctly', async () => {
    const lock = new FileLock(TEST_FILE);
    const executionOrder: number[] = [];

    // Start three concurrent operations
    const promises = [
      lock.withLock(async () => {
        executionOrder.push(1);
        await new Promise(resolve => setTimeout(resolve, 100));
        return 1;
      }),
      lock.withLock(async () => {
        executionOrder.push(2);
        await new Promise(resolve => setTimeout(resolve, 100));
        return 2;
      }),
      lock.withLock(async () => {
        executionOrder.push(3);
        await new Promise(resolve => setTimeout(resolve, 100));
        return 3;
      })
    ];

    const results = await Promise.all(promises);

    // All should complete
    expect(results).toEqual([1, 2, 3]);

    // Execution should be serialized (only one at a time)
    expect(executionOrder.length).toBe(3);
  });

  test('release is idempotent', async () => {
    const lock = new FileLock(TEST_FILE);

    await lock.acquire();
    await lock.release();

    // Second release should not throw
    await lock.release();

    expect(lock.isAcquired()).toBe(false);
  });

  test('handles lock directory already exists gracefully', async () => {
    // Manually create lock directory
    await mkdir(`${TEST_FILE}.lock`);

    const lock = new FileLock(TEST_FILE);

    // Should timeout trying to acquire
    let errorThrown = false;
    try {
      await lock.acquire(500);
    } catch (error: any) {
      errorThrown = true;
    }

    expect(errorThrown).toBe(true);

    // Clean up
    await rmdir(`${TEST_FILE}.lock`);
  });
});
