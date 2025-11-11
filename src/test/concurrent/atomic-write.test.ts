/**
 * Tests for AtomicWrite - Corruption-proof file writes
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { atomicWrite, atomicWriteJSON } from '../../lib/concurrent/atomic-write.js';
import { readFile, unlink, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const TEST_DIR = join(process.cwd(), '.test-locks');
const TEST_FILE = join(TEST_DIR, 'test-atomic-file.txt');
const TEST_JSON_FILE = join(TEST_DIR, 'test-atomic.json');

describe('AtomicWrite', () => {
  beforeEach(async () => {
    // Ensure test directory exists
    try {
      await mkdir(TEST_DIR, { recursive: true });
    } catch {
      // Ignore if exists
    }

    // Clean up test files
    try {
      await unlink(TEST_FILE);
    } catch {
      // Ignore
    }
    try {
      await unlink(TEST_JSON_FILE);
    } catch {
      // Ignore
    }

    // Clean up any temp files
    const files = await readdir(TEST_DIR);
    for (const file of files) {
      if (file.includes('.tmp.')) {
        try {
          await unlink(join(TEST_DIR, file));
        } catch {
          // Ignore
        }
      }
    }
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await unlink(TEST_FILE);
    } catch {
      // Ignore
    }
    try {
      await unlink(TEST_JSON_FILE);
    } catch {
      // Ignore
    }
  });

  test('writes file atomically', async () => {
    const content = 'Hello, atomic world!';

    await atomicWrite(TEST_FILE, content);

    expect(existsSync(TEST_FILE)).toBe(true);

    const read = await readFile(TEST_FILE, 'utf-8');
    expect(read).toBe(content);
  });

  test('overwrites existing file correctly', async () => {
    // Write initial content
    await atomicWrite(TEST_FILE, 'Initial content');

    // Overwrite with new content
    await atomicWrite(TEST_FILE, 'Updated content');

    const read = await readFile(TEST_FILE, 'utf-8');
    expect(read).toBe('Updated content');
  });

  test('does not leave temp files behind on success', async () => {
    await atomicWrite(TEST_FILE, 'Test content');

    // Check for temp files
    const files = await readdir(TEST_DIR);
    const tempFiles = files.filter(f => f.includes('.tmp.'));

    expect(tempFiles.length).toBe(0);
  });

  test('cleans up temp file on error', async () => {
    // Attempt write to invalid path (should fail)
    let errorThrown = false;
    try {
      await atomicWrite('/invalid/path/file.txt', 'content');
    } catch {
      errorThrown = true;
    }

    expect(errorThrown).toBe(true);

    // Should not leave temp files in current directory
    const files = await readdir(TEST_DIR);
    const tempFiles = files.filter(f => f.includes('.tmp.'));

    expect(tempFiles.length).toBe(0);
  });

  test('handles binary data correctly', async () => {
    const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"

    await atomicWrite(TEST_FILE, buffer);

    const read = await readFile(TEST_FILE);
    expect(Buffer.compare(read, buffer)).toBe(0);
  });

  test('preserves encoding options', async () => {
    const content = 'Test with UTF-8: 你好';

    await atomicWrite(TEST_FILE, content, { encoding: 'utf-8' });

    const read = await readFile(TEST_FILE, 'utf-8');
    expect(read).toBe(content);
  });

  test('atomicWriteJSON writes valid JSON', async () => {
    const data = {
      name: 'Test',
      count: 42,
      nested: { value: true }
    };

    await atomicWriteJSON(TEST_JSON_FILE, data);

    expect(existsSync(TEST_JSON_FILE)).toBe(true);

    const content = await readFile(TEST_JSON_FILE, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed).toEqual(data);
  });

  test('atomicWriteJSON formats with indentation', async () => {
    const data = { a: 1, b: 2 };

    await atomicWriteJSON(TEST_JSON_FILE, data, 2);

    const content = await readFile(TEST_JSON_FILE, 'utf-8');

    // Should be indented
    expect(content).toContain('  "a": 1');
    expect(content).toContain('  "b": 2');
  });

  test('atomicWriteJSON with custom indentation', async () => {
    const data = { test: 'value' };

    await atomicWriteJSON(TEST_JSON_FILE, data, 4);

    const content = await readFile(TEST_JSON_FILE, 'utf-8');

    // Should use 4 spaces
    expect(content).toContain('    "test": "value"');
  });

  test('multiple concurrent writes complete successfully', async () => {
    const writes = [
      atomicWrite(join(TEST_DIR, 'file1.txt'), 'Content 1'),
      atomicWrite(join(TEST_DIR, 'file2.txt'), 'Content 2'),
      atomicWrite(join(TEST_DIR, 'file3.txt'), 'Content 3')
    ];

    await Promise.all(writes);

    const content1 = await readFile(join(TEST_DIR, 'file1.txt'), 'utf-8');
    const content2 = await readFile(join(TEST_DIR, 'file2.txt'), 'utf-8');
    const content3 = await readFile(join(TEST_DIR, 'file3.txt'), 'utf-8');

    expect(content1).toBe('Content 1');
    expect(content2).toBe('Content 2');
    expect(content3).toBe('Content 3');

    // Cleanup
    await unlink(join(TEST_DIR, 'file1.txt'));
    await unlink(join(TEST_DIR, 'file2.txt'));
    await unlink(join(TEST_DIR, 'file3.txt'));
  });
});
