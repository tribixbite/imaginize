/**
 * Tests for provider-utils.ts
 * Critical for provider detection, model recommendations, and chapter/element filtering
 */

import { describe, it, expect } from 'bun:test';
import {
  detectProvider,
  supportsImageGeneration,
  getRecommendedFreeTextModel,
  getRecommendedFreeImageModel,
  getFallbackFreeImageModel,
  isStoryContent,
  mapStoryChaptersToEpub,
  parseChapterSelection,
  parseElementSelection,
  matchesElementFilter,
  type ElementFilter,
} from '../lib/provider-utils.js';

describe('provider-utils', () => {
  describe('detectProvider', () => {
    it('should detect OpenRouter from URL', () => {
      const provider = detectProvider('https://openrouter.ai/api/v1');
      expect(provider).toBe('openrouter');
    });

    it('should detect OpenRouter with different casing', () => {
      const provider = detectProvider('https://OpenRouter.AI/api/v1');
      expect(provider).toBe('openrouter');
    });

    it('should detect OpenAI from URL', () => {
      const provider = detectProvider('https://api.openai.com/v1');
      expect(provider).toBe('openai');
    });

    it('should detect OpenAI with different casing', () => {
      const provider = detectProvider('https://API.OPENAI.COM/v1');
      expect(provider).toBe('openai');
    });

    it('should return custom for unknown URLs', () => {
      const provider = detectProvider('https://custom.api.com/v1');
      expect(provider).toBe('custom');
    });

    it('should return custom for localhost', () => {
      const provider = detectProvider('http://localhost:8080');
      expect(provider).toBe('custom');
    });
  });

  describe('supportsImageGeneration', () => {
    it('should return true for DALL-E 3', () => {
      const supports = supportsImageGeneration('dall-e-3');
      expect(supports).toBe(true);
    });

    it('should return true for flux-schnell', () => {
      const supports = supportsImageGeneration('flux-schnell');
      expect(supports).toBe(true);
    });

    it('should return false for GPT-4o', () => {
      const supports = supportsImageGeneration('gpt-4o');
      expect(supports).toBe(false);
    });

    it('should return false for gpt-4o-mini', () => {
      const supports = supportsImageGeneration('gpt-4o-mini');
      expect(supports).toBe(false);
    });

    it('should handle ModelConfig object with supportsImages true', () => {
      const model = {
        name: 'custom-image-model',
        contextLength: 100_000,
        maxTokens: 4096,
        supportsImages: true,
      };
      const supports = supportsImageGeneration(model);
      expect(supports).toBe(true);
    });

    it('should handle ModelConfig object with supportsImages false', () => {
      const model = {
        name: 'custom-text-model',
        contextLength: 100_000,
        maxTokens: 4096,
        supportsImages: false,
      };
      const supports = supportsImageGeneration(model);
      expect(supports).toBe(false);
    });

    it('should handle ModelConfig object without supportsImages', () => {
      const model = {
        name: 'custom-model',
        contextLength: 100_000,
        maxTokens: 4096,
      };
      const supports = supportsImageGeneration(model);
      expect(supports).toBe(false);
    });
  });

  describe('getRecommendedFreeTextModel', () => {
    it('should return Gemini Flash experimental model', () => {
      const model = getRecommendedFreeTextModel();
      expect(model.name).toBe('google/gemini-2.0-flash-exp:free');
      expect(model.contextLength).toBe(1_000_000);
      expect(model.maxTokens).toBe(8_192);
      expect(model.inputCostPer1M).toBe(0.0);
      expect(model.outputCostPer1M).toBe(0.0);
      expect(model.supportsImages).toBe(false);
    });

    it('should return free model (zero cost)', () => {
      const model = getRecommendedFreeTextModel();
      expect(model.inputCostPer1M).toBe(0.0);
      expect(model.outputCostPer1M).toBe(0.0);
    });

    it('should return model with large context window', () => {
      const model = getRecommendedFreeTextModel();
      expect(model.contextLength).toBeGreaterThanOrEqual(1_000_000);
    });
  });

  describe('getRecommendedFreeImageModel', () => {
    it('should return Gemini Flash image model', () => {
      const model = getRecommendedFreeImageModel();
      expect(model.name).toBe('google/gemini-2.5-flash-image');
      expect(model.contextLength).toBe(8_000);
      expect(model.maxTokens).toBe(8_000);
      expect(model.inputCostPer1M).toBe(0.0);
      expect(model.outputCostPer1M).toBe(0.0);
      expect(model.supportsImages).toBe(true);
    });

    it('should return free model (zero cost)', () => {
      const model = getRecommendedFreeImageModel();
      expect(model.inputCostPer1M).toBe(0.0);
      expect(model.outputCostPer1M).toBe(0.0);
    });

    it('should return model that supports images', () => {
      const model = getRecommendedFreeImageModel();
      expect(model.supportsImages).toBe(true);
    });
  });

  describe('getFallbackFreeImageModel', () => {
    it('should return Gemini experimental model', () => {
      const model = getFallbackFreeImageModel();
      expect(model.name).toBe('google/gemini-exp-1206:free');
      expect(model.contextLength).toBe(8_000);
      expect(model.maxTokens).toBe(8_000);
      expect(model.inputCostPer1M).toBe(0.0);
      expect(model.outputCostPer1M).toBe(0.0);
      expect(model.supportsImages).toBe(true);
    });

    it('should return free model (zero cost)', () => {
      const model = getFallbackFreeImageModel();
      expect(model.inputCostPer1M).toBe(0.0);
      expect(model.outputCostPer1M).toBe(0.0);
    });

    it('should return model that supports images', () => {
      const model = getFallbackFreeImageModel();
      expect(model.supportsImages).toBe(true);
    });
  });

  describe('isStoryContent', () => {
    it('should return true for numbered chapters', () => {
      expect(isStoryContent('Chapter 1')).toBe(true);
      expect(isStoryContent('Chapter 12')).toBe(true);
    });

    it('should return true for named chapters', () => {
      expect(isStoryContent('The Beginning')).toBe(true);
      expect(isStoryContent('A Dark Night')).toBe(true);
    });

    it('should return false for "Also by"', () => {
      expect(isStoryContent('Also by the Author')).toBe(false);
      expect(isStoryContent('Also By This Writer')).toBe(false);
    });

    it('should return false for "About this book"', () => {
      expect(isStoryContent('About this book')).toBe(false);
      expect(isStoryContent('About the book')).toBe(false);
    });

    it('should return false for copyright', () => {
      expect(isStoryContent('Copyright')).toBe(false);
      expect(isStoryContent('Copyright Notice')).toBe(false);
    });

    it('should return false for dedication', () => {
      expect(isStoryContent('Dedication')).toBe(false);
      expect(isStoryContent('Dedications')).toBe(false);
    });

    it('should return false for acknowledgements', () => {
      expect(isStoryContent('Acknowledgements')).toBe(false);
      expect(isStoryContent('Acknowledgement')).toBe(false);
      // NOTE: "Acknowledgment" (US spelling) is not in pattern list
    });

    it('should return false for table of contents', () => {
      expect(isStoryContent('Contents')).toBe(false);
      expect(isStoryContent('Table of Contents')).toBe(false);
      expect(isStoryContent('Content')).toBe(false);
    });

    it('should return false for epigraph', () => {
      expect(isStoryContent('Epigraph')).toBe(false);
    });

    it('should return false for appendix', () => {
      expect(isStoryContent('Appendix')).toBe(false);
      expect(isStoryContent('Appendices')).toBe(false);
      expect(isStoryContent('Appendix A')).toBe(false);
    });

    it('should return false for glossary', () => {
      expect(isStoryContent('Glossary')).toBe(false);
    });

    it('should return false for prologue', () => {
      expect(isStoryContent('Prologue')).toBe(false);
    });

    it('should return false for epilogue', () => {
      expect(isStoryContent('Epilogue')).toBe(false);
    });

    it('should return false for foreword', () => {
      expect(isStoryContent('Foreword')).toBe(false);
    });

    it('should return false for preface', () => {
      expect(isStoryContent('Preface')).toBe(false);
    });

    it('should return false for introduction', () => {
      expect(isStoryContent('Introduction')).toBe(false);
    });

    it('should return false for bibliography', () => {
      expect(isStoryContent('Bibliography')).toBe(false);
    });

    it('should return false for index', () => {
      expect(isStoryContent('Index')).toBe(false);
    });

    it('should return false for notes', () => {
      expect(isStoryContent('Notes')).toBe(false);
      expect(isStoryContent('Note')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isStoryContent('PROLOGUE')).toBe(false);
      expect(isStoryContent('Prologue')).toBe(false);
      expect(isStoryContent('prologue')).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(isStoryContent('  Prologue  ')).toBe(false);
      expect(isStoryContent('  Chapter 1  ')).toBe(true);
    });
  });

  describe('mapStoryChaptersToEpub', () => {
    it('should map story chapters excluding front matter', () => {
      const allChapters = [
        { chapterNumber: 1, chapterTitle: 'Copyright' },
        { chapterNumber: 2, chapterTitle: 'Dedication' },
        { chapterNumber: 3, chapterTitle: 'Chapter 1' },
        { chapterNumber: 4, chapterTitle: 'Chapter 2' },
        { chapterNumber: 5, chapterTitle: 'Chapter 3' },
      ];

      const result = mapStoryChaptersToEpub([1, 2], allChapters);

      expect(result).toEqual([3, 4]);
    });

    it('should handle books with only story chapters', () => {
      const allChapters = [
        { chapterNumber: 1, chapterTitle: 'Chapter 1' },
        { chapterNumber: 2, chapterTitle: 'Chapter 2' },
        { chapterNumber: 3, chapterTitle: 'Chapter 3' },
      ];

      const result = mapStoryChaptersToEpub([1, 2, 3], allChapters);

      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle selecting single chapter', () => {
      const allChapters = [
        { chapterNumber: 1, chapterTitle: 'Prologue' },
        { chapterNumber: 2, chapterTitle: 'Chapter 1' },
        { chapterNumber: 3, chapterTitle: 'Chapter 2' },
      ];

      const result = mapStoryChaptersToEpub([1], allChapters);

      expect(result).toEqual([2]);
    });

    it('should throw error for out-of-range story chapter', () => {
      const allChapters = [
        { chapterNumber: 1, chapterTitle: 'Chapter 1' },
        { chapterNumber: 2, chapterTitle: 'Chapter 2' },
      ];

      expect(() => mapStoryChaptersToEpub([3], allChapters)).toThrow(
        /Story chapter 3 out of range/
      );
    });

    it('should throw error for negative chapter number', () => {
      const allChapters = [
        { chapterNumber: 1, chapterTitle: 'Chapter 1' },
        { chapterNumber: 2, chapterTitle: 'Chapter 2' },
      ];

      expect(() => mapStoryChaptersToEpub([0], allChapters)).toThrow(
        /Story chapter 0 out of range/
      );
    });

    it('should maintain order of selected chapters', () => {
      const allChapters = [
        { chapterNumber: 1, chapterTitle: 'Chapter 1' },
        { chapterNumber: 2, chapterTitle: 'Chapter 2' },
        { chapterNumber: 3, chapterTitle: 'Chapter 3' },
      ];

      const result = mapStoryChaptersToEpub([3, 1, 2], allChapters);

      expect(result).toEqual([3, 1, 2]);
    });

    it('should filter multiple non-story chapters', () => {
      const allChapters = [
        { chapterNumber: 1, chapterTitle: 'Copyright' },
        { chapterNumber: 2, chapterTitle: 'Dedication' },
        { chapterNumber: 3, chapterTitle: 'Prologue' },
        { chapterNumber: 4, chapterTitle: 'Chapter 1' },
        { chapterNumber: 5, chapterTitle: 'Chapter 2' },
        { chapterNumber: 6, chapterTitle: 'Epilogue' },
        { chapterNumber: 7, chapterTitle: 'Acknowledgements' },
      ];

      const result = mapStoryChaptersToEpub([1, 2], allChapters);

      expect(result).toEqual([4, 5]);
    });
  });

  describe('parseChapterSelection', () => {
    it('should parse single chapter', () => {
      const result = parseChapterSelection('1');
      expect(result).toEqual([1]);
    });

    it('should parse multiple chapters', () => {
      const result = parseChapterSelection('1,2,5');
      expect(result).toEqual([1, 2, 5]);
    });

    it('should parse chapter range', () => {
      const result = parseChapterSelection('1-5');
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should parse mixed ranges and singles', () => {
      const result = parseChapterSelection('1-3,7,10-12');
      expect(result).toEqual([1, 2, 3, 7, 10, 11, 12]);
    });

    it('should handle whitespace', () => {
      const result = parseChapterSelection(' 1 , 2 , 5 ');
      expect(result).toEqual([1, 2, 5]);
    });

    it('should handle whitespace in ranges', () => {
      const result = parseChapterSelection('1 - 3');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should sort results', () => {
      const result = parseChapterSelection('5,2,1,3');
      expect(result).toEqual([1, 2, 3, 5]);
    });

    it('should deduplicate chapters', () => {
      const result = parseChapterSelection('1,2,2,3,1');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle overlapping ranges', () => {
      const result = parseChapterSelection('1-3,2-5');
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should throw error for invalid number', () => {
      expect(() => parseChapterSelection('1,abc,3')).toThrow(
        /Invalid chapter number: abc/
      );
    });

    it('should throw error for invalid range', () => {
      expect(() => parseChapterSelection('1-abc')).toThrow(
        /Invalid chapter range: 1-abc/
      );
    });

    it('should handle single-item range', () => {
      const result = parseChapterSelection('5-5');
      expect(result).toEqual([5]);
    });
  });

  describe('parseElementSelection', () => {
    it('should parse simple name', () => {
      const result = parseElementSelection('aria');
      expect(result).toHaveLength(1);
      expect(result[0].namePattern).toBe('aria');
      expect(result[0].type).toBeUndefined();
      expect(result[0].isWildcard).toBe(false);
    });

    it('should parse type:name format', () => {
      const result = parseElementSelection('character:aria');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('character');
      expect(result[0].namePattern).toBe('aria');
      expect(result[0].isWildcard).toBe(false);
    });

    it('should parse wildcard name', () => {
      const result = parseElementSelection('aria*');
      expect(result).toHaveLength(1);
      expect(result[0].namePattern).toBe('aria*');
      expect(result[0].isWildcard).toBe(true);
    });

    it('should parse type:wildcard format', () => {
      const result = parseElementSelection('character:*');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('character');
      expect(result[0].namePattern).toBe('*');
      expect(result[0].isWildcard).toBe(true);
    });

    it('should parse wildcard type', () => {
      const result = parseElementSelection('*:aria');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBeUndefined();
      expect(result[0].namePattern).toBe('aria');
    });

    it('should parse multiple elements', () => {
      const result = parseElementSelection('aria,bob,carl');
      expect(result).toHaveLength(3);
      expect(result[0].namePattern).toBe('aria');
      expect(result[1].namePattern).toBe('bob');
      expect(result[2].namePattern).toBe('carl');
    });

    it('should parse mixed formats', () => {
      const result = parseElementSelection('aria,character:bob,location:*');
      expect(result).toHaveLength(3);
      expect(result[0].type).toBeUndefined();
      expect(result[0].namePattern).toBe('aria');
      expect(result[1].type).toBe('character');
      expect(result[1].namePattern).toBe('bob');
      expect(result[2].type).toBe('location');
      expect(result[2].namePattern).toBe('*');
    });

    it('should normalize to lowercase', () => {
      const result = parseElementSelection('ARIA,Character:BOB');
      expect(result[0].namePattern).toBe('aria');
      expect(result[1].type).toBe('character');
      expect(result[1].namePattern).toBe('bob');
    });

    it('should handle whitespace', () => {
      const result = parseElementSelection(' aria , character:bob ');
      expect(result).toHaveLength(2);
      expect(result[0].namePattern).toBe('aria');
      expect(result[1].namePattern).toBe('bob');
    });
  });

  describe('matchesElementFilter', () => {
    it('should match exact name without type filter', () => {
      const filters: ElementFilter[] = [{ namePattern: 'aria', isWildcard: false }];
      expect(matchesElementFilter('character', 'Aria', filters)).toBe(true);
      expect(matchesElementFilter('character', 'Bob', filters)).toBe(false);
    });

    it('should match exact type and name', () => {
      const filters: ElementFilter[] = [
        { type: 'character', namePattern: 'aria', isWildcard: false },
      ];
      expect(matchesElementFilter('character', 'Aria', filters)).toBe(true);
      expect(matchesElementFilter('location', 'Aria', filters)).toBe(false);
    });

    it('should match wildcard pattern', () => {
      const filters: ElementFilter[] = [{ namePattern: 'aria*', isWildcard: true }];
      expect(matchesElementFilter('character', 'Aria', filters)).toBe(true);
      expect(matchesElementFilter('character', 'Ariana', filters)).toBe(true);
      expect(matchesElementFilter('character', 'Bob', filters)).toBe(false);
    });

    it('should match wildcard type', () => {
      const filters: ElementFilter[] = [
        { type: 'character', namePattern: '*', isWildcard: true },
      ];
      expect(matchesElementFilter('character', 'Aria', filters)).toBe(true);
      expect(matchesElementFilter('character', 'Bob', filters)).toBe(true);
      expect(matchesElementFilter('location', 'Castle', filters)).toBe(false);
    });

    it('should match any filter in list', () => {
      const filters: ElementFilter[] = [
        { namePattern: 'aria', isWildcard: false },
        { namePattern: 'bob', isWildcard: false },
      ];
      expect(matchesElementFilter('character', 'Aria', filters)).toBe(true);
      expect(matchesElementFilter('character', 'Bob', filters)).toBe(true);
      expect(matchesElementFilter('character', 'Carl', filters)).toBe(false);
    });

    it('should be case-insensitive', () => {
      const filters: ElementFilter[] = [{ namePattern: 'aria', isWildcard: false }];
      expect(matchesElementFilter('CHARACTER', 'ARIA', filters)).toBe(true);
      expect(matchesElementFilter('character', 'aria', filters)).toBe(true);
      expect(matchesElementFilter('Character', 'Aria', filters)).toBe(true);
    });

    it('should handle complex wildcard patterns', () => {
      const filters: ElementFilter[] = [{ namePattern: '*castle*', isWildcard: true }];
      expect(matchesElementFilter('location', 'The Castle', filters)).toBe(true);
      expect(matchesElementFilter('location', 'Castle Hill', filters)).toBe(true);
      expect(matchesElementFilter('location', 'Dark Castle Keep', filters)).toBe(true);
      expect(matchesElementFilter('location', 'Tower', filters)).toBe(false);
    });

    it('should require type match when type filter specified', () => {
      const filters: ElementFilter[] = [
        { type: 'character', namePattern: 'aria', isWildcard: false },
      ];
      expect(matchesElementFilter('character', 'Aria', filters)).toBe(true);
      expect(matchesElementFilter('location', 'Aria', filters)).toBe(false);
      expect(matchesElementFilter('item', 'Aria', filters)).toBe(false);
    });

    it('should return false when no filters match', () => {
      const filters: ElementFilter[] = [{ namePattern: 'bob', isWildcard: false }];
      expect(matchesElementFilter('character', 'Aria', filters)).toBe(false);
    });

    it('should handle empty filter list', () => {
      const filters: ElementFilter[] = [];
      expect(matchesElementFilter('character', 'Aria', filters)).toBe(false);
    });
  });
});
