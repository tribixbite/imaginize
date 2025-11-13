/**
 * Series Elements Manager - Cross-book element sharing
 *
 * Manages element sharing across multiple books in a series:
 * - Imports existing elements to new books
 * - Exports new/enriched elements from books to series
 * - Merges elements with configurable strategies
 * - Generates series-wide element catalog
 *
 * Features:
 * - Progressive element discovery across books
 * - Smart merging with deduplication
 * - Thread-safe for concurrent processing
 * - Tracks element provenance (which book added what)
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import type { EntityMemory } from './elements-memory.js';
import { FileLock } from './file-lock.js';
import { atomicWriteJSON } from './atomic-write.js';

export interface SeriesEntityMemory extends EntityMemory {
  firstAppearance: {
    bookId: string;
    bookTitle: string;
    chapter: number;
  };
  appearances: Array<{
    bookId: string;
    bookTitle: string;
    chapters: number[];
  }>;
  enrichments: Array<{
    detail: string;
    sourceBook: string;
    sourceChapter: number;
    addedAt: string;
  }>;
}

export interface SeriesMemoryData {
  version: number;
  seriesName: string;
  lastUpdated: string;
  entities: Record<string, SeriesEntityMemory>;
  statistics: {
    totalEntities: number;
    totalEnrichments: number;
    booksProcessed: number;
  };
}

export interface ImportResult {
  imported: number;
  entities: string[];
}

export interface ExportResult {
  exported: number;
  entities: string[];
  added: number;
  updated: number;
  enriched: number;
}

type MergeStrategy = 'enrich' | 'union' | 'override';

/**
 * Create Series Elements Manager
 */
