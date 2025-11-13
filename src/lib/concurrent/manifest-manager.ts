/**
 * ManifestManager - Centralized manifest updates with locking
 *
 * Provides thread-safe manifest operations for concurrent processing.
 * All manifest modifications MUST go through this manager to prevent corruption.
 */

import { readFile, access } from 'fs/promises';
import { existsSync } from 'fs';
import { FileLock } from './file-lock.js';
import { atomicWriteJSON } from './atomic-write.js';
import type {
  ConcurrentManifest,
  ManifestUpdater,
  ChapterStatus,
  ElementsStatus,
} from './types.js';

/**
 * Default manifest structure for new projects
 */
function createDefaultManifest(bookId: string): ConcurrentManifest {
  return {
    version: '3.0.0',
    book_id: bookId,
    elements_md_status: 'pending',
    analyze_complete: false,
    illustrate_complete: false,
    chapters: {},
    last_updated: new Date().toISOString(),
  };
}

/**
 * ManifestManager - Thread-safe manifest operations
 *
 * @example
 * const manager = new ManifestManager('imaginize_Book/.imaginize.manifest.json');
 *
 * // Update manifest atomically
 * await manager.update(manifest => {
 *   manifest.chapters['9'] = {
 *     status: 'analyzed',
 *     analyzed_at: new Date().toISOString(),
 *     concepts: 3
 *   };
 * });
 *
 * // Read manifest
 * const manifest = await manager.load();
 */
export class ManifestManager {
  private filepath: string;
  private lock: FileLock;

  /**
   * @param filepath - Path to manifest JSON file
   */
  constructor(filepath: string) {
    this.filepath = filepath;
    this.lock = new FileLock(filepath);
  }

  /**
   * Load manifest from disk
   *
   * @returns Current manifest or default if file doesn't exist
   */
  async load(): Promise<ConcurrentManifest> {
    try {
      const data = await readFile(this.filepath, 'utf-8');
      return JSON.parse(data) as ConcurrentManifest;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist - return default
        // Use filepath to infer book_id
        const bookId = this.filepath.split('/').slice(-2)[0] || 'unknown';
        return createDefaultManifest(bookId);
      }
      throw error;
    }
  }

  /**
   * Update manifest atomically with exclusive lock
   *
   * @param updater - Function to modify manifest (can be sync or async)
   *
   * @example
   * await manager.update(m => {
   *   m.chapters['9'].status = 'analyzed';
   * });
   */
  async update(updater: ManifestUpdater): Promise<void> {
    await this.lock.withLock(async () => {
      // Read current state
      const manifest = await this.load();

      // Apply updates
      await updater(manifest);

      // Update timestamp
      manifest.last_updated = new Date().toISOString();

      // Atomic write
      await atomicWriteJSON(this.filepath, manifest);
    });
  }

  /**
   * Initialize manifest with chapter list
   *
   * @param bookId - Book identifier
   * @param chapterNumbers - List of chapter numbers to initialize
   */
  async initialize(bookId: string, chapterNumbers: number[]): Promise<void> {
    await this.update((manifest) => {
      manifest.book_id = bookId;
      manifest.version = '3.0.0';
      manifest.elements_md_status = 'pending';
      manifest.analyze_complete = false;
      manifest.illustrate_complete = false;

      // Initialize all chapters as pending
      manifest.chapters = {};
      for (const num of chapterNumbers) {
        manifest.chapters[num.toString()] = {
          status: 'pending',
        };
      }
    });
  }

  /**
   * Update chapter status
   *
   * @param chapterNum - Chapter number
   * @param status - New status
   * @param metadata - Additional metadata (analyzed_at, concepts, etc.)
   */
  async updateChapter(
    chapterNum: number,
    status: ChapterStatus,
    metadata?: Partial<{
      analyzed_at: string;
      illustrated_at: string;
      concepts: number;
      error: string;
    }>
  ): Promise<void> {
    await this.update((manifest) => {
      const key = chapterNum.toString();
      if (!manifest.chapters[key]) {
        manifest.chapters[key] = { status: 'pending' };
      }

      manifest.chapters[key].status = status;

      // Merge metadata
      if (metadata) {
        Object.assign(manifest.chapters[key], metadata);
      }
    });
  }

  /**
   * Update Elements.md status
   */
  async updateElementsStatus(status: ElementsStatus): Promise<void> {
    await this.update((manifest) => {
      manifest.elements_md_status = status;
    });
  }

  /**
   * Mark analyze phase as complete
   */
  async markAnalyzeComplete(): Promise<void> {
    await this.update((manifest) => {
      manifest.analyze_complete = true;
    });
  }

  /**
   * Mark illustrate phase as complete
   */
  async markIllustrateComplete(): Promise<void> {
    await this.update((manifest) => {
      manifest.illustrate_complete = true;
    });
  }

  /**
   * Get all chapters with specific status
   *
   * @param status - Status to filter by
   * @returns Array of chapter numbers with that status
   */
  async getChaptersByStatus(status: ChapterStatus): Promise<number[]> {
    const manifest = await this.load();
    return Object.entries(manifest.chapters)
      .filter(([_, ch]) => ch.status === status)
      .map(([num, _]) => parseInt(num))
      .sort((a, b) => a - b);
  }

  /**
   * Check if manifest file exists
   */
  exists(): boolean {
    return existsSync(this.filepath);
  }

  /**
   * Wait for Elements.md to be ready
   *
   * Polls manifest until elements_md_status is 'complete'
   *
   * @param intervalMs - Poll interval (default 5s)
   * @param timeoutMs - Timeout (default 30 minutes)
   */
  async waitForElementsReady(
    intervalMs = 5000,
    timeoutMs = 30 * 60 * 1000
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const manifest = await this.load();

      if (manifest.elements_md_status === 'complete') {
        return;
      }

      // Wait and retry
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Elements.md not ready after ${timeoutMs}ms`);
  }
}

/**
 * Helper function to create a manifest manager for a book project
 *
 * @param outputDir - Book output directory (e.g., 'imaginize_ImpossibleCreatures')
 * @returns ManifestManager instance
 */
export function createManifestManager(outputDir: string): ManifestManager {
  const manifestPath = `${outputDir}/.imaginize.manifest.json`;
  return new ManifestManager(manifestPath);
}
