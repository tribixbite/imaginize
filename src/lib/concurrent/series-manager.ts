/**
 * Series Manager - Multi-book series coordination
 *
 * Manages series configuration, book registration, and status tracking
 * for multi-book series processing.
 *
 * Features:
 * - Series configuration management
 * - Book registration and ordering
 * - Status tracking (pending/in_progress/completed/error)
 * - Thread-safe file operations
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { FileLock } from './file-lock.js';
import { atomicWriteJSON } from './atomic-write.js';

export interface SeriesConfig {
  version: number;
  name: string;
  description?: string;
  books: BookInfo[];
  sharedElements: {
    enabled: boolean;
    mode: 'progressive' | 'manual';
    mergeStrategy: 'enrich' | 'union' | 'override';
  };
  visualStyle?: {
    inheritFromBook?: string;
    allowVariations?: boolean;
  };
  createdAt: string;
  lastUpdated: string;
}

export interface BookInfo {
  id: string;
  title: string;
  path: string;
  order: number;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  startedAt?: string;
  completedAt?: string;
}

export interface SeriesStats {
  name: string;
  totalBooks: number;
  booksByStatus: {
    pending: number;
    in_progress: number;
    completed: number;
    error: number;
  };
  createdAt: string;
  lastUpdated: string;
}

/**
 * Create Series Manager
 */
export function createSeriesManager(seriesRoot: string) {
  const configPath = join(seriesRoot, '.imaginize.series.json');
  const fileLock = new FileLock(configPath);

  let config: SeriesConfig | null = null;
  let loaded = false;

  /**
   * Load series configuration
   */
  async function loadConfig(): Promise<SeriesConfig | null> {
    try {
      const content = await readFile(configPath, 'utf-8');
      config = JSON.parse(content);
      loaded = true;
      return config;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Series configuration doesn't exist
        config = null;
        loaded = true;
        return null;
      }
      throw error;
    }
  }

  /**
   * Initialize new series
   */
  async function initializeSeries(initConfig: Partial<SeriesConfig>): Promise<void> {
    const now = new Date().toISOString();

    const newConfig: SeriesConfig = {
      version: 1,
      name: initConfig.name || 'Untitled Series',
      description: initConfig.description,
      books: initConfig.books || [],
      sharedElements: initConfig.sharedElements || {
        enabled: true,
        mode: 'progressive',
        mergeStrategy: 'enrich',
      },
      visualStyle: initConfig.visualStyle,
      createdAt: now,
      lastUpdated: now,
    };

    await atomicWriteJSON(configPath, newConfig);
    config = newConfig;
    loaded = true;
  }

  /**
   * Save configuration
   */
  async function saveConfig(): Promise<void> {
    if (!config) {
      throw new Error('No series configuration loaded');
    }

    config.lastUpdated = new Date().toISOString();
    await atomicWriteJSON(configPath, config);
  }

  /**
   * Add book to series
   */
  async function addBook(bookInfo: BookInfo): Promise<void> {
    await fileLock.withLock(async () => {
      // Reload to get latest state
      await loadConfig();

      if (!config) {
        throw new Error('Series not initialized');
      }

      // Check for duplicate ID
      if (config.books.some((b) => b.id === bookInfo.id)) {
        throw new Error(`Book with ID "${bookInfo.id}" already exists in series`);
      }

      // Add book
      config.books.push(bookInfo);

      // Save updated config
      await saveConfig();
    });
  }

  /**
   * Update book status
   */
  async function updateBookStatus(
    bookId: string,
    status: BookInfo['status']
  ): Promise<void> {
    await fileLock.withLock(async () => {
      // Reload to get latest state
      await loadConfig();

      if (!config) {
        throw new Error('Series not initialized');
      }

      const book = config.books.find((b) => b.id === bookId);
      if (!book) {
        throw new Error(`Book with ID "${bookId}" not found in series`);
      }

      // Update status and timestamps
      book.status = status;

      if (status === 'in_progress' && !book.startedAt) {
        book.startedAt = new Date().toISOString();
      }

      if (status === 'completed' && !book.completedAt) {
        book.completedAt = new Date().toISOString();
      }

      // Save updated config
      await saveConfig();
    });
  }

  /**
   * Get book by ID
   */
  function getBook(bookId: string): BookInfo | undefined {
    if (!config) return undefined;
    return config.books.find((b) => b.id === bookId);
  }

  /**
   * Get all books
   */
  function getBooks(): BookInfo[] {
    return config?.books || [];
  }

  /**
   * Get series statistics
   */
  function getStats(): SeriesStats | null {
    if (!config) return null;

    const booksByStatus = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      error: 0,
    };

    for (const book of config.books) {
      booksByStatus[book.status]++;
    }

    return {
      name: config.name,
      totalBooks: config.books.length,
      booksByStatus,
      createdAt: config.createdAt,
      lastUpdated: config.lastUpdated,
    };
  }

  /**
   * Check if series is loaded
   */
  function isLoaded(): boolean {
    return loaded;
  }

  /**
   * Get current configuration
   */
  function getConfig(): SeriesConfig | null {
    return config;
  }

  return {
    loadConfig,
    initializeSeries,
    addBook,
    updateBookStatus,
    getBook,
    getBooks,
    getStats,
    isLoaded,
    getConfig,
  };
}

export type SeriesManager = ReturnType<typeof createSeriesManager>;