export function createSeriesElementsManager(seriesRoot: string) {
  const seriesMemoryPath = join(seriesRoot, '.series-elements-memory.json');
  const seriesCatalogPath = join(seriesRoot, 'Elements.md');
  const fileLock = new FileLock(seriesMemoryPath);

  let memory: Map<string, SeriesEntityMemory> = new Map();
  let seriesName = 'Untitled Series';
  let loaded = false;

  /**
   * Load series-wide elements memory
   */
  async function loadSeriesElements(): Promise<Map<string, SeriesEntityMemory>> {
    try {
      const content = await readFile(seriesMemoryPath, 'utf-8');
      const data: SeriesMemoryData = JSON.parse(content);

      memory.clear();
      for (const [name, entity] of Object.entries(data.entities)) {
        memory.set(name, entity);
      }

      seriesName = data.seriesName;
      loaded = true;

      return memory;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Series memory doesn't exist yet - start empty
        memory.clear();
        loaded = true;
        return memory;
      }
      throw error;
    }
  }

  /**
   * Save series memory
   */
  async function saveSeriesMemory(): Promise<void> {
    const data: SeriesMemoryData = {
      version: 1,
      seriesName,
      lastUpdated: new Date().toISOString(),
      entities: Object.fromEntries(memory.entries()),
      statistics: {
        totalEntities: memory.size,
        totalEnrichments: Array.from(memory.values()).reduce(
          (sum, e) => sum + e.enrichments.length,
          0
        ),
        booksProcessed: new Set(
          Array.from(memory.values()).map((e) => e.firstAppearance.bookId)
        ).size,
      },
    };

    await atomicWriteJSON(seriesMemoryPath, data);
  }

  /**
   * Import elements from series to book
   */
  async function importToBook(
    bookId: string,
    bookTitle: string,
    bookOutputDir: string
  ): Promise<ImportResult> {
    // Ensure series elements are loaded
    if (!loaded) {
      await loadSeriesElements();
    }

    if (memory.size === 0) {
      return { imported: 0, entities: [] };
    }

    // Create book-specific .elements-memory.json with series elements
    const bookMemoryPath = join(bookOutputDir, '.elements-memory.json');

    // Convert SeriesEntityMemory to EntityMemory (book format)
    const bookEntities: Record<string, EntityMemory> = {};

    for (const [name, seriesEntity] of memory.entries()) {
      // Create book-specific entity from series entity
      bookEntities[name] = {
        name: seriesEntity.name,
        type: seriesEntity.type,
        baseDescription: seriesEntity.baseDescription,
        enrichments: seriesEntity.enrichments.map((e) => ({
          detail: e.detail,
          sourceChapter: e.sourceChapter,
          addedAt: e.addedAt,
        })),
        lastUpdated: new Date().toISOString(),
      };
    }

    const bookMemory = {
      version: 1,
      lastUpdated: new Date().toISOString(),
      entities: bookEntities,
    };

    await atomicWriteJSON(bookMemoryPath, bookMemory);

    return {
      imported: memory.size,
      entities: Array.from(memory.keys()).slice(0, 5), // First 5 for logging
    };
  }

  /**
   * Export elements from book to series
   */
  async function exportFromBook(
    bookId: string,
    bookTitle: string,
    bookOutputDir: string,
    strategy: MergeStrategy = 'enrich'
  ): Promise<ExportResult> {
    // Ensure series elements are loaded
    if (!loaded) {
      await loadSeriesElements();
    }

    // Load book's .elements-memory.json
    const bookMemoryPath = join(bookOutputDir, '.elements-memory.json');

    let bookEntities: Map<string, EntityMemory>;
    try {
      const content = await readFile(bookMemoryPath, 'utf-8');
      const data = JSON.parse(content);

      bookEntities = new Map();
      for (const [name, entity] of Object.entries(data.entities as Record<string, EntityMemory>)) {
        bookEntities.set(name, entity);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Book has no elements yet
        return { exported: 0, entities: [], added: 0, updated: 0, enriched: 0 };
      }
      throw error;
    }

    // Merge book elements into series with file lock
    const result = await fileLock.withLock(async () => {
      // Reload series memory to get latest state
      await loadSeriesElements();

      return mergeElements(bookId, bookTitle, bookEntities, strategy);
    });

    // Save updated series memory
    await saveSeriesMemory();

    // Regenerate series catalog
    await generateSeriesCatalog();

    return result;
  }

  /**
   * Merge book elements into series
   */
  function mergeElements(
    bookId: string,
    bookTitle: string,
    bookEntities: Map<string, EntityMemory>,
    strategy: MergeStrategy
  ): ExportResult {
    let added = 0;
    let updated = 0;
    let enriched = 0;

    for (const [name, bookEntity] of bookEntities.entries()) {
      const existing = memory.get(name);

      if (!existing) {
        // New entity - add to series
        const seriesEntity: SeriesEntityMemory = {
          name: bookEntity.name,
          type: bookEntity.type,
          baseDescription: bookEntity.baseDescription,
          firstAppearance: {
            bookId,
            bookTitle,
            chapter: 1, // Default to chapter 1
          },
          appearances: [
            {
              bookId,
              bookTitle,
              chapters: [], // Will be populated from enrichments
            },
          ],
          enrichments: bookEntity.enrichments.map((e) => ({
            detail: e.detail,
            sourceBook: bookId,
            sourceChapter: e.sourceChapter,
            addedAt: e.addedAt,
          })),
          lastUpdated: new Date().toISOString(),
        };

        memory.set(name, seriesEntity);
        added++;
      } else {
        // Existing entity - merge based on strategy
        if (strategy === 'enrich') {
          // Add enrichments from book that don't exist in series
          const existingDetails = new Set(
            [existing.baseDescription, ...existing.enrichments.map((e) => e.detail)]
              .join(' ')
              .toLowerCase()
          );

          for (const bookEnrichment of bookEntity.enrichments) {
            if (!existingDetails.has(bookEnrichment.detail.toLowerCase())) {
              existing.enrichments.push({
                detail: bookEnrichment.detail,
                sourceBook: bookId,
                sourceChapter: bookEnrichment.sourceChapter,
                addedAt: new Date().toISOString(),
              });
              enriched++;
            }
          }

          // Update appearances
          const bookAppearance = existing.appearances.find((a) => a.bookId === bookId);
          if (!bookAppearance) {
            existing.appearances.push({
              bookId,
              bookTitle,
              chapters: [],
            });
          }

          existing.lastUpdated = new Date().toISOString();
          updated++;
        } else if (strategy === 'override') {
          // Replace with book version
          existing.baseDescription = bookEntity.baseDescription;
          existing.enrichments = bookEntity.enrichments.map((e) => ({
            detail: e.detail,
            sourceBook: bookId,
            sourceChapter: e.sourceChapter,
            addedAt: new Date().toISOString(),
          }));
          existing.lastUpdated = new Date().toISOString();
          updated++;
        } else if (strategy === 'union') {
          // Merge all enrichments
          for (const bookEnrichment of bookEntity.enrichments) {
            existing.enrichments.push({
              detail: bookEnrichment.detail,
              sourceBook: bookId,
              sourceChapter: bookEnrichment.sourceChapter,
              addedAt: new Date().toISOString(),
            });
            enriched++;
          }
          existing.lastUpdated = new Date().toISOString();
          updated++;
        }
      }
    }

    return {
      exported: bookEntities.size,
      entities: Array.from(bookEntities.keys()).slice(0, 5),
      added,
      updated,
      enriched,
    };
  }

  /**
   * Generate series-wide Elements.md catalog
   */
  async function generateSeriesCatalog(): Promise<void> {
    const lines: string[] = [];

    lines.push(`# ${seriesName} - Story Elements\n`);
    lines.push('Series-wide catalog of all characters, creatures, places, and items.\n');

    // Group by type
    const byType = new Map<string, SeriesEntityMemory[]>();

    for (const entity of memory.values()) {
      if (!byType.has(entity.type)) {
        byType.set(entity.type, []);
      }
      byType.get(entity.type)!.push(entity);
    }

    // Write each type section
    for (const [type, entities] of byType.entries()) {
      lines.push(`\n## ${type.charAt(0).toUpperCase() + type.slice(1)}s\n`);

      for (const entity of entities.sort((a, b) => a.name.localeCompare(b.name))) {
        lines.push(`### ${entity.name}\n`);
        lines.push(`**Type:** ${entity.type}\n`);
        lines.push(`**Description:** ${entity.baseDescription}\n`);
        lines.push(
          `**First Appearance:** ${entity.firstAppearance.bookTitle} (Chapter ${entity.firstAppearance.chapter})\n`
        );

        // Add appearances
        if (entity.appearances.length > 0) {
          lines.push('\n**Appears In:**');
          for (const appearance of entity.appearances) {
            lines.push(`\n- ${appearance.bookTitle}`);
          }
        }

        // Add enrichments
        if (entity.enrichments.length > 0) {
          lines.push('\n\n**Additional Details:**');
          for (const enrichment of entity.enrichments) {
            lines.push(
              `\n- ${enrichment.detail} _(${enrichment.sourceBook}, Chapter ${enrichment.sourceChapter})_`
            );
          }
        }

        lines.push('\n');
      }
    }

    const markdown = lines.join('\n');
    const { writeFile } = await import('fs/promises');
    await writeFile(seriesCatalogPath, markdown);
  }

  /**
   * Get series statistics
   */
  function getStats() {
    let totalEnrichments = 0;
    const booksProcessed = new Set<string>();

    for (const entity of memory.values()) {
      totalEnrichments += entity.enrichments.length;
      booksProcessed.add(entity.firstAppearance.bookId);
    }

    return {
      totalEntities: memory.size,
      totalEnrichments,
      booksProcessed: booksProcessed.size,
    };
  }

  /**
   * Set series name (for initialization)
   */
  function setSeriesName(name: string): void {
    seriesName = name;
  }

  return {
    loadSeriesElements,
    importToBook,
    exportFromBook,
    generateSeriesCatalog,
    getStats,
    setSeriesName,
    isLoaded: () => loaded,
  };
}

export type SeriesElementsManager = ReturnType<typeof createSeriesElementsManager>;
