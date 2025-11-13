/**
 * State management for imaginize
 * Manages .imaginize.state.json and coordinates with progress.md
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { IllustrateState, PhaseStatus, PhaseState, ChapterState } from '../types/config.js';
import { atomicWriteJSON } from './concurrent/atomic-write.js';

const STATE_VERSION = '2.0.0';

export class StateManager {
  private statePath: string;
  private state: IllustrateState;

  constructor(outputDir: string, bookFile: string, bookTitle: string, totalPages: number) {
    this.statePath = join(outputDir, '.imaginize.state.json');

    // Initialize state
    this.state = {
      version: STATE_VERSION,
      bookFile,
      bookTitle,
      totalPages,
      phases: {
        parse: { status: 'pending' },
        analyze: { status: 'pending' },
        extract: { status: 'pending' },
        illustrate: { status: 'pending' },
      },
      toc: { chapters: [] },
      tokenStats: { totalUsed: 0 },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Load existing state from disk
   */
  async load(): Promise<boolean> {
    if (!existsSync(this.statePath)) {
      return false;
    }

    try {
      const data = await readFile(this.statePath, 'utf-8');
      this.state = JSON.parse(data);

      // Version check
      if (this.state.version !== STATE_VERSION) {
        throw new Error(
          `State version mismatch. Found ${this.state.version}, expected ${STATE_VERSION}. Run: npx imaginize --migrate`
        );
      }

      return true;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to load state: ${err.message}`);
    }
  }

  /**
   * Save current state to disk using atomic write
   *
   * Uses temp file + rename pattern to prevent corruption if process crashes mid-write.
   */
  async save(): Promise<void> {
    this.state.lastUpdated = new Date().toISOString();
    await atomicWriteJSON(this.statePath, this.state);
  }

  /**
   * Get current state (read-only)
   */
  getState(): Readonly<IllustrateState> {
    return this.state;
  }

  /**
   * Update phase status
   */
  updatePhase(
    phase: keyof IllustrateState['phases'],
    status: PhaseStatus,
    data?: Partial<PhaseState>
  ): void {
    this.state.phases[phase] = {
      ...this.state.phases[phase],
      status,
      ...data,
      ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
    };
  }

  /**
   * Update chapter status within a phase
   */
  updateChapter(
    phase: keyof IllustrateState['phases'],
    chapterNumber: number,
    status: PhaseStatus,
    data?: Partial<ChapterState>
  ): void {
    if (!this.state.phases[phase].chapters) {
      this.state.phases[phase].chapters = {};
    }

    this.state.phases[phase].chapters![chapterNumber] = {
      ...this.state.phases[phase].chapters![chapterNumber],
      status,
      ...data,
      ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
    };

    // Update phase status if needed
    if (status === 'in_progress' && this.state.phases[phase].status === 'pending') {
      this.state.phases[phase].status = 'in_progress';
    }
  }

  /**
   * Update token statistics
   */
  updateTokenStats(tokensUsed: number, avgTokensPerPage?: number): void {
    this.state.tokenStats.totalUsed += tokensUsed;

    if (avgTokensPerPage) {
      // Running average
      this.state.avgTokensPerPage = this.state.avgTokensPerPage
        ? (this.state.avgTokensPerPage + avgTokensPerPage) / 2
        : avgTokensPerPage;
    }
  }

  /**
   * Update table of contents
   */
  updateTOC(chapters: Array<{ number: number; title: string; pages: string; tokenCount?: number }>): void {
    this.state.toc.chapters = chapters;
  }

  /**
   * Add or update element state
   */
  updateElement(type: string, name: string, status: PhaseStatus, imageUrl?: string): void {
    if (!this.state.elements) {
      this.state.elements = [];
    }

    const existing = this.state.elements.find(
      (e) => e.type === type && e.name.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      existing.status = status;
      if (imageUrl) existing.imageUrl = imageUrl;
    } else {
      this.state.elements.push({ type, name, status, imageUrl });
    }
  }

  /**
   * Check if specific chapter is completed for a phase
   */
  isChapterCompleted(phase: keyof IllustrateState['phases'], chapterNumber: number): boolean {
    return (
      this.state.phases[phase].chapters?.[chapterNumber]?.status === 'completed' ||
      false
    );
  }

  /**
   * Get incomplete chapters for a phase
   */
  getIncompleteChapters(phase: keyof IllustrateState['phases']): number[] {
    const allChapters = this.state.toc.chapters.map((c) => c.number);
    const completedChapters = Object.keys(this.state.phases[phase].chapters || {})
      .filter((key) => this.state.phases[phase].chapters![key].status === 'completed')
      .map(Number);

    return allChapters.filter((n) => !completedChapters.includes(n));
  }

  /**
   * Get failed chapters for a phase
   * Returns array of chapter numbers with status 'failed'
   */
  getFailedChapters(phase: keyof IllustrateState['phases']): number[] {
    if (!this.state.phases[phase].chapters) {
      return [];
    }

    return Object.keys(this.state.phases[phase].chapters!)
      .filter((key) => this.state.phases[phase].chapters![key].status === 'failed')
      .map(Number)
      .sort((a, b) => a - b);
  }

  /**
   * Get failed chapters with error details
   */
  getFailedChaptersWithErrors(phase: keyof IllustrateState['phases']): Array<{
    chapterNumber: number;
    error: string;
  }> {
    if (!this.state.phases[phase].chapters) {
      return [];
    }

    return Object.entries(this.state.phases[phase].chapters!)
      .filter(([_, chapterState]) => chapterState.status === 'failed')
      .map(([chapterNum, chapterState]) => ({
        chapterNumber: parseInt(chapterNum),
        error: chapterState.error || 'Unknown error',
      }))
      .sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  /**
   * Mark chapter as failed with error message
   */
  markChapterFailed(
    phase: keyof IllustrateState['phases'],
    chapterNumber: number,
    errorMessage: string
  ): void {
    this.updateChapter(phase, chapterNumber, 'failed', {
      error: errorMessage,
    });
  }

  /**
   * Clear error status for all chapters in a phase
   * Resets failed chapters to pending so they can be retried
   */
  clearChapterErrors(phase: keyof IllustrateState['phases']): number {
    if (!this.state.phases[phase].chapters) {
      return 0;
    }

    let clearedCount = 0;
    for (const [chapterNum, chapterState] of Object.entries(
      this.state.phases[phase].chapters
    )) {
      if (chapterState.status === 'failed') {
        this.state.phases[phase].chapters![chapterNum] = {
          ...chapterState,
          status: 'pending',
          error: undefined,
        };
        clearedCount++;
      }
    }

    return clearedCount;
  }

  /**
   * Get current phase and sub-phase
   */
  getCurrentPhase(): { phase: string; subPhase?: string; progress: string } | null {
    for (const [phaseName, phaseData] of Object.entries(this.state.phases)) {
      if (phaseData.status === 'in_progress') {
        const total = this.state.toc.chapters.length;
        const completed = Object.values(phaseData.chapters || {}).filter(
          (c) => c.status === 'completed'
        ).length;

        return {
          phase: phaseName,
          subPhase: phaseData.currentSubPhase,
          progress: `${completed}/${total} chapters`,
        };
      }
    }
    return null;
  }

  /**
   * Validate state consistency with actual files
   * Returns list of discrepancies
   */
  validateConsistency(contentsExists: boolean, elementsExists: boolean): string[] {
    const discrepancies: string[] = [];

    // Check if analyze phase is marked complete but Contents.md doesn't exist
    if (this.state.phases.analyze.status === 'completed' && !contentsExists) {
      discrepancies.push(
        'analyze phase marked complete but Contents.md is missing'
      );
    }

    // Check if extract phase is marked complete but Elements.md doesn't exist
    if (this.state.phases.extract.status === 'completed' && !elementsExists) {
      discrepancies.push(
        'extract phase marked complete but Elements.md is missing'
      );
    }

    // Check for chapters marked complete but missing from TOC
    for (const [phase, phaseData] of Object.entries(this.state.phases)) {
      if (phaseData.chapters) {
        for (const [chapterNum, chapterData] of Object.entries(phaseData.chapters)) {
          if (chapterData.status === 'completed') {
            const tocChapter = this.state.toc.chapters.find(
              (c) => c.number === Number(chapterNum)
            );
            if (!tocChapter) {
              discrepancies.push(
                `${phase} phase chapter ${chapterNum} marked complete but not in TOC`
              );
            }
          }
        }
      }
    }

    return discrepancies;
  }

  /**
   * Get summary for user display
   */
  getSummary(): string {
    const lines: string[] = [];
    lines.push(`Book: ${this.state.bookTitle}`);
    lines.push(`Total Pages: ${this.state.totalPages}`);
    lines.push(`Tokens Used: ${this.state.tokenStats.totalUsed.toLocaleString()}`);

    if (this.state.avgTokensPerPage) {
      lines.push(`Avg Tokens/Page: ${Math.round(this.state.avgTokensPerPage)}`);
    }

    lines.push('');
    lines.push('Phase Status:');

    for (const [phase, data] of Object.entries(this.state.phases)) {
      const emoji = {
        pending: '⏳',
        in_progress: '🔄',
        completed: '✅',
        failed: '❌',
      }[data.status];

      let statusLine = `  ${emoji} ${phase}: ${data.status}`;

      if (data.chapters) {
        const total = this.state.toc.chapters.length;
        const completed = Object.values(data.chapters).filter(
          (c) => c.status === 'completed'
        ).length;
        statusLine += ` (${completed}/${total} chapters)`;
      }

      lines.push(statusLine);
    }

    if (this.state.elements && this.state.elements.length > 0) {
      lines.push('');
      lines.push(`Elements: ${this.state.elements.length} extracted`);
      const withImages = this.state.elements.filter((e) => e.imageUrl).length;
      if (withImages > 0) {
        lines.push(`  Images: ${withImages}/${this.state.elements.length}`);
      }
    }

    return lines.join('\n');
  }
}
