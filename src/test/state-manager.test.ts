/**
 * Tests for state-manager.ts
 * Critical for state persistence, phase tracking, and resume functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { StateManager } from '../lib/state-manager.js';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';

// Test directory
const testDir = join(cwd(), 'src', 'test', '.test-data', `state-manager-test-${Date.now()}`);

describe('state-manager', () => {
  let manager: StateManager;
  let outputDir: string;

  beforeEach(() => {
    // Create test directory
    outputDir = join(testDir, `run-${Date.now()}`);
    mkdirSync(outputDir, { recursive: true });

    // Create manager instance
    manager = new StateManager(outputDir, 'test.epub', 'Test Book', 100);
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create state manager instance', () => {
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(StateManager);
    });

    it('should initialize state with book info', () => {
      const state = manager.getState();
      expect(state.bookFile).toBe('test.epub');
      expect(state.bookTitle).toBe('Test Book');
      expect(state.totalPages).toBe(100);
    });

    it('should initialize all phases as pending', () => {
      const state = manager.getState();
      expect(state.phases.parse.status).toBe('pending');
      expect(state.phases.analyze.status).toBe('pending');
      expect(state.phases.extract.status).toBe('pending');
      expect(state.phases.illustrate.status).toBe('pending');
    });

    it('should initialize empty TOC', () => {
      const state = manager.getState();
      expect(state.toc.chapters).toEqual([]);
    });

    it('should initialize token stats', () => {
      const state = manager.getState();
      expect(state.tokenStats.totalUsed).toBe(0);
    });

    it('should set version', () => {
      const state = manager.getState();
      expect(state.version).toBe('2.0.0');
    });
  });

  describe('save and load', () => {
    it('should save state to file', async () => {
      await manager.save();

      const stateFile = join(outputDir, '.imaginize.state.json');
      expect(existsSync(stateFile)).toBe(true);
    });

    it('should load state from file', async () => {
      await manager.save();

      const newManager = new StateManager(outputDir, 'other.epub', 'Other Book', 50);
      const loaded = await newManager.load();

      expect(loaded).toBe(true);
      const state = newManager.getState();
      expect(state.bookFile).toBe('test.epub');
      expect(state.bookTitle).toBe('Test Book');
      expect(state.totalPages).toBe(100);
    });

    it('should return false when loading non-existent state', async () => {
      const newManager = new StateManager(outputDir, 'test.epub', 'Test', 100);
      const loaded = await newManager.load();

      expect(loaded).toBe(false);
    });

    it('should throw error on version mismatch', async () => {
      // Save state
      await manager.save();

      // Manually modify version
      const stateFile = join(outputDir, '.imaginize.state.json');
      const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
      state.version = '1.0.0';
      writeFileSync(stateFile, JSON.stringify(state));

      // Try to load
      const newManager = new StateManager(outputDir, 'test.epub', 'Test', 100);
      await expect(newManager.load()).rejects.toThrow(/version mismatch/i);
    });

    it('should update lastUpdated timestamp on save', async () => {
      const before = Date.now();
      await manager.save();
      const after = Date.now();

      const state = manager.getState();
      const timestamp = new Date(state.lastUpdated).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('updatePhase', () => {
    it('should update phase status', () => {
      manager.updatePhase('parse', 'in_progress');

      const state = manager.getState();
      expect(state.phases.parse.status).toBe('in_progress');
    });

    it('should add completedAt timestamp when marking as completed', () => {
      manager.updatePhase('parse', 'completed');

      const state = manager.getState();
      expect(state.phases.parse.completedAt).toBeDefined();
      expect(state.phases.parse.status).toBe('completed');
    });

    it('should not add completedAt for non-completed status', () => {
      manager.updatePhase('parse', 'in_progress');

      const state = manager.getState();
      expect(state.phases.parse.completedAt).toBeUndefined();
    });

    it('should accept additional phase data', () => {
      manager.updatePhase('analyze', 'in_progress', { currentSubPhase: 'chapter-1' });

      const state = manager.getState();
      expect(state.phases.analyze.status).toBe('in_progress');
      expect(state.phases.analyze.currentSubPhase).toBe('chapter-1');
    });
  });

  describe('updateChapter', () => {
    it('should create chapters object if not exists', () => {
      manager.updateChapter('analyze', 1, 'in_progress');

      const state = manager.getState();
      expect(state.phases.analyze.chapters).toBeDefined();
      expect(state.phases.analyze.chapters![1]).toBeDefined();
    });

    it('should update chapter status', () => {
      manager.updateChapter('analyze', 1, 'completed');

      const state = manager.getState();
      expect(state.phases.analyze.chapters![1].status).toBe('completed');
    });

    it('should add completedAt timestamp for completed chapter', () => {
      manager.updateChapter('analyze', 1, 'completed');

      const state = manager.getState();
      expect(state.phases.analyze.chapters![1].completedAt).toBeDefined();
    });

    it('should accept additional chapter data', () => {
      manager.updateChapter('analyze', 1, 'completed', { tokenCount: 500 });

      const state = manager.getState();
      expect(state.phases.analyze.chapters![1].tokenCount).toBe(500);
    });

    it('should update phase to in_progress when first chapter starts', () => {
      manager.updateChapter('analyze', 1, 'in_progress');

      const state = manager.getState();
      expect(state.phases.analyze.status).toBe('in_progress');
    });

    it('should not override phase status if already in progress', () => {
      manager.updatePhase('analyze', 'in_progress');
      manager.updateChapter('analyze', 1, 'in_progress');

      const state = manager.getState();
      expect(state.phases.analyze.status).toBe('in_progress');
    });
  });

  describe('updateTokenStats', () => {
    it('should accumulate total tokens used', () => {
      manager.updateTokenStats(100);
      manager.updateTokenStats(200);
      manager.updateTokenStats(300);

      const state = manager.getState();
      expect(state.tokenStats.totalUsed).toBe(600);
    });

    it('should calculate average tokens per page', () => {
      manager.updateTokenStats(100, 50);

      const state = manager.getState();
      expect(state.avgTokensPerPage).toBe(50);
    });

    it('should update running average for tokens per page', () => {
      manager.updateTokenStats(100, 50);
      manager.updateTokenStats(100, 70);

      const state = manager.getState();
      expect(state.avgTokensPerPage).toBe(60); // (50 + 70) / 2
    });

    it('should work without avgTokensPerPage parameter', () => {
      manager.updateTokenStats(100);

      const state = manager.getState();
      expect(state.tokenStats.totalUsed).toBe(100);
      expect(state.avgTokensPerPage).toBeUndefined();
    });
  });

  describe('updateTOC', () => {
    it('should update table of contents', () => {
      const chapters = [
        { number: 1, title: 'Chapter 1', pages: '1-10' },
        { number: 2, title: 'Chapter 2', pages: '11-20' },
      ];

      manager.updateTOC(chapters);

      const state = manager.getState();
      expect(state.toc.chapters).toEqual(chapters);
    });

    it('should include token counts in TOC', () => {
      const chapters = [
        { number: 1, title: 'Chapter 1', pages: '1-10', tokenCount: 500 },
        { number: 2, title: 'Chapter 2', pages: '11-20', tokenCount: 600 },
      ];

      manager.updateTOC(chapters);

      const state = manager.getState();
      expect(state.toc.chapters[0].tokenCount).toBe(500);
      expect(state.toc.chapters[1].tokenCount).toBe(600);
    });
  });

  describe('updateElement', () => {
    it('should add new element', () => {
      manager.updateElement('character', 'Aria', 'completed');

      const state = manager.getState();
      expect(state.elements).toHaveLength(1);
      expect(state.elements![0]).toMatchObject({
        type: 'character',
        name: 'Aria',
        status: 'completed',
      });
    });

    it('should update existing element (case-insensitive)', () => {
      manager.updateElement('character', 'Aria', 'in_progress');
      manager.updateElement('character', 'ARIA', 'completed', 'http://image.url');

      const state = manager.getState();
      expect(state.elements).toHaveLength(1);
      expect(state.elements![0].status).toBe('completed');
      expect(state.elements![0].imageUrl).toBe('http://image.url');
    });

    it('should track multiple elements', () => {
      manager.updateElement('character', 'Aria', 'completed');
      manager.updateElement('location', 'Castle', 'in_progress');
      manager.updateElement('item', 'Sword', 'pending');

      const state = manager.getState();
      expect(state.elements).toHaveLength(3);
    });

    it('should preserve imageUrl when updating status', () => {
      manager.updateElement('character', 'Aria', 'in_progress', 'http://old.url');
      manager.updateElement('character', 'Aria', 'completed');

      const state = manager.getState();
      expect(state.elements![0].imageUrl).toBe('http://old.url');
    });
  });

  describe('isChapterCompleted', () => {
    it('should return true for completed chapter', () => {
      manager.updateChapter('analyze', 1, 'completed');

      expect(manager.isChapterCompleted('analyze', 1)).toBe(true);
    });

    it('should return false for non-completed chapter', () => {
      manager.updateChapter('analyze', 1, 'in_progress');

      expect(manager.isChapterCompleted('analyze', 1)).toBe(false);
    });

    it('should return false for non-existent chapter', () => {
      expect(manager.isChapterCompleted('analyze', 99)).toBe(false);
    });
  });

  describe('getIncompleteChapters', () => {
    beforeEach(() => {
      manager.updateTOC([
        { number: 1, title: 'Chapter 1', pages: '1-10' },
        { number: 2, title: 'Chapter 2', pages: '11-20' },
        { number: 3, title: 'Chapter 3', pages: '21-30' },
      ]);
    });

    it('should return all chapters when none completed', () => {
      const incomplete = manager.getIncompleteChapters('analyze');

      expect(incomplete).toEqual([1, 2, 3]);
    });

    it('should exclude completed chapters', () => {
      manager.updateChapter('analyze', 1, 'completed');
      manager.updateChapter('analyze', 3, 'completed');

      const incomplete = manager.getIncompleteChapters('analyze');

      expect(incomplete).toEqual([2]);
    });

    it('should return empty array when all completed', () => {
      manager.updateChapter('analyze', 1, 'completed');
      manager.updateChapter('analyze', 2, 'completed');
      manager.updateChapter('analyze', 3, 'completed');

      const incomplete = manager.getIncompleteChapters('analyze');

      expect(incomplete).toEqual([]);
    });
  });

  describe('getFailedChapters', () => {
    it('should return empty array when no chapters failed', () => {
      const failed = manager.getFailedChapters('analyze');

      expect(failed).toEqual([]);
    });

    it('should return failed chapter numbers', () => {
      manager.updateChapter('analyze', 1, 'failed');
      manager.updateChapter('analyze', 3, 'failed');
      manager.updateChapter('analyze', 2, 'completed');

      const failed = manager.getFailedChapters('analyze');

      expect(failed).toEqual([1, 3]);
    });

    it('should sort failed chapters numerically', () => {
      manager.updateChapter('analyze', 5, 'failed');
      manager.updateChapter('analyze', 1, 'failed');
      manager.updateChapter('analyze', 3, 'failed');

      const failed = manager.getFailedChapters('analyze');

      expect(failed).toEqual([1, 3, 5]);
    });
  });

  describe('getFailedChaptersWithErrors', () => {
    it('should return empty array when no failures', () => {
      const failed = manager.getFailedChaptersWithErrors('analyze');

      expect(failed).toEqual([]);
    });

    it('should return chapter numbers with error messages', () => {
      manager.markChapterFailed('analyze', 1, 'API timeout');
      manager.markChapterFailed('analyze', 3, 'Rate limit');

      const failed = manager.getFailedChaptersWithErrors('analyze');

      expect(failed).toHaveLength(2);
      expect(failed[0]).toMatchObject({ chapterNumber: 1, error: 'API timeout' });
      expect(failed[1]).toMatchObject({ chapterNumber: 3, error: 'Rate limit' });
    });

    it('should handle missing error message', () => {
      manager.updateChapter('analyze', 1, 'failed');

      const failed = manager.getFailedChaptersWithErrors('analyze');

      expect(failed[0].error).toBe('Unknown error');
    });
  });

  describe('markChapterFailed', () => {
    it('should set chapter status to failed', () => {
      manager.markChapterFailed('analyze', 1, 'Test error');

      const state = manager.getState();
      expect(state.phases.analyze.chapters![1].status).toBe('failed');
    });

    it('should store error message', () => {
      manager.markChapterFailed('analyze', 1, 'Connection timeout');

      const state = manager.getState();
      expect(state.phases.analyze.chapters![1].error).toBe('Connection timeout');
    });
  });

  describe('clearChapterErrors', () => {
    it('should reset failed chapters to pending', () => {
      manager.markChapterFailed('analyze', 1, 'Error 1');
      manager.markChapterFailed('analyze', 2, 'Error 2');
      manager.updateChapter('analyze', 3, 'completed');

      const clearedCount = manager.clearChapterErrors('analyze');

      expect(clearedCount).toBe(2);
      const state = manager.getState();
      expect(state.phases.analyze.chapters![1].status).toBe('pending');
      expect(state.phases.analyze.chapters![2].status).toBe('pending');
      expect(state.phases.analyze.chapters![3].status).toBe('completed');
    });

    it('should clear error messages', () => {
      manager.markChapterFailed('analyze', 1, 'Error message');
      manager.clearChapterErrors('analyze');

      const state = manager.getState();
      expect(state.phases.analyze.chapters![1].error).toBeUndefined();
    });

    it('should return 0 when no failed chapters', () => {
      const clearedCount = manager.clearChapterErrors('analyze');

      expect(clearedCount).toBe(0);
    });
  });

  describe('getCurrentPhase', () => {
    beforeEach(() => {
      manager.updateTOC([
        { number: 1, title: 'Chapter 1', pages: '1-10' },
        { number: 2, title: 'Chapter 2', pages: '11-20' },
        { number: 3, title: 'Chapter 3', pages: '21-30' },
      ]);
    });

    it('should return null when no phase is in progress', () => {
      const current = manager.getCurrentPhase();

      expect(current).toBeNull();
    });

    it('should return current in-progress phase', () => {
      manager.updatePhase('analyze', 'in_progress');

      const current = manager.getCurrentPhase();

      expect(current).not.toBeNull();
      expect(current!.phase).toBe('analyze');
    });

    it('should calculate progress', () => {
      manager.updatePhase('analyze', 'in_progress');
      manager.updateChapter('analyze', 1, 'completed');
      manager.updateChapter('analyze', 2, 'completed');

      const current = manager.getCurrentPhase();

      expect(current!.progress).toBe('2/3 chapters');
    });

    it('should include subPhase if set', () => {
      manager.updatePhase('analyze', 'in_progress', { currentSubPhase: 'scene-extraction' });

      const current = manager.getCurrentPhase();

      expect(current!.subPhase).toBe('scene-extraction');
    });
  });

  describe('validateConsistency', () => {
    it('should return empty array when consistent', () => {
      const discrepancies = manager.validateConsistency(false, false);

      expect(discrepancies).toEqual([]);
    });

    it('should detect analyze phase completed but Contents.md missing', () => {
      manager.updatePhase('analyze', 'completed');

      const discrepancies = manager.validateConsistency(false, false);

      expect(discrepancies).toContain('analyze phase marked complete but Contents.md is missing');
    });

    it('should detect extract phase completed but Elements.md missing', () => {
      manager.updatePhase('extract', 'completed');

      const discrepancies = manager.validateConsistency(false, false);

      expect(discrepancies).toContain('extract phase marked complete but Elements.md is missing');
    });

    it('should detect chapter completed but not in TOC', () => {
      manager.updateTOC([{ number: 1, title: 'Chapter 1', pages: '1-10' }]);
      manager.updateChapter('analyze', 2, 'completed');

      const discrepancies = manager.validateConsistency(true, true);

      expect(discrepancies.some(d => d.includes('chapter 2 marked complete but not in TOC'))).toBe(true);
    });

    it('should not flag when files exist', () => {
      manager.updatePhase('analyze', 'completed');
      manager.updatePhase('extract', 'completed');

      const discrepancies = manager.validateConsistency(true, true);

      expect(discrepancies).not.toContain('analyze phase marked complete but Contents.md is missing');
      expect(discrepancies).not.toContain('extract phase marked complete but Elements.md is missing');
    });
  });

  describe('getSummary', () => {
    it('should include book info', () => {
      const summary = manager.getSummary();

      expect(summary).toContain('Book: Test Book');
      expect(summary).toContain('Total Pages: 100');
    });

    it('should include token stats', () => {
      manager.updateTokenStats(5000);

      const summary = manager.getSummary();

      expect(summary).toContain('Tokens Used: 5,000');
    });

    it('should include average tokens per page if set', () => {
      manager.updateTokenStats(1000, 50);

      const summary = manager.getSummary();

      expect(summary).toContain('Avg Tokens/Page: 50');
    });

    it('should include phase statuses', () => {
      manager.updatePhase('parse', 'completed');
      manager.updatePhase('analyze', 'in_progress');

      const summary = manager.getSummary();

      expect(summary).toContain('✅ parse: completed');
      expect(summary).toContain('🔄 analyze: in_progress');
      expect(summary).toContain('⏳ extract: pending');
    });

    it('should include chapter progress for phases', () => {
      manager.updateTOC([
        { number: 1, title: 'Chapter 1', pages: '1-10' },
        { number: 2, title: 'Chapter 2', pages: '11-20' },
      ]);
      manager.updatePhase('analyze', 'in_progress');
      manager.updateChapter('analyze', 1, 'completed');

      const summary = manager.getSummary();

      expect(summary).toContain('analyze: in_progress (1/2 chapters)');
    });

    it('should include element count', () => {
      manager.updateElement('character', 'Aria', 'completed');
      manager.updateElement('location', 'Castle', 'in_progress');

      const summary = manager.getSummary();

      expect(summary).toContain('Elements: 2 extracted');
    });

    it('should include image count', () => {
      manager.updateElement('character', 'Aria', 'completed', 'http://image1.url');
      manager.updateElement('character', 'Bob', 'completed', 'http://image2.url');
      manager.updateElement('location', 'Castle', 'in_progress');

      const summary = manager.getSummary();

      expect(summary).toContain('Images: 2/3');
    });
  });
});
