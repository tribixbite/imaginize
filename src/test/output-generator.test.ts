/**
 * Tests for output-generator.ts
 * Critical for markdown file generation (Contents.md, Chapters.md, Elements.md)
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  generateContentsFile,
  generateChaptersFile,
  generateElementsFile,
} from '../lib/output-generator.js';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';
import type { BookMetadata, ImageConcept, BookElement } from '../types/config.js';

// Test directory
const testDir = join(cwd(), 'src', 'test', '.test-data', `output-generator-test-${Date.now()}`);

describe('output-generator', () => {
  let outputDir: string;

  beforeEach(() => {
    // Create test directory
    outputDir = join(testDir, `run-${Date.now()}`);
    mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('generateContentsFile', () => {
    it('should create Contents.md file', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };

      await generateContentsFile(outputDir, metadata, 10, 5);

      const filePath = join(outputDir, 'Contents.md');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should include book title', async () => {
      const metadata: BookMetadata = {
        title: 'My Test Book',
      };

      await generateContentsFile(outputDir, metadata, 10, 5);

      const content = readFileSync(join(outputDir, 'Contents.md'), 'utf-8');
      expect(content).toContain('# My Test Book');
    });

    it('should include author when provided', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
        author: 'John Doe',
      };

      await generateContentsFile(outputDir, metadata, 10, 5);

      const content = readFileSync(join(outputDir, 'Contents.md'), 'utf-8');
      expect(content).toContain('**Author:** John Doe');
    });

    it('should include publisher when provided', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
        publisher: 'Test Publishing',
      };

      await generateContentsFile(outputDir, metadata, 10, 5);

      const content = readFileSync(join(outputDir, 'Contents.md'), 'utf-8');
      expect(content).toContain('**Publisher:** Test Publishing');
    });

    it('should include total pages when provided', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
        totalPages: 250,
      };

      await generateContentsFile(outputDir, metadata, 10, 5);

      const content = readFileSync(join(outputDir, 'Contents.md'), 'utf-8');
      expect(content).toContain('**Total Pages:** 250');
    });

    it('should include chapters count', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };

      await generateContentsFile(outputDir, metadata, 15, 5);

      const content = readFileSync(join(outputDir, 'Contents.md'), 'utf-8');
      expect(content).toContain('15 visual scenes');
    });

    it('should include elements count', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };

      await generateContentsFile(outputDir, metadata, 10, 20);

      const content = readFileSync(join(outputDir, 'Contents.md'), 'utf-8');
      expect(content).toContain('20 story elements');
    });

    it('should include links to Chapters.md and Elements.md', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };

      await generateContentsFile(outputDir, metadata, 10, 5);

      const content = readFileSync(join(outputDir, 'Contents.md'), 'utf-8');
      expect(content).toContain('[Chapters.md](./Chapters.md)');
      expect(content).toContain('[Elements.md](./Elements.md)');
    });

    it('should include usage instructions', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };

      await generateContentsFile(outputDir, metadata, 10, 5);

      const content = readFileSync(join(outputDir, 'Contents.md'), 'utf-8');
      expect(content).toContain('## How to Use This Guide');
      expect(content).toContain('Browse visual scenes');
      expect(content).toContain('Reference catalog');
    });

    it('should handle metadata with all fields', async () => {
      const metadata: BookMetadata = {
        title: 'Complete Book',
        author: 'Jane Smith',
        publisher: 'Great Books Inc.',
        totalPages: 500,
      };

      await generateContentsFile(outputDir, metadata, 25, 30);

      const content = readFileSync(join(outputDir, 'Contents.md'), 'utf-8');
      expect(content).toContain('# Complete Book');
      expect(content).toContain('**Author:** Jane Smith');
      expect(content).toContain('**Publisher:** Great Books Inc.');
      expect(content).toContain('**Total Pages:** 500');
      expect(content).toContain('25 visual scenes');
      expect(content).toContain('30 story elements');
    });
  });

  describe('generateChaptersFile', () => {
    it('should create Chapters.md file', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const conceptsByChapter = new Map<string, ImageConcept[]>();

      await generateChaptersFile(outputDir, metadata, conceptsByChapter);

      const filePath = join(outputDir, 'Chapters.md');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should include book title in header', async () => {
      const metadata: BookMetadata = {
        title: 'Adventure Novel',
      };
      const conceptsByChapter = new Map<string, ImageConcept[]>();

      await generateChaptersFile(outputDir, metadata, conceptsByChapter);

      const content = readFileSync(join(outputDir, 'Chapters.md'), 'utf-8');
      expect(content).toContain('# Chapters - Adventure Novel');
    });

    it('should handle empty chapters', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const conceptsByChapter = new Map<string, ImageConcept[]>();

      await generateChaptersFile(outputDir, metadata, conceptsByChapter);

      const content = readFileSync(join(outputDir, 'Chapters.md'), 'utf-8');
      expect(content).toContain('## Visual Scenes by Chapter');
    });

    it('should include chapter title as header', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const concepts: ImageConcept[] = [
        {
          description: 'A dark castle',
          quote: 'The castle loomed in the distance',
          pageRange: '1-2',
        },
      ];
      const conceptsByChapter = new Map([['Chapter 1: The Beginning', concepts]]);

      await generateChaptersFile(outputDir, metadata, conceptsByChapter);

      const content = readFileSync(join(outputDir, 'Chapters.md'), 'utf-8');
      expect(content).toContain('### Chapter 1: The Beginning');
    });

    it('should number scenes within chapters', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const concepts: ImageConcept[] = [
        {
          description: 'Scene 1',
          quote: 'First quote',
          pageRange: '1',
        },
        {
          description: 'Scene 2',
          quote: 'Second quote',
          pageRange: '2',
        },
      ];
      const conceptsByChapter = new Map([['Chapter 1', concepts]]);

      await generateChaptersFile(outputDir, metadata, conceptsByChapter);

      const content = readFileSync(join(outputDir, 'Chapters.md'), 'utf-8');
      expect(content).toContain('#### Scene 1');
      expect(content).toContain('#### Scene 2');
    });

    it('should include page range', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const concepts: ImageConcept[] = [
        {
          description: 'Test scene',
          quote: 'Test quote',
          pageRange: '10-15',
        },
      ];
      const conceptsByChapter = new Map([['Chapter 1', concepts]]);

      await generateChaptersFile(outputDir, metadata, conceptsByChapter);

      const content = readFileSync(join(outputDir, 'Chapters.md'), 'utf-8');
      expect(content).toContain('**Pages:** 10-15');
    });

    it('should include line numbers when provided', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const concepts: ImageConcept[] = [
        {
          description: 'Test scene',
          quote: 'Test quote',
          pageRange: '10-15',
          lineNumbers: { start: 5, end: 12 },
        },
      ];
      const conceptsByChapter = new Map([['Chapter 1', concepts]]);

      await generateChaptersFile(outputDir, metadata, conceptsByChapter);

      const content = readFileSync(join(outputDir, 'Chapters.md'), 'utf-8');
      expect(content).toContain('**Pages:** 10-15 (Lines 5-12)');
    });

    it('should include source quote', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const concepts: ImageConcept[] = [
        {
          description: 'Test scene',
          quote: 'The knight drew his sword',
          pageRange: '1',
        },
      ];
      const conceptsByChapter = new Map([['Chapter 1', concepts]]);

      await generateChaptersFile(outputDir, metadata, conceptsByChapter);

      const content = readFileSync(join(outputDir, 'Chapters.md'), 'utf-8');
      expect(content).toContain('**Source Text:**');
      expect(content).toContain('> The knight drew his sword');
    });

    it('should include visual description', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const concepts: ImageConcept[] = [
        {
          description: 'A brave knight in shining armor',
          quote: 'Test quote',
          pageRange: '1',
        },
      ];
      const conceptsByChapter = new Map([['Chapter 1', concepts]]);

      await generateChaptersFile(outputDir, metadata, conceptsByChapter);

      const content = readFileSync(join(outputDir, 'Chapters.md'), 'utf-8');
      expect(content).toContain('**Visual Elements:** A brave knight in shining armor');
    });

    it('should include image URL when provided', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const concepts: ImageConcept[] = [
        {
          description: 'Test scene',
          quote: 'Test quote',
          pageRange: '1',
          imageUrl: 'https://example.com/image.png',
        },
      ];
      const conceptsByChapter = new Map([['Chapter 1', concepts]]);

      await generateChaptersFile(outputDir, metadata, conceptsByChapter);

      const content = readFileSync(join(outputDir, 'Chapters.md'), 'utf-8');
      expect(content).toContain('**Generated Image:** [View Image](https://example.com/image.png)');
    });

    it('should skip empty chapters', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const conceptsByChapter = new Map([
        ['Chapter 1', []],
        [
          'Chapter 2',
          [
            {
              description: 'Scene',
              quote: 'Quote',
              pageRange: '1',
            },
          ],
        ],
      ]);

      await generateChaptersFile(outputDir, metadata, conceptsByChapter);

      const content = readFileSync(join(outputDir, 'Chapters.md'), 'utf-8');
      expect(content).not.toContain('### Chapter 1');
      expect(content).toContain('### Chapter 2');
    });

    it('should handle multiple chapters with multiple scenes', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const conceptsByChapter = new Map([
        [
          'Chapter 1',
          [
            { description: 'Scene 1-1', quote: 'Quote 1-1', pageRange: '1' },
            { description: 'Scene 1-2', quote: 'Quote 1-2', pageRange: '2' },
          ],
        ],
        [
          'Chapter 2',
          [
            { description: 'Scene 2-1', quote: 'Quote 2-1', pageRange: '3' },
            { description: 'Scene 2-2', quote: 'Quote 2-2', pageRange: '4' },
          ],
        ],
      ]);

      await generateChaptersFile(outputDir, metadata, conceptsByChapter);

      const content = readFileSync(join(outputDir, 'Chapters.md'), 'utf-8');
      expect(content).toContain('### Chapter 1');
      expect(content).toContain('### Chapter 2');
      expect(content).toContain('Scene 1-1');
      expect(content).toContain('Scene 2-2');
    });
  });

  describe('generateElementsFile', () => {
    it('should create Elements.md file', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const elements: BookElement[] = [];

      await generateElementsFile(outputDir, metadata, elements);

      const filePath = join(outputDir, 'Elements.md');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should include book title in header', async () => {
      const metadata: BookMetadata = {
        title: 'Fantasy Epic',
      };
      const elements: BookElement[] = [];

      await generateElementsFile(outputDir, metadata, elements);

      const content = readFileSync(join(outputDir, 'Elements.md'), 'utf-8');
      expect(content).toContain('# Elements - Fantasy Epic');
    });

    it('should include author when provided', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
        author: 'Test Author',
      };
      const elements: BookElement[] = [];

      await generateElementsFile(outputDir, metadata, elements);

      const content = readFileSync(join(outputDir, 'Elements.md'), 'utf-8');
      expect(content).toContain('**Author:** Test Author');
    });

    it('should group elements by type', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const elements: BookElement[] = [
        {
          type: 'character',
          name: 'Aria',
          quotes: [{ text: 'Quote 1', page: '1' }],
        },
        {
          type: 'place',
          name: 'Castle',
          quotes: [{ text: 'Quote 2', page: '2' }],
        },
      ];

      await generateElementsFile(outputDir, metadata, elements);

      const content = readFileSync(join(outputDir, 'Elements.md'), 'utf-8');
      expect(content).toContain('### Characters');
      expect(content).toContain('### Places');
    });

    it('should follow type order (character, creature, place, item, object)', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const elements: BookElement[] = [
        { type: 'object', name: 'Object1', quotes: [{ text: 'Q1', page: '1' }] },
        { type: 'character', name: 'Char1', quotes: [{ text: 'Q2', page: '2' }] },
        { type: 'place', name: 'Place1', quotes: [{ text: 'Q3', page: '3' }] },
      ];

      await generateElementsFile(outputDir, metadata, elements);

      const content = readFileSync(join(outputDir, 'Elements.md'), 'utf-8');
      const charIndex = content.indexOf('### Characters');
      const placeIndex = content.indexOf('### Places');
      const objectIndex = content.indexOf('### Objects');

      expect(charIndex).toBeLessThan(placeIndex);
      expect(placeIndex).toBeLessThan(objectIndex);
    });

    it('should include element name', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const elements: BookElement[] = [
        {
          type: 'character',
          name: 'Aragorn',
          quotes: [{ text: 'Test quote', page: '1' }],
        },
      ];

      await generateElementsFile(outputDir, metadata, elements);

      const content = readFileSync(join(outputDir, 'Elements.md'), 'utf-8');
      expect(content).toContain('#### Aragorn');
    });

    it('should include element description when provided', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const elements: BookElement[] = [
        {
          type: 'character',
          name: 'Hero',
          description: 'A brave warrior',
          quotes: [{ text: 'Quote', page: '1' }],
        },
      ];

      await generateElementsFile(outputDir, metadata, elements);

      const content = readFileSync(join(outputDir, 'Elements.md'), 'utf-8');
      expect(content).toContain('**Description:** A brave warrior');
    });

    it('should include reference quotes with page numbers', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const elements: BookElement[] = [
        {
          type: 'character',
          name: 'Hero',
          quotes: [
            { text: 'He was tall', page: '10' },
            { text: 'He was brave', page: '15' },
          ],
        },
      ];

      await generateElementsFile(outputDir, metadata, elements);

      const content = readFileSync(join(outputDir, 'Elements.md'), 'utf-8');
      expect(content).toContain('1. (Page 10)');
      expect(content).toContain('> He was tall');
      expect(content).toContain('2. (Page 15)');
      expect(content).toContain('> He was brave');
    });

    it('should include image URL when provided', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const elements: BookElement[] = [
        {
          type: 'character',
          name: 'Hero',
          quotes: [{ text: 'Quote', page: '1' }],
          imageUrl: 'https://example.com/hero.png',
        },
      ];

      await generateElementsFile(outputDir, metadata, elements);

      const content = readFileSync(join(outputDir, 'Elements.md'), 'utf-8');
      expect(content).toContain('**Generated Image:** [View Image](https://example.com/hero.png)');
    });

    it('should include statistics section', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const elements: BookElement[] = [
        { type: 'character', name: 'C1', quotes: [{ text: 'Q1', page: '1' }] },
        { type: 'character', name: 'C2', quotes: [{ text: 'Q2', page: '2' }] },
        { type: 'place', name: 'P1', quotes: [{ text: 'Q3', page: '3' }] },
      ];

      await generateElementsFile(outputDir, metadata, elements);

      const content = readFileSync(join(outputDir, 'Elements.md'), 'utf-8');
      expect(content).toContain('## Statistics');
      expect(content).toContain('- **Characters:** 2');
      expect(content).toContain('- **Places:** 1');
    });

    it('should handle empty elements array', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const elements: BookElement[] = [];

      await generateElementsFile(outputDir, metadata, elements);

      const content = readFileSync(join(outputDir, 'Elements.md'), 'utf-8');
      expect(content).toContain('# Elements - Test Book');
      expect(content).toContain('## Story Elements');
      expect(content).toContain('## Statistics');
    });

    it('should handle all element types', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const elements: BookElement[] = [
        { type: 'character', name: 'Char', quotes: [{ text: 'Q1', page: '1' }] },
        { type: 'creature', name: 'Creature', quotes: [{ text: 'Q2', page: '2' }] },
        { type: 'place', name: 'Place', quotes: [{ text: 'Q3', page: '3' }] },
        { type: 'item', name: 'Item', quotes: [{ text: 'Q4', page: '4' }] },
        { type: 'object', name: 'Object', quotes: [{ text: 'Q5', page: '5' }] },
      ];

      await generateElementsFile(outputDir, metadata, elements);

      const content = readFileSync(join(outputDir, 'Elements.md'), 'utf-8');
      expect(content).toContain('### Characters');
      expect(content).toContain('### Creatures');
      expect(content).toContain('### Places');
      expect(content).toContain('### Items');
      expect(content).toContain('### Objects');
      expect(content).toContain('- **Characters:** 1');
      expect(content).toContain('- **Creatures:** 1');
    });

    it('should skip types with no elements', async () => {
      const metadata: BookMetadata = {
        title: 'Test Book',
      };
      const elements: BookElement[] = [
        { type: 'character', name: 'Hero', quotes: [{ text: 'Q', page: '1' }] },
      ];

      await generateElementsFile(outputDir, metadata, elements);

      const content = readFileSync(join(outputDir, 'Elements.md'), 'utf-8');
      expect(content).toContain('### Characters');
      expect(content).not.toContain('### Creatures');
      expect(content).not.toContain('### Places');
    });
  });
});
