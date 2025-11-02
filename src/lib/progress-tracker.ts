/**
 * Progress tracking for illustrate operations
 * Creates and updates progress.md file during processing
 */

import { writeFile, appendFile } from 'fs/promises';
import { join } from 'path';

export class ProgressTracker {
  private outputDir: string;
  private progressFile: string;
  private startTime: number;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    this.progressFile = join(outputDir, 'progress.md');
    this.startTime = Date.now();
  }

  /**
   * Initialize progress tracking file
   */
  async initialize(bookTitle: string, totalChapters: number): Promise<void> {
    const content = `# Illustrate Progress Report

**Book:** ${bookTitle}
**Started:** ${new Date().toISOString()}
**Total Chapters:** ${totalChapters}

---

## Progress Log

`;
    await writeFile(this.progressFile, content);
  }

  /**
   * Log a progress message
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
    await appendFile(this.progressFile, entry);
  }

  /**
   * Log chapter processing start
   */
  async startChapter(chapterNum: number, chapterTitle: string): Promise<void> {
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
    await this.log(
      `Completed Chapter ${chapterNum}: ${chapterTitle} - Found ${conceptsFound} visual concepts`,
      'success'
    );
  }

  /**
   * Log element extraction start
   */
  async startElementExtraction(): Promise<void> {
    await this.log('Starting element extraction (characters, places, items...)', 'info');
  }

  /**
   * Log element extraction completion
   */
  async completeElementExtraction(elementsFound: number): Promise<void> {
    await this.log(
      `Completed element extraction - Found ${elementsFound} elements`,
      'success'
    );
  }

  /**
   * Log image generation
   */
  async logImageGeneration(elementName: string, success: boolean): Promise<void> {
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
   * Finalize progress report with summary
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

    await appendFile(this.progressFile, summary);
    await this.log('All processing complete!', 'success');
  }
}
