/**
 * Integration tests for EPUB parser
 * Tests real EPUB file parsing with actual fixtures
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { parseEpub } from '../../lib/epub-parser.js';
import { join } from 'path';
import { existsSync } from 'fs';

const fixturesDir = join(process.cwd(), 'src', 'test', 'integration', 'fixtures', 'epub');

describe('EPUB Parser Integration Tests', () => {
  describe('simple.epub - Basic EPUB Parsing', () => {
    const epubPath = join(fixturesDir, 'simple.epub');
    let parseResult: Awaited<ReturnType<typeof parseEpub>>;

    beforeAll(async () => {
      // Verify fixture exists
      expect(existsSync(epubPath)).toBe(true);

      // Parse the EPUB file
      parseResult = await parseEpub(epubPath);
    });

    it('should successfully parse the EPUB file', () => {
      expect(parseResult).toBeDefined();
      expect(parseResult.chapters).toBeDefined();
      expect(Array.isArray(parseResult.chapters)).toBe(true);
      expect(parseResult.metadata).toBeDefined();
    });

    it('should extract correct book title', () => {
      expect(parseResult.metadata.title).toBe('Simple Test Book');
    });

    it('should extract correct author', () => {
      expect(parseResult.metadata.author).toBe('Test Author');
    });

    it('should extract correct chapter count', () => {
      expect(parseResult.chapters.length).toBe(2);
    });

    it('should extract Chapter 1 correctly', () => {
      const chapter1 = parseResult.chapters[0];

      expect(chapter1).toBeDefined();
      expect(chapter1.chapterTitle).toContain('Chapter 1');
      expect(chapter1.chapterTitle).toContain('The Beginning');
      expect(chapter1.content).toBeDefined();
      expect(chapter1.content.length).toBeGreaterThan(0);
    });

    it('should extract Chapter 1 content with all paragraphs', () => {
      const chapter1 = parseResult.chapters[0];

      // Should contain the first paragraph text
      expect(chapter1.content).toContain('first chapter of the test book');
      // Should contain reference to parser
      expect(chapter1.content).toContain('EPUB parser');
      // Should contain reference to multiple paragraphs
      expect(chapter1.content).toContain('multiple paragraphs');
    });

    it('should extract Chapter 2 correctly', () => {
      const chapter2 = parseResult.chapters[1];

      expect(chapter2).toBeDefined();
      expect(chapter2.chapterTitle).toContain('Chapter 2');
      expect(chapter2.chapterTitle).toContain('The Middle');
      expect(chapter2.content).toBeDefined();
      expect(chapter2.content.length).toBeGreaterThan(0);
    });

    it('should extract Chapter 2 content with correct text', () => {
      const chapter2 = parseResult.chapters[1];

      // Should contain the second chapter text
      expect(chapter2.content).toContain('second chapter');
      // Should mention separate chapter
      expect(chapter2.content).toContain('separate chapter');
      // Should mention different content
      expect(chapter2.content).toContain('different content');
    });

    it('should have different content for each chapter', () => {
      const chapter1Content = parseResult.chapters[0].content;
      const chapter2Content = parseResult.chapters[1].content;

      // Chapters should have different content
      expect(chapter1Content).not.toBe(chapter2Content);
      // Chapter 1 specific text should not be in Chapter 2
      expect(chapter2Content).not.toContain('first chapter of the test book');
      // Chapter 2 specific text should not be in Chapter 1
      expect(chapter1Content).not.toContain('second chapter');
    });

    it('should have sequential chapter numbers', () => {
      expect(parseResult.chapters[0].chapterNumber).toBe(1);
      expect(parseResult.chapters[1].chapterNumber).toBe(2);
    });

    it('should not have empty chapter titles', () => {
      parseResult.chapters.forEach((chapter) => {
        expect(chapter.chapterTitle).toBeDefined();
        expect(chapter.chapterTitle.length).toBeGreaterThan(0);
        expect(chapter.chapterTitle.trim()).not.toBe('');
      });
    });

    it('should not have empty chapter content', () => {
      parseResult.chapters.forEach((chapter) => {
        expect(chapter.content).toBeDefined();
        expect(chapter.content.length).toBeGreaterThan(0);
        expect(chapter.content.trim()).not.toBe('');
      });
    });

    it('should preserve paragraph structure in content', () => {
      const chapter1 = parseResult.chapters[0];

      // Content should contain multiple sentences/paragraphs
      // Check for sentence endings
      const sentenceCount = (chapter1.content.match(/\./g) || []).length;
      expect(sentenceCount).toBeGreaterThanOrEqual(3);
    });

    it('should handle XHTML content extraction', () => {
      // Both chapters are XHTML, should be extracted successfully
      parseResult.chapters.forEach((chapter, index) => {
        expect(chapter.content).toBeDefined();
        expect(chapter.content).not.toContain('<html');
        expect(chapter.content).not.toContain('<body');
        expect(chapter.content).not.toContain('<p>');
        expect(chapter.content).not.toContain('</p>');
      });
    });

    it('should extract metadata language', () => {
      // EPUB has language metadata
      expect(parseResult.metadata.language).toBeDefined();
      expect(parseResult.metadata.language).toBe('en');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent file', async () => {
      const nonExistentPath = join(fixturesDir, 'does-not-exist.epub');

      await expect(parseEpub(nonExistentPath)).rejects.toThrow();
    });

    it('should throw error for invalid file path', async () => {
      const invalidPath = join(fixturesDir, 'README.md'); // Not an EPUB file

      await expect(parseEpub(invalidPath)).rejects.toThrow();
    });
  });
});
