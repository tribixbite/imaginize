/**
 * Atomic file write operations
 *
 * Uses temp file + rename pattern to ensure atomic writes.
 * Prevents partial writes and corruption if process crashes mid-write.
 */

import { writeFile, rename, unlink } from 'fs/promises';
import { randomBytes } from 'crypto';

/**
 * Atomically write data to file
 *
 * Strategy:
 * 1. Write to temporary file (.tmp.RANDOM)
 * 2. Rename temp file to target (atomic operation on POSIX)
 * 3. Clean up temp file on error
 *
 * This ensures the target file always contains either:
 * - Complete old data (if write fails)
 * - Complete new data (if write succeeds)
 * Never partial/corrupted data
 *
 * @param filepath - Target file path
 * @param data - Data to write
 * @param options - Write options (encoding, etc.)
 *
 * @example
 * await atomicWrite('manifest.json', JSON.stringify(data, null, 2));
 */
export async function atomicWrite(
  filepath: string,
  data: string | Buffer,
  options?: { encoding?: BufferEncoding }
): Promise<void> {
  // Generate random temp filename to avoid conflicts
  const randomSuffix = randomBytes(8).toString('hex');
  const tempPath = `${filepath}.tmp.${randomSuffix}`;

  try {
    // Step 1: Write to temp file
    await writeFile(tempPath, data, options);

    // Step 2: Atomic rename (POSIX guarantees this is atomic)
    // If process crashes here, temp file exists but target is unchanged
    await rename(tempPath, filepath);

    // Success - temp file has been renamed to target
  } catch (error) {
    // Clean up temp file on error
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors (file may not exist)
    }
    throw error;
  }
}

/**
 * Atomically write JSON data to file
 *
 * Convenience wrapper for writing JSON with formatting
 *
 * @param filepath - Target file path
 * @param data - Object to serialize as JSON
 * @param indent - Indentation (default 2)
 *
 * @example
 * await atomicWriteJSON('manifest.json', { version: '3.0.0', chapters: {} });
 */
export async function atomicWriteJSON(
  filepath: string,
  data: any,
  indent = 2
): Promise<void> {
  const json = JSON.stringify(data, null, indent);
  await atomicWrite(filepath, json, { encoding: 'utf-8' });
}
