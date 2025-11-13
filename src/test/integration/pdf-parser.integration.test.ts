/**
 * Integration tests for PDF parser
 * Tests real PDF file parsing with actual fixtures
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { parsePdf } from '../../lib/pdf-parser.js';
import { join } from 'path';
import { existsSync } from 'fs';

const fixturesDir = join(process.cwd(), 'src', 'test', 'integration', 'fixtures', 'pdf');

describe('PDF Parser Integration Tests', () => {
  describe('simple.pdf - Basic PDF Parsing', () => {
    const pdfPath = join(fixturesDir, 'simple.pdf');
    let parseResult: Awaited<ReturnType<typeof parsePdf>>;

    beforeAll(async () => {
      // Verify fixture exists
      expect(existsSync(pdfPath)).toBe(true);

      // Parse the PDF file
      parseResult = await parsePdf(pdfPath);
    });

    it('should successfully parse the PDF file', () => {
      expect(parseResult).toBeDefined();
      expect(parseResult.chapters).toBeDefined();
      expect(Array.isArray(parseResult.chapters)).toBe(true);
      expect(parseResult.metadata).toBeDefined();
    });

    it('should extract book metadata', () => {
      expect(parseResult.metadata.title).toBeDefined();
      expect(parseResult.metadata.title).toBe('Simple Test Book');
    });

    it('should extract author metadata', () => {
      expect(parseResult.metadata.author).toBeDefined();
      expect(parseResult.metadata.author).toBe('Test Author');
    });

    it('should extract chapters from PDF content', () => {
      // PDF parser creates chapters based on content
      expect(parseResult.chapters.length).toBeGreaterThan(0);
    });

    it('should extract text content from pages', () => {
      // Verify that text was extracted
      const allContent = parseResult.chapters.map((ch) => ch.content).join(' ');

      // Should contain chapter text (title page might not be included in chapters)
      expect(allContent.toLowerCase()).toContain('chapter');
    });

    it('should extract Chapter 1 content', () => {
      const allContent = parseResult.chapters.map((ch) => ch.content).join(' ');

      // Should contain Chapter 1 text from Page 2
      expect(allContent).toContain('Chapter 1');
      expect(allContent).toContain('The Beginning');
      expect(allContent).toContain('first chapter');
      expect(allContent).toContain('PDF parser');
    });

    it('should extract Chapter 2 content', () => {
      const allContent = parseResult.chapters.map((ch) => ch.content).join(' ');

      // Should contain Chapter 2 text from Page 3
      expect(allContent).toContain('Chapter 2');
      expect(allContent).toContain('The Middle');
      expect(allContent).toContain('second chapter');
      expect(allContent).toContain('separate chapter');
    });

    it('should have non-empty chapter content', () => {
      parseResult.chapters.forEach((chapter) => {
        expect(chapter.content).toBeDefined();
        expect(chapter.content.length).toBeGreaterThan(0);
        expect(chapter.content.trim()).not.toBe('');
      });
    });

    it('should have chapter numbers', () => {
      parseResult.chapters.forEach((chapter, index) => {
        expect(chapter.chapterNumber).toBeDefined();
        expect(chapter.chapterNumber).toBe(index + 1);
      });
    });

    it('should preserve text formatting', () => {
      const allContent = parseResult.chapters.map((ch) => ch.content).join(' ');

      // Text extraction should preserve sentences
      expect(allContent).toContain('.');
      // Should have multiple sentences
      const sentenceCount = (allContent.match(/\./g) || []).length;
      expect(sentenceCount).toBeGreaterThan(3);
    });

    it('should extract text in correct order', () => {
      const allContent = parseResult.chapters.map((ch) => ch.content).join(' ');

      // Chapter 1 should come before Chapter 2 in extracted content
      const chapter1Index = allContent.indexOf('first chapter');
      const chapter2Index = allContent.indexOf('second chapter');

      expect(chapter1Index).toBeGreaterThan(-1);
      expect(chapter2Index).toBeGreaterThan(-1);
      expect(chapter1Index).toBeLessThan(chapter2Index);
    });

    it('should handle multi-page PDF', () => {
      // Verify all 3 pages were processed
      expect(parseResult.metadata.totalPages).toBe(3);

      // Content from chapter pages should be present
      const allContent = parseResult.chapters.map((ch) => ch.content).join(' ');

      // Page 2 content (Chapter 1)
      expect(allContent).toContain('first chapter');

      // Page 3 content (Chapter 2)
      expect(allContent).toContain('second chapter');

      // Title and author are verified in metadata tests
    });

    it('should not have HTML tags in extracted text', () => {
      const allContent = parseResult.chapters.map((ch) => ch.content).join(' ');

      expect(allContent).not.toContain('<');
      expect(allContent).not.toContain('>');
      expect(allContent).not.toContain('</');
    });

    it('should have valid chapter structure', () => {
      parseResult.chapters.forEach((chapter) => {
        expect(chapter).toHaveProperty('chapterNumber');
        expect(chapter).toHaveProperty('chapterTitle');
        expect(chapter).toHaveProperty('content');
        expect(typeof chapter.chapterNumber).toBe('number');
        expect(typeof chapter.chapterTitle).toBe('string');
        expect(typeof chapter.content).toBe('string');
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent file', async () => {
      const nonExistentPath = join(fixturesDir, 'does-not-exist.pdf');

      await expect(parsePdf(nonExistentPath)).rejects.toThrow();
    });

    it('should throw error for invalid file path', async () => {
      const invalidPath = join(fixturesDir, 'README.md'); // Not a PDF file

      await expect(parsePdf(invalidPath)).rejects.toThrow();
    });

    it('should handle empty file path gracefully', async () => {
      await expect(parsePdf('')).rejects.toThrow();
    });
  });
});
