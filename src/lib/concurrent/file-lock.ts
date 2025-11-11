/**
 * File-based locking mechanism using atomic directory creation
 *
 * Uses mkdir as atomic operation - fails if directory already exists.
 * This is POSIX-compliant and works across all platforms.
 */

import { mkdir, rmdir } from 'fs/promises';

/**
 * Sleep helper for retry logic
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * FileLock - Exclusive file lock using directory creation
 *
 * @example
 * const lock = new FileLock('manifest.json');
 * await lock.withLock(async () => {
 *   // Critical section - only one process can execute this
 *   const data = await readFile('manifest.json');
 *   await writeFile('manifest.json', modified);
 * });
 */
export class FileLock {
  private lockDir: string;
  private acquired = false;

  /**
   * @param filepath - Path to file to lock (will create .lock directory)
   */
  constructor(filepath: string) {
    this.lockDir = `${filepath}.lock`;
  }

  /**
   * Acquire exclusive lock with timeout and retry
   *
   * @param timeoutMs - Maximum time to wait for lock (default 60s)
   * @throws Error if lock cannot be acquired within timeout
   */
  async acquire(timeoutMs = 60000): Promise<void> {
    const startTime = Date.now();
    const retryInterval = 100; // Check every 100ms

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Atomic operation: create directory (fails if exists)
        await mkdir(this.lockDir, { recursive: false });
        this.acquired = true;
        return;
      } catch (error: any) {
        if (error.code !== 'EEXIST') {
          // Unexpected error (permissions, etc.)
          throw error;
        }
        // Lock held by another process, wait and retry
        await sleep(retryInterval);
      }
    }

    throw new Error(
      `Failed to acquire lock for ${this.lockDir} after ${timeoutMs}ms. ` +
      `Another process may be holding the lock.`
    );
  }

  /**
   * Release lock by removing directory
   *
   * Safe to call multiple times - ignores ENOENT errors
   */
  async release(): Promise<void> {
    if (!this.acquired) {
      return;
    }

    try {
      await rmdir(this.lockDir);
      this.acquired = false;
    } catch (error: any) {
      // Lock directory already removed (benign - another process may have cleaned up)
      if (error.code !== 'ENOENT') {
        throw error;
      }
      this.acquired = false;
    }
  }

  /**
   * Execute function with exclusive lock protection
   *
   * Automatically acquires lock before executing, and releases after
   * (even if function throws error)
   *
   * @param fn - Async function to execute with lock held
   * @returns Result of fn
   *
   * @example
   * await lock.withLock(async () => {
   *   const data = JSON.parse(await readFile('data.json', 'utf-8'));
   *   data.counter++;
   *   await writeFile('data.json', JSON.stringify(data));
   * });
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      await this.release();
    }
  }

  /**
   * Check if lock is currently held by this instance
   */
  isAcquired(): boolean {
    return this.acquired;
  }
}
