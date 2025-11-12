/**
 * Progress tracking for imaginize operations
 * Creates and updates progress.md file during processing
 *
 * Thread-safe: Uses file locking for concurrent append operations
 * Real-time: Emits events for dashboard integration (v2.6.0+)
 */

import { EventEmitter } from 'events';
import { writeFile, appendFile, readFile } from 'fs/promises';
import { join } from 'path';
import { FileLock } from './concurrent/file-lock.js';
import { atomicWrite } from './concurrent/atomic-write.js';

export interface ProgressEvent {
  timestamp: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  phase?: string;
  chapter?: number;
}

export interface ProgressStats {
  totalChapters: number;
  completedChapters: number;
  totalConcepts: number;
  totalElements: number;
  imagesGenerated: number;
  elapsedMs: number;
  eta?: number; // Estimated time remaining in ms
}

export class ProgressTracker extends EventEmitter {
  private outputDir: string;
  private progressFile: string;
  private startTime: number;
  private lock: FileLock;

  // State tracking for dashboard
  private currentPhase: string = 'initializing';
  private currentChapter?: number;
  private bookTitle: string = '';
  private stats: ProgressStats = {
    totalChapters: 0,
    completedChapters: 0,
    totalConcepts: 0,
    totalElements: 0,
    imagesGenerated: 0,
    elapsedMs: 0,
  };

  constructor(outputDir: string) {
    super();
    this.outputDir = outputDir;
    this.progressFile = join(outputDir, 'progress.md');
    this.startTime = Date.now();
    this.lock = new FileLock(this.progressFile);
  }

  /**
   * Initialize progress tracking file
   */
  async initialize(bookTitle: string, totalChapters: number): Promise<void> {
    this.bookTitle = bookTitle;
    this.stats.totalChapters = totalChapters;
    this.currentPhase = 'initialized';

    const content = `# Illustrate Progress Report

**Book:** ${bookTitle}
**Started:** ${new Date().toISOString()}
**Total Chapters:** ${totalChapters}

---

## Progress Log

`;
    await writeFile(this.progressFile, content);

    // Emit initialization event
    this.emit('initialized', {
      bookTitle,
      totalChapters,
      startTime: this.startTime,
    });
  }

  /**
   * Log a progress message with file locking
   *
   * Thread-safe: Uses lock to prevent interleaved entries from concurrent processes
   * Real-time: Emits 'progress' event for dashboard
   */
  async log(message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info'): Promise<void> {
    const timestamp = new Date().toISOString();
    const emoji = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    }[level];

    const entry = `**[${timestamp}]** ${emoji} ${message}\n\n`;

    // Atomic append with file locking
    await this.lock.withLock(async () => {
      // Read current content
      let current = '';
      try {
        current = await readFile(this.progressFile, 'utf-8');
      } catch (error: any) {
        // File doesn't exist yet - will be created by initialize()
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // Append new entry
      const updated = current + entry;

      // Atomic write
      await atomicWrite(this.progressFile, updated);
    });

    // Emit progress event for dashboard
    const event: ProgressEvent = {
      timestamp,
      message,
      level,
      phase: this.currentPhase,
      chapter: this.currentChapter,
    };
    this.emit('progress', event);
  }

  /**
   * Log chapter processing start
   */
  async startChapter(chapterNum: number, chapterTitle: string): Promise<void> {
    this.currentChapter = chapterNum;
    this.emit('chapter-start', { chapterNum, chapterTitle });

    await this.log(
      `Starting analysis of Chapter ${chapterNum}: ${chapterTitle}`,
      'info'
    );
  }

  /**
   * Log chapter processing completion
   */
  async completeChapter(
    chapterNum: number,
    chapterTitle: string,
    conceptsFound: number
  ): Promise<void> {
    this.stats.completedChapters++;
    this.stats.totalConcepts += conceptsFound;
    this.currentChapter = undefined;

    this.emit('chapter-complete', { chapterNum, chapterTitle, conceptsFound });
    this.updateAndEmitStats();

    await this.log(
      `Completed Chapter ${chapterNum}: ${chapterTitle} - Found ${conceptsFound} visual concepts`,
      'success'
    );
  }

  /**
   * Log element extraction start
   */
  async startElementExtraction(): Promise<void> {
    this.setPhase('extract');
    await this.log('Starting element extraction (characters, places, items...)', 'info');
  }

  /**
   * Log element extraction completion
   */
  async completeElementExtraction(elementsFound: number): Promise<void> {
    this.stats.totalElements = elementsFound;
    this.updateAndEmitStats();

    await this.log(
      `Completed element extraction - Found ${elementsFound} elements`,
      'success'
    );
  }

  /**
   * Log image generation
   */
  async logImageGeneration(elementName: string, success: boolean): Promise<void> {
    if (success) {
      this.stats.imagesGenerated++;
      this.emit('image-complete', { elementName });
      this.updateAndEmitStats();
    }

    await this.log(
      `Generated image for: ${elementName}`,
      success ? 'success' : 'error'
    );
  }

  /**
   * Log error
   */
  async logError(error: string): Promise<void> {
    await this.log(`Error: ${error}`, 'error');
  }

  /**
   * Set current phase and emit event
   */
  setPhase(phase: string): void {
    this.currentPhase = phase;
    this.emit('phase-start', { phase });
  }

  /**
   * Calculate ETA and emit stats update
   */
  private updateAndEmitStats(): void {
    this.stats.elapsedMs = Date.now() - this.startTime;

    // Calculate ETA if we have completed chapters
    if (this.stats.completedChapters > 0) {
      const avgTimePerChapter = this.stats.elapsedMs / this.stats.completedChapters;
      const remainingChapters = this.stats.totalChapters - this.stats.completedChapters;
      this.stats.eta = avgTimePerChapter * remainingChapters;
    }

    this.emit('stats', { ...this.stats });
  }

  /**
   * Get current state for dashboard API
   */
  getState(): any {
    return {
      bookTitle: this.bookTitle,
      currentPhase: this.currentPhase,
      currentChapter: this.currentChapter,
      stats: { ...this.stats },
      startTime: this.startTime,
    };
  }

  /**
   * Finalize progress report with summary
   *
   * Thread-safe: Uses lock for final summary append
   */
  async finalize(
    totalConcepts: number,
    totalElements: number,
    imagesGenerated: number
  ): Promise<void> {
    const elapsed = Date.now() - this.startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);

    const summary = `
---

## Summary

**Completed:** ${new Date().toISOString()}
**Duration:** ${minutes}m ${seconds}s
**Visual Concepts Found:** ${totalConcepts}
**Elements Extracted:** ${totalElements}
**Images Generated:** ${imagesGenerated}

✅ Processing complete! Check Contents.md and Elements.md for results.
`;

    // Atomic append with lock
    await this.lock.withLock(async () => {
      const current = await readFile(this.progressFile, 'utf-8');
      await atomicWrite(this.progressFile, current + summary);
    });

    await this.log('All processing complete!', 'success');
  }
}
