/**
 * Tests for progress-tracker.ts
 * Critical for progress tracking, event emission, and dashboard integration
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { ProgressTracker, type ProgressEvent, type ProgressStats } from '../lib/progress-tracker.js';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';

// Test directory
const testDir = join(cwd(), 'src', 'test', '.test-data', `progress-tracker-test-${Date.now()}`);

describe('progress-tracker', () => {
  let tracker: ProgressTracker;
  let outputDir: string;

  beforeEach(() => {
    // Create test directory
    outputDir = join(testDir, `run-${Date.now()}`);
    mkdirSync(outputDir, { recursive: true });

    // Create tracker instance
    tracker = new ProgressTracker(outputDir);
  });

  afterEach(() => {
    // Remove all listeners to prevent memory leaks
    tracker.removeAllListeners();

    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create tracker instance with output directory', () => {
      expect(tracker).toBeDefined();
      expect(tracker).toBeInstanceOf(ProgressTracker);
    });

    it('should be an EventEmitter', () => {
      expect(tracker.on).toBeDefined();
      expect(tracker.emit).toBeDefined();
      expect(tracker.removeListener).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should create progress.md file', async () => {
      await tracker.initialize('Test Book', 5);

      const progressFile = join(outputDir, 'progress.md');
      expect(existsSync(progressFile)).toBe(true);
    });

    it('should write book title to progress file', async () => {
      await tracker.initialize('My Test Book', 5);

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('My Test Book');
    });

    it('should write total chapters to progress file', async () => {
      await tracker.initialize('Test Book', 10);

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('Total Chapters:** 10');
    });

    it('should write timestamp to progress file', async () => {
      await tracker.initialize('Test Book', 5);

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('Started:**');
      expect(content).toMatch(/\d{4}-\d{2}-\d{2}/); // ISO date format
    });

    it('should emit initialized event', async () => {
      const listener = mock((data: any) => {});
      tracker.on('initialized', listener);

      await tracker.initialize('Test Book', 5);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0]).toMatchObject({
        bookTitle: 'Test Book',
        totalChapters: 5,
      });
    });

    it('should set total chapters in stats', async () => {
      await tracker.initialize('Test Book', 7);

      const state = tracker.getState();
      expect(state.stats.totalChapters).toBe(7);
    });
  });

  describe('log', () => {
    beforeEach(async () => {
      await tracker.initialize('Test Book', 5);
    });

    it('should append info message to progress file', async () => {
      await tracker.log('Test info message', 'info');

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('ℹ️ Test info message');
    });

    it('should append success message with emoji', async () => {
      await tracker.log('Success!', 'success');

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('✅ Success!');
    });

    it('should append warning message with emoji', async () => {
      await tracker.log('Warning!', 'warning');

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('⚠️ Warning!');
    });

    it('should append error message with emoji', async () => {
      await tracker.log('Error occurred', 'error');

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('❌ Error occurred');
    });

    it('should include timestamp in log entry', async () => {
      await tracker.log('Test message');

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toMatch(/\*\*\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should emit progress event', async () => {
      const listener = mock((event: ProgressEvent) => {});
      tracker.on('progress', listener);

      await tracker.log('Test message', 'info');

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0][0] as ProgressEvent;
      expect(event.message).toBe('Test message');
      expect(event.level).toBe('info');
      expect(event.timestamp).toBeDefined();
    });

    it('should default to info level', async () => {
      const listener = mock((event: ProgressEvent) => {});
      tracker.on('progress', listener);

      await tracker.log('Default level message');

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0][0] as ProgressEvent;
      expect(event.level).toBe('info');
    });

    it('should handle multiple sequential logs', async () => {
      await tracker.log('First message');
      await tracker.log('Second message');
      await tracker.log('Third message');

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('First message');
      expect(content).toContain('Second message');
      expect(content).toContain('Third message');
    });
  });

  describe('startChapter', () => {
    beforeEach(async () => {
      await tracker.initialize('Test Book', 5);
    });

    it('should log chapter start', async () => {
      await tracker.startChapter(1, 'The Beginning');

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('Chapter 1: The Beginning');
    });

    it('should emit chapter-start event', async () => {
      const listener = mock((data: any) => {});
      tracker.on('chapter-start', listener);

      await tracker.startChapter(2, 'Chapter Two');

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0]).toMatchObject({
        chapterNum: 2,
        chapterTitle: 'Chapter Two',
      });
    });

    it('should set current chapter in state', async () => {
      await tracker.startChapter(3, 'Test Chapter');

      const state = tracker.getState();
      expect(state.currentChapter).toBe(3);
    });
  });

  describe('completeChapter', () => {
    beforeEach(async () => {
      await tracker.initialize('Test Book', 5);
    });

    it('should log chapter completion', async () => {
      await tracker.completeChapter(1, 'The Beginning', 5);

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('Completed Chapter 1: The Beginning');
      expect(content).toContain('Found 5 visual concepts');
    });

    it('should increment completed chapters count', async () => {
      await tracker.completeChapter(1, 'Chapter 1', 3);

      const state = tracker.getState();
      expect(state.stats.completedChapters).toBe(1);
    });

    it('should update total concepts count', async () => {
      await tracker.completeChapter(1, 'Chapter 1', 5);
      await tracker.completeChapter(2, 'Chapter 2', 3);

      const state = tracker.getState();
      expect(state.stats.totalConcepts).toBe(8);
    });

    it('should clear current chapter from state', async () => {
      await tracker.startChapter(1, 'Test');
      await tracker.completeChapter(1, 'Test', 5);

      const state = tracker.getState();
      expect(state.currentChapter).toBeUndefined();
    });

    it('should emit chapter-complete event', async () => {
      const listener = mock((data: any) => {});
      tracker.on('chapter-complete', listener);

      await tracker.completeChapter(1, 'Chapter One', 7);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0]).toMatchObject({
        chapterNum: 1,
        chapterTitle: 'Chapter One',
        conceptsFound: 7,
      });
    });

    it('should emit stats event', async () => {
      const listener = mock((stats: ProgressStats) => {});
      tracker.on('stats', listener);

      await tracker.completeChapter(1, 'Chapter 1', 5);

      expect(listener).toHaveBeenCalled();
      const stats = listener.mock.calls[0][0] as ProgressStats;
      expect(stats.completedChapters).toBe(1);
      expect(stats.totalConcepts).toBe(5);
    });
  });

  describe('startElementExtraction', () => {
    beforeEach(async () => {
      await tracker.initialize('Test Book', 5);
    });

    it('should log element extraction start', async () => {
      await tracker.startElementExtraction();

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('Starting element extraction');
      expect(content).toContain('characters, places, items');
    });

    it('should set phase to extract', async () => {
      await tracker.startElementExtraction();

      const state = tracker.getState();
      expect(state.currentPhase).toBe('extract');
    });

    it('should emit phase-start event', async () => {
      const listener = mock((data: any) => {});
      tracker.on('phase-start', listener);

      await tracker.startElementExtraction();

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0]).toMatchObject({
        phase: 'extract',
      });
    });
  });

  describe('completeElementExtraction', () => {
    beforeEach(async () => {
      await tracker.initialize('Test Book', 5);
    });

    it('should log element extraction completion', async () => {
      await tracker.completeElementExtraction(15);

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('Completed element extraction');
      expect(content).toContain('Found 15 elements');
    });

    it('should update total elements in stats', async () => {
      await tracker.completeElementExtraction(20);

      const state = tracker.getState();
      expect(state.stats.totalElements).toBe(20);
    });

    it('should emit stats event', async () => {
      const listener = mock((stats: ProgressStats) => {});
      tracker.on('stats', listener);

      await tracker.completeElementExtraction(10);

      expect(listener).toHaveBeenCalled();
      const stats = listener.mock.calls[0][0] as ProgressStats;
      expect(stats.totalElements).toBe(10);
    });
  });

  describe('logImageGeneration', () => {
    beforeEach(async () => {
      await tracker.initialize('Test Book', 5);
    });

    it('should log successful image generation', async () => {
      await tracker.logImageGeneration('Dark Castle', true);

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('Generated image for: Dark Castle');
      expect(content).toContain('✅');
    });

    it('should log failed image generation', async () => {
      await tracker.logImageGeneration('Failed Image', false);

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('Generated image for: Failed Image');
      expect(content).toContain('❌');
    });

    it('should increment images generated count on success', async () => {
      await tracker.logImageGeneration('Image 1', true);
      await tracker.logImageGeneration('Image 2', true);
      await tracker.logImageGeneration('Image 3', false); // Failed, should not count

      const state = tracker.getState();
      expect(state.stats.imagesGenerated).toBe(2);
    });

    it('should emit image-complete event on success', async () => {
      const listener = mock((data: any) => {});
      tracker.on('image-complete', listener);

      await tracker.logImageGeneration('Test Image', true);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0]).toMatchObject({
        elementName: 'Test Image',
      });
    });

    it('should not emit image-complete event on failure', async () => {
      const listener = mock((data: any) => {});
      tracker.on('image-complete', listener);

      await tracker.logImageGeneration('Failed Image', false);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('logError', () => {
    beforeEach(async () => {
      await tracker.initialize('Test Book', 5);
    });

    it('should log error message', async () => {
      await tracker.logError('Something went wrong');

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('❌ Error: Something went wrong');
    });
  });

  describe('setPhase', () => {
    it('should update current phase', () => {
      tracker.setPhase('analyzing');

      const state = tracker.getState();
      expect(state.currentPhase).toBe('analyzing');
    });

    it('should emit phase-start event', () => {
      const listener = mock((data: any) => {});
      tracker.on('phase-start', listener);

      tracker.setPhase('illustrating');

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0]).toMatchObject({
        phase: 'illustrating',
      });
    });
  });

  describe('getState', () => {
    beforeEach(async () => {
      await tracker.initialize('Test Book', 10);
    });

    it('should return book title', () => {
      const state = tracker.getState();
      expect(state.bookTitle).toBe('Test Book');
    });

    it('should return current phase', () => {
      tracker.setPhase('parsing');
      const state = tracker.getState();
      expect(state.currentPhase).toBe('parsing');
    });

    it('should return current chapter', async () => {
      await tracker.startChapter(5, 'Test');
      const state = tracker.getState();
      expect(state.currentChapter).toBe(5);
    });

    it('should return stats', async () => {
      await tracker.completeChapter(1, 'Ch1', 3);
      await tracker.completeChapter(2, 'Ch2', 5);
      await tracker.completeElementExtraction(15);
      await tracker.logImageGeneration('Img1', true);

      const state = tracker.getState();
      expect(state.stats.totalChapters).toBe(10);
      expect(state.stats.completedChapters).toBe(2);
      expect(state.stats.totalConcepts).toBe(8);
      expect(state.stats.totalElements).toBe(15);
      expect(state.stats.imagesGenerated).toBe(1);
    });

    it('should return elapsed time', async () => {
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      const state = tracker.getState();
      expect(state.stats.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it('should calculate ETA after completing chapters', async () => {
      await tracker.completeChapter(1, 'Ch1', 3);

      const state = tracker.getState();
      expect(state.stats.eta).toBeDefined();
      // ETA can be 0 for very fast operations
      expect(state.stats.eta).toBeGreaterThanOrEqual(0);
    });

    it('should not have ETA before completing any chapters', () => {
      const state = tracker.getState();
      expect(state.stats.eta).toBeUndefined();
    });
  });

  describe('finalize', () => {
    beforeEach(async () => {
      await tracker.initialize('Test Book', 5);
    });

    it('should append summary to progress file', async () => {
      await tracker.finalize(25, 10, 8);

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('## Summary');
      expect(content).toContain('Visual Concepts Found:** 25');
      expect(content).toContain('Elements Extracted:** 10');
      expect(content).toContain('Images Generated:** 8');
    });

    it('should include completion timestamp', async () => {
      await tracker.finalize(10, 5, 3);

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('Completed:**');
      expect(content).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should include duration', async () => {
      // Wait a bit to get measurable duration
      await new Promise(resolve => setTimeout(resolve, 100));
      await tracker.finalize(10, 5, 3);

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('Duration:**');
      expect(content).toMatch(/\d+m \d+s/);
    });

    it('should log completion message', async () => {
      await tracker.finalize(10, 5, 3);

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      expect(content).toContain('✅ All processing complete!');
    });
  });

  describe('concurrent operations', () => {
    beforeEach(async () => {
      await tracker.initialize('Test Book', 5);
    });

    it('should handle concurrent log writes', async () => {
      // Start multiple log operations concurrently
      const promises = [
        tracker.log('Message 1'),
        tracker.log('Message 2'),
        tracker.log('Message 3'),
        tracker.log('Message 4'),
        tracker.log('Message 5'),
      ];

      await Promise.all(promises);

      const progressFile = join(outputDir, 'progress.md');
      const content = readFileSync(progressFile, 'utf-8');

      // All messages should be present
      expect(content).toContain('Message 1');
      expect(content).toContain('Message 2');
      expect(content).toContain('Message 3');
      expect(content).toContain('Message 4');
      expect(content).toContain('Message 5');
    });
  });
});
