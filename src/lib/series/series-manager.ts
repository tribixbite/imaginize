/**
 * Series configuration management
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import type { SeriesConfig, BookInfo, SeriesStats } from './types.js';

const SERIES_CONFIG_FILE = '.imaginize.series.json';

/**
 * Create a series manager for the given series root directory
 */
export function createSeriesManager(seriesRoot: string) {
  const seriesConfigPath = join(seriesRoot, SERIES_CONFIG_FILE);

  /**
   * Load series configuration
   */
  async function loadConfig(): Promise<SeriesConfig | null> {
    try {
      if (!existsSync(seriesConfigPath)) {
        return null;
      }

      const content = await readFile(seriesConfigPath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      throw new Error(`Failed to load series config: ${error.message}`);
    }
  }

  /**
   * Save series configuration
   */
  async function saveConfig(config: SeriesConfig): Promise<void> {
    try {
      // Ensure series root exists
      if (!existsSync(seriesRoot)) {
        await mkdir(seriesRoot, { recursive: true });
      }

      // Update timestamp
      config.lastUpdated = new Date().toISOString();

      // Write config
      await writeFile(seriesConfigPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error: any) {
      throw new Error(`Failed to save series config: ${error.message}`);
    }
  }

  /**
   * Initialize a new series
   */
  async function initializeSeries(options: {
    name: string;
    description?: string;
    firstBook?: {
      id: string;
      title: string;
      path: string;
    };
  }): Promise<SeriesConfig> {
    // Check if series already exists
    const existing = await loadConfig();
    if (existing) {
      throw new Error('Series configuration already exists');
    }

    const now = new Date().toISOString();

    const config: SeriesConfig = {
      version: 1,
      name: options.name,
      description: options.description,
      books: options.firstBook
        ? [
            {
              id: options.firstBook.id,
              title: options.firstBook.title,
              path: options.firstBook.path,
              order: 1,
              status: 'pending',
            },
          ]
        : [],
      sharedElements: {
        enabled: true,
        mode: 'progressive',
        mergeStrategy: 'enrich',
      },
      createdAt: now,
      lastUpdated: now,
    };

    await saveConfig(config);
    return config;
  }

  /**
   * Add a book to the series
   */
  async function addBook(bookInfo: Omit<BookInfo, 'order' | 'status'>): Promise<void> {
    const config = await loadConfig();
    if (!config) {
      throw new Error('Series configuration not found. Run "series init" first.');
    }

    // Check for duplicate book ID
    if (config.books.some((b) => b.id === bookInfo.id)) {
      throw new Error(`Book with ID "${bookInfo.id}" already exists in series`);
    }

    // Add book with auto-incremented order
    const newBook: BookInfo = {
      ...bookInfo,
      order: config.books.length + 1,
      status: 'pending',
    };

    config.books.push(newBook);
    await saveConfig(config);
  }

  /**
   * Update book status
   */
  async function updateBookStatus(
    bookId: string,
    status: BookInfo['status'],
    error?: string
  ): Promise<void> {
    const config = await loadConfig();
    if (!config) {
      throw new Error('Series configuration not found');
    }

    const book = config.books.find((b) => b.id === bookId);
    if (!book) {
      throw new Error(`Book "${bookId}" not found in series`);
    }

    book.status = status;
    if (error) {
      book.error = error;
    } else {
      delete book.error;
    }

    await saveConfig(config);
  }

  /**
   * Get book by ID
   */
  async function getBook(bookId: string): Promise<BookInfo | null> {
    const config = await loadConfig();
    if (!config) {
      return null;
    }

    return config.books.find((b) => b.id === bookId) || null;
  }

  /**
   * Get series statistics
   */
  async function getStats(): Promise<SeriesStats | null> {
    const config = await loadConfig();
    if (!config) {
      return null;
    }

    const completed = config.books.filter((b) => b.status === 'completed').length;
    const inProgress = config.books.filter((b) => b.status === 'in_progress').length;
    const pending = config.books.filter((b) => b.status === 'pending').length;

    return {
      name: config.name,
      totalBooks: config.books.length,
      completedBooks: completed,
      inProgressBooks: inProgress,
      pendingBooks: pending,
      totalEntities: 0, // Will be populated by series-elements.ts
      entitiesByType: {},
      totalEnrichments: 0,
    };
  }

  /**
   * Check if series configuration exists
   */
  function exists(): boolean {
    return existsSync(seriesConfigPath);
  }

  /**
   * Get series root directory
   */
  function getSeriesRoot(): string {
    return resolve(seriesRoot);
  }

  return {
    loadConfig,
    saveConfig,
    initializeSeries,
    addBook,
    updateBookStatus,
    getBook,
    getStats,
    exists,
    getSeriesRoot,
  };
}
