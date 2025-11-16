/**
 * Series-wide element management (import, export, merge)
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type {
  SeriesElementsMemory,
  SeriesEntity,
  ImportExportResult,
  MergeResult,
  EntityEnrichment,
  BookEntityMemory,
} from './types.js';

const SERIES_ELEMENTS_FILE = '.series-elements-memory.json';
const BOOK_ELEMENTS_FILE = '.elements-memory.json';

/**
 * Create a series elements manager
 */
export function createSeriesElementsManager(seriesRoot: string) {
  const seriesElementsPath = join(seriesRoot, SERIES_ELEMENTS_FILE);

  /**
   * Load series-wide elements memory
   */
  async function loadSeriesElements(): Promise<SeriesElementsMemory> {
    try {
      if (!existsSync(seriesElementsPath)) {
        // Return empty memory if file doesn't exist
        return {
          version: 1,
          seriesName: '',
          lastUpdated: new Date().toISOString(),
          entities: {},
          statistics: {
            totalEntities: 0,
            totalEnrichments: 0,
            booksProcessed: 0,
          },
        };
      }

      const content = await readFile(seriesElementsPath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      throw new Error(`Failed to load series elements: ${error.message}`);
    }
  }

  /**
   * Save series-wide elements memory
   */
  async function saveSeriesElements(memory: SeriesElementsMemory): Promise<void> {
    try {
      memory.lastUpdated = new Date().toISOString();

      // Update statistics
      memory.statistics.totalEntities = Object.keys(memory.entities).length;
      memory.statistics.totalEnrichments = Object.values(memory.entities).reduce(
        (sum, entity) => sum + entity.enrichments.length,
        0
      );

      await writeFile(
        seriesElementsPath,
        JSON.stringify(memory, null, 2),
        'utf-8'
      );
    } catch (error: any) {
      throw new Error(`Failed to save series elements: ${error.message}`);
    }
  }

  /**
   * Load book-specific elements memory
   */
  async function loadBookElements(bookOutputDir: string): Promise<Map<string, BookEntityMemory>> {
    const bookElementsPath = join(bookOutputDir, BOOK_ELEMENTS_FILE);

    if (!existsSync(bookElementsPath)) {
      return new Map();
    }

    try {
      const content = await readFile(bookElementsPath, 'utf-8');
      const data = JSON.parse(content);
      return new Map(Object.entries(data.entities || {}));
    } catch (error: any) {
      throw new Error(`Failed to load book elements: ${error.message}`);
    }
  }

  /**
   * Import elements from series to book
   * Returns existing series entities for the AI to use during analysis
   */
  async function importToBook(
    bookId: string,
    bookOutputDir: string
  ): Promise<ImportExportResult> {
    const seriesMemory = await loadSeriesElements();
    const bookElements = await loadBookElements(bookOutputDir);

    let imported = 0;
    const importedNames: string[] = [];

    // Convert series entities to book-compatible format and merge
    for (const [name, seriesEntity] of Object.entries(seriesMemory.entities)) {
      // Build full description from base + enrichments
      const fullDescription =
        seriesEntity.baseDescription +
        (seriesEntity.enrichments.length > 0
          ? '\n\nAdditional details:\n- ' +
            seriesEntity.enrichments.map((e) => e.detail).join('\n- ')
          : '');

      // Create book entity memory
      const bookEntity: BookEntityMemory = {
        name: seriesEntity.name,
        type: seriesEntity.type,
        description: fullDescription,
        firstMentionedIn: seriesEntity.firstAppearance.chapter,
        appearsIn: [],
        enrichments: [], // Will be populated as book is processed
      };

      // Only import if not already in book (don't overwrite existing)
      if (!bookElements.has(name)) {
        bookElements.set(name, bookEntity);
        imported++;
        importedNames.push(name);
      }
    }

    // Save updated book elements
    if (imported > 0) {
      const bookElementsPath = join(bookOutputDir, BOOK_ELEMENTS_FILE);
      await writeFile(
        bookElementsPath,
        JSON.stringify(
          {
            version: 1,
            entities: Object.fromEntries(bookElements),
          },
          null,
          2
        ),
        'utf-8'
      );
    }

    return {
      count: imported,
      entities: importedNames,
    };
  }

  /**
   * Export and merge elements from book to series
   */
  async function exportFromBook(
    bookId: string,
    bookTitle: string,
    bookOutputDir: string
  ): Promise<ImportExportResult> {
    const bookElements = await loadBookElements(bookOutputDir);

    if (bookElements.size === 0) {
      return { count: 0, entities: [] };
    }

    // Merge book elements into series
    const mergeResult = await mergeElements(bookId, bookTitle, bookElements, 'enrich');

    return {
      count: mergeResult.added + mergeResult.updated + mergeResult.enriched,
      entities: Array.from(bookElements.keys()),
    };
  }

  /**
   * Merge book elements into series memory
   */
  async function mergeElements(
    bookId: string,
    bookTitle: string,
    bookElements: Map<string, BookEntityMemory>,
    strategy: 'enrich' | 'union' | 'override' = 'enrich'
  ): Promise<MergeResult> {
    const seriesMemory = await loadSeriesElements();

    let added = 0;
    let updated = 0;
    let enriched = 0;

    for (const [name, bookEntity] of bookElements.entries()) {
      const existingEntity = seriesMemory.entities[name];

      if (!existingEntity) {
        // New entity - add to series
        const newEntity: SeriesEntity = {
          name: bookEntity.name,
          type: bookEntity.type,
          baseDescription: bookEntity.description,
          firstAppearance: {
            bookId,
            bookTitle,
            chapter: bookEntity.firstMentionedIn || 1,
          },
          appearances: [
            {
              bookId,
              chapters: bookEntity.appearsIn || [],
            },
          ],
          enrichments: bookEntity.enrichments?.map((detail: string) => ({
            detail,
            sourceBook: bookId,
            sourceChapter: 0, // Could be enhanced to track chapter
            addedAt: new Date().toISOString(),
          })) || [],
          lastUpdated: new Date().toISOString(),
        };

        seriesMemory.entities[name] = newEntity;
        added++;
      } else {
        // Existing entity - merge based on strategy
        switch (strategy) {
          case 'enrich': {
            // Add new appearance
            const existingAppearance = existingEntity.appearances.find(
              (a) => a.bookId === bookId
            );

            if (!existingAppearance) {
              existingEntity.appearances.push({
                bookId,
                chapters: bookEntity.appearsIn || [],
              });
            } else {
              // Merge chapters
              const allChapters = new Set([
                ...existingAppearance.chapters,
                ...(bookEntity.appearsIn || []),
              ]);
              existingAppearance.chapters = Array.from(allChapters).sort((a, b) => a - b);
            }

            // Add enrichments from book
            if (bookEntity.enrichments && bookEntity.enrichments.length > 0) {
              for (const detail of bookEntity.enrichments) {
                // Check if enrichment already exists
                const exists = existingEntity.enrichments.some((e) => e.detail === detail);

                if (!exists) {
                  existingEntity.enrichments.push({
                    detail,
                    sourceBook: bookId,
                    sourceChapter: 0,
                    addedAt: new Date().toISOString(),
                  });
                  enriched++;
                }
              }
            }

            existingEntity.lastUpdated = new Date().toISOString();
            updated++;
            break;
          }

          case 'union': {
            // Combine descriptions
            existingEntity.baseDescription +=
              '\n\n' + bookEntity.description;

            // Add appearance
            existingEntity.appearances.push({
              bookId,
              chapters: bookEntity.appearsIn || [],
            });

            updated++;
            break;
          }

          case 'override': {
            // Replace with new description
            existingEntity.baseDescription = bookEntity.description;

            // Add appearance
            existingEntity.appearances.push({
              bookId,
              chapters: bookEntity.appearsIn || [],
            });

            updated++;
            break;
          }
        }
      }
    }

    // Update books processed count
    const uniqueBooks = new Set(
      Object.values(seriesMemory.entities).flatMap((entity) =>
        entity.appearances.map((a) => a.bookId)
      )
    );
    seriesMemory.statistics.booksProcessed = uniqueBooks.size;

    // Save updated series memory
    await saveSeriesElements(seriesMemory);

    return { added, updated, enriched };
  }

  /**
   * Generate series-wide Elements.md catalog
   */
  async function generateSeriesCatalog(seriesName: string): Promise<void> {
    const seriesMemory = await loadSeriesElements();
    const catalogPath = join(seriesRoot, 'Elements.md');

    // Group entities by type
    const byType: Record<string, SeriesEntity[]> = {
      character: [],
      creature: [],
      place: [],
      item: [],
      event: [],
      other: [],
    };

    for (const entity of Object.values(seriesMemory.entities)) {
      byType[entity.type].push(entity);
    }

    // Sort each type alphabetically
    for (const type of Object.keys(byType)) {
      byType[type].sort((a, b) => a.name.localeCompare(b.name));
    }

    // Generate markdown
    let markdown = `# ${seriesName} - Series Elements Catalog\n\n`;
    markdown += `**Total Elements**: ${seriesMemory.statistics.totalEntities}\n`;
    markdown += `**Books Processed**: ${seriesMemory.statistics.booksProcessed}\n`;
    markdown += `**Total Enrichments**: ${seriesMemory.statistics.totalEnrichments}\n\n`;
    markdown += `*Last Updated: ${new Date(seriesMemory.lastUpdated).toLocaleString()}*\n\n`;
    markdown += `---\n\n`;

    // Add each type section
    const typeLabels: Record<string, string> = {
      character: 'Characters',
      creature: 'Creatures',
      place: 'Places',
      item: 'Items',
      event: 'Events',
      other: 'Other Elements',
    };

    for (const [type, entities] of Object.entries(byType)) {
      if (entities.length === 0) continue;

      markdown += `## ${typeLabels[type]} (${entities.length})\n\n`;

      for (const entity of entities) {
        markdown += `### ${entity.name}\n\n`;
        markdown += `**Type**: ${entity.type}\n`;
        markdown += `**First Appearance**: ${entity.firstAppearance.bookTitle} (Chapter ${entity.firstAppearance.chapter})\n\n`;
        markdown += `${entity.baseDescription}\n\n`;

        if (entity.enrichments.length > 0) {
          markdown += `**Additional Details**:\n`;
          for (const enrichment of entity.enrichments) {
            markdown += `- ${enrichment.detail} *(from Book ${enrichment.sourceBook})*\n`;
          }
          markdown += `\n`;
        }

        // List all books where entity appears
        if (entity.appearances.length > 1) {
          markdown += `**Appears In**:\n`;
          for (const appearance of entity.appearances) {
            markdown += `- Book ${appearance.bookId}: Chapters ${appearance.chapters.join(', ')}\n`;
          }
          markdown += `\n`;
        }

        markdown += `---\n\n`;
      }
    }

    // Write catalog
    await writeFile(catalogPath, markdown, 'utf-8');
  }

  return {
    loadSeriesElements,
    saveSeriesElements,
    importToBook,
    exportFromBook,
    mergeElements,
    generateSeriesCatalog,
  };
}
