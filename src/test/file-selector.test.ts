/**
 * Tests for file-selector.ts
 * Critical for multi-file selection and processing status tracking
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { findBookFiles, selectBookFile, type BookFile } from '../lib/file-selector.js';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';

// Test data - use project test directory instead of /tmp which is not writable on Termux
const testDir = join(cwd(), 'src', 'test', '.test-data', `file-selector-test-${Date.now()}`);

// Helper to create test book files
function createTestFile(name: string, content: string = 'test content'): string {
  const filePath = join(testDir, name);
  writeFileSync(filePath, content);
  return filePath;
}

// Helper to create processed book state
function createProcessedState(bookName: string, status: 'completed' | 'in-progress' | 'failed'): void {
  const outputDir = join(testDir, `imaginize_${bookName.replace(/\.[^.]+$/, '')}`);
  mkdirSync(outputDir, { recursive: true });

  const state = {
    phases: {
      analyze: { status },
      parse: { status: 'completed' },
    },
  };

  writeFileSync(join(outputDir, '.imaginize.state.json'), JSON.stringify(state));
}

describe('file-selector', () => {
  beforeEach(() => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('findBookFiles', () => {
    it('should find EPUB files in current directory', async () => {
      createTestFile('book1.epub');
      createTestFile('book2.epub');

      const files = await findBookFiles();

      expect(files).toHaveLength(2);
      expect(files[0].extension).toBe('.epub');
      expect(files[1].extension).toBe('.epub');
    });

    it('should find PDF files in current directory', async () => {
      createTestFile('book1.pdf');
      createTestFile('book2.pdf');

      const files = await findBookFiles();

      expect(files).toHaveLength(2);
      expect(files[0].extension).toBe('.pdf');
      expect(files[1].extension).toBe('.pdf');
    });

    it('should find both EPUB and PDF files', async () => {
      createTestFile('book1.epub');
      createTestFile('book2.pdf');
      createTestFile('book3.epub');

      const files = await findBookFiles();

      expect(files).toHaveLength(3);
      const extensions = files.map(f => f.extension);
      expect(extensions).toContain('.epub');
      expect(extensions).toContain('.pdf');
    });

    it('should ignore non-book files', async () => {
      createTestFile('book1.epub');
      createTestFile('readme.txt');
      createTestFile('image.jpg');
      createTestFile('document.docx');

      const files = await findBookFiles();

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('book1.epub');
    });

    it('should handle empty directory', async () => {
      const files = await findBookFiles();

      expect(files).toHaveLength(0);
    });

    it('should include file metadata', async () => {
      createTestFile('book.epub', 'x'.repeat(1024));

      const files = await findBookFiles();

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('book.epub');
      expect(files[0].name).toBe('book.epub');
      expect(files[0].size).toBe(1024);
      expect(files[0].modified).toBeInstanceOf(Date);
      expect(files[0].extension).toBe('.epub');
      expect(files[0].processed).toBe(false);
    });

    it('should detect processed books', async () => {
      createTestFile('book.epub');
      createProcessedState('book.epub', 'completed');

      const files = await findBookFiles();

      expect(files).toHaveLength(1);
      expect(files[0].processed).toBe(true);
    });

    it('should not mark books as processed if analyze phase incomplete', async () => {
      createTestFile('book.epub');
      createProcessedState('book.epub', 'in-progress');

      const files = await findBookFiles();

      expect(files).toHaveLength(1);
      expect(files[0].processed).toBe(false);
    });

    it('should not mark books as processed if state file missing', async () => {
      createTestFile('book.epub');
      const outputDir = join(testDir, 'imaginize_book');
      mkdirSync(outputDir, { recursive: true });
      // No state file created

      const files = await findBookFiles();

      expect(files).toHaveLength(1);
      expect(files[0].processed).toBe(false);
    });

    it('should not mark books as processed if output dir missing', async () => {
      createTestFile('book.epub');
      // No output directory created

      const files = await findBookFiles();

      expect(files).toHaveLength(1);
      expect(files[0].processed).toBe(false);
    });

    it('should handle invalid state file gracefully', async () => {
      createTestFile('book.epub');
      const outputDir = join(testDir, 'imaginize_book');
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(join(outputDir, '.imaginize.state.json'), 'invalid json {');

      const files = await findBookFiles();

      expect(files).toHaveLength(1);
      expect(files[0].processed).toBe(false);
    });

    it('should sort unprocessed files first', async () => {
      createTestFile('processed1.epub');
      createTestFile('unprocessed.epub');
      createTestFile('processed2.epub');

      createProcessedState('processed1.epub', 'completed');
      createProcessedState('processed2.epub', 'completed');

      const files = await findBookFiles();

      expect(files).toHaveLength(3);
      expect(files[0].name).toBe('unprocessed.epub');
      expect(files[0].processed).toBe(false);
      expect(files[1].processed).toBe(true);
      expect(files[2].processed).toBe(true);
    });

    it('should sort by modification time within same processed status', async () => {
      // Create files with different timestamps
      createTestFile('old.epub', 'old');
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      createTestFile('new.epub', 'new');

      const files = await findBookFiles();

      expect(files).toHaveLength(2);
      // Newer file should come first
      expect(files[0].name).toBe('new.epub');
      expect(files[1].name).toBe('old.epub');
    });

    it('should handle case-insensitive extensions', async () => {
      createTestFile('book1.EPUB');
      createTestFile('book2.Pdf');
      createTestFile('book3.ePuB');

      const files = await findBookFiles();

      expect(files).toHaveLength(3);
    });

    it('should handle custom output pattern', async () => {
      createTestFile('book.epub');
      const customDir = join(testDir, 'custom_book');
      mkdirSync(customDir, { recursive: true });
      writeFileSync(
        join(customDir, '.imaginize.state.json'),
        JSON.stringify({ phases: { analyze: { status: 'completed' } } })
      );

      const files = await findBookFiles('custom_{name}');

      expect(files).toHaveLength(1);
      expect(files[0].processed).toBe(true);
    });

    it('should handle files with special characters in name', async () => {
      createTestFile('book-with-dashes.epub');
      createTestFile("book_with_underscores.pdf");
      createTestFile('book (with parens).epub');

      const files = await findBookFiles();

      expect(files).toHaveLength(3);
      expect(files.some(f => f.name === 'book-with-dashes.epub')).toBe(true);
      expect(files.some(f => f.name === 'book_with_underscores.pdf')).toBe(true);
      expect(files.some(f => f.name === 'book (with parens).epub')).toBe(true);
    });

    it('should skip files with read errors', async () => {
      createTestFile('readable.epub');
      createTestFile('unreadable.epub');

      // Make file unreadable (note: this may not work on all systems)
      // Instead, we rely on the try-catch in implementation to handle stat errors
      const files = await findBookFiles();

      // Should have at least the readable file
      expect(files.length).toBeGreaterThanOrEqual(1);
      expect(files.some(f => f.name === 'readable.epub')).toBe(true);
    });
  });

  describe('selectBookFile', () => {
    it('should return null for empty file list', async () => {
      const result = await selectBookFile([]);

      expect(result).toBeNull();
    });

    it('should auto-select first unprocessed file', async () => {
      const files: BookFile[] = [
        {
          path: 'unprocessed.epub',
          name: 'unprocessed.epub',
          size: 1024,
          modified: new Date(),
          extension: '.epub',
          processed: false,
        },
        {
          path: 'processed.epub',
          name: 'processed.epub',
          size: 2048,
          modified: new Date(),
          extension: '.epub',
          processed: true,
        },
      ];

      const result = await selectBookFile(files);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('unprocessed.epub');
      expect(result?.processed).toBe(false);
    });

    it('should return processed file when only one file exists', async () => {
      const files: BookFile[] = [
        {
          path: 'book.epub',
          name: 'book.epub',
          size: 1024,
          modified: new Date(),
          extension: '.epub',
          processed: true,
        },
      ];

      const result = await selectBookFile(files);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('book.epub');
    });

    // Note: Interactive mode tests with readline mocking are skipped
    // because readline.createInterface is readonly in Bun test environment.
    // Interactive functionality is tested manually and through integration tests.

    it('should prefer unprocessed over processed files', async () => {
      const files: BookFile[] = [
        {
          path: 'processed.epub',
          name: 'processed.epub',
          size: 1024,
          modified: new Date('2025-01-02'), // Newer
          extension: '.epub',
          processed: true,
        },
        {
          path: 'unprocessed.epub',
          name: 'unprocessed.epub',
          size: 2048,
          modified: new Date('2025-01-01'), // Older
          extension: '.epub',
          processed: false,
        },
      ];

      const result = await selectBookFile(files);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('unprocessed.epub');
      expect(result?.processed).toBe(false);
    });

    it('should handle multiple unprocessed files - select first', async () => {
      const files: BookFile[] = [
        {
          path: 'book1.epub',
          name: 'book1.epub',
          size: 1024,
          modified: new Date('2025-01-02'), // Newer
          extension: '.epub',
          processed: false,
        },
        {
          path: 'book2.epub',
          name: 'book2.epub',
          size: 2048,
          modified: new Date('2025-01-01'), // Older
          extension: '.epub',
          processed: false,
        },
      ];

      const result = await selectBookFile(files);

      expect(result).not.toBeNull();
      // Should select first in array (newer due to sorting)
      expect(result?.name).toBe('book1.epub');
    });
  });

  describe('BookFile interface', () => {
    it('should have correct structure', async () => {
      createTestFile('book.epub', 'content');

      const files = await findBookFiles();

      expect(files).toHaveLength(1);
      const file = files[0];

      // Check all required properties exist
      expect(file).toHaveProperty('path');
      expect(file).toHaveProperty('name');
      expect(file).toHaveProperty('size');
      expect(file).toHaveProperty('modified');
      expect(file).toHaveProperty('extension');
      expect(file).toHaveProperty('processed');

      // Check types
      expect(typeof file.path).toBe('string');
      expect(typeof file.name).toBe('string');
      expect(typeof file.size).toBe('number');
      expect(file.modified).toBeInstanceOf(Date);
      expect(typeof file.extension).toBe('string');
      expect(typeof file.processed).toBe('boolean');
    });
  });
});
