/**
 * ElementsMemory - Progressive entity description enrichment
 *
 * During Pass 2 analysis, this system detects new details about entities
 * and appends them to Elements.md progressively as chapters are processed.
 *
 * Features:
 * - Deduplication: Only adds truly new information
 * - Thread-safe: Uses file locking for concurrent mode
 * - Smart merging: Preserves original descriptions
 * - Appearance tracking: Records chapter where details were found
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import type { ImageConcept } from '../../types/config.js';
import { FileLock } from './file-lock.js';
import { atomicWriteJSON } from './atomic-write.js';

export interface EntityMemory {
  name: string;
  type: 'character' | 'creature' | 'place' | 'item';
  baseDescription: string;
  enrichments: Array<{
    detail: string;
    sourceChapter: number;
    addedAt: string;
  }>;
  lastUpdated: string;
}

export interface MemoryUpdate {
  entityName: string;
  newDetails: string[];
  sourceChapter: number;
}

/**
 * Create Elements Memory manager
 */
export function createElementsMemory(outputDir: string) {
  const elementsPath = join(outputDir, 'Elements.md');
  const memoryPath = join(outputDir, '.elements-memory.json');
  const fileLock = new FileLock(memoryPath);

  let memory: Map<string, EntityMemory> = new Map();
  let loaded = false;

  /**
   * Load existing memory from .elements-memory.json
   */
  async function load(): Promise<void> {
    try {
      const content = await readFile(memoryPath, 'utf-8');
      const data = JSON.parse(content);

      memory.clear();
      for (const [name, entity] of Object.entries(data.entities || {})) {
        memory.set(name, entity as EntityMemory);
      }

      loaded = true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Memory file doesn't exist yet - initialize from Elements.md
        await initializeFromElements();
      } else {
        throw error;
      }
    }
  }

  /**
   * Initialize memory from existing Elements.md
   */
  async function initializeFromElements(): Promise<void> {
    try {
      const content = await readFile(elementsPath, 'utf-8');

      // Parse Elements.md to extract entities
      // Format: ## EntityName\n\n**Type:** type\n\n**Description:** description
      const entityRegex = /## ([^\n]+)\n\n\*\*Type:\*\* (character|creature|place|item)\n\n\*\*Description:\*\* ([^\n]+(?:\n(?!\n##)[^\n]+)*)/g;

      let match;
      while ((match = entityRegex.exec(content)) !== null) {
        const [, name, type, description] = match;

        memory.set(name.trim(), {
          name: name.trim(),
          type: type as any,
          baseDescription: description.trim(),
          enrichments: [],
          lastUpdated: new Date().toISOString(),
        });
      }

      loaded = true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Elements.md doesn't exist yet - start with empty memory
        memory.clear();
        loaded = true;
      } else {
        throw error;
      }
    }
  }

  /**
   * Extract potential new entity details from chapter analysis
   */
  function extractNewDetails(
    concept: ImageConcept,
    chapterNumber: number
  ): MemoryUpdate[] {
    const updates: MemoryUpdate[] = [];

    // Look for entity mentions in the visual description
    // Common patterns: "CHARACTER wearing/holding/with X"
    const description = concept.description || '';

    for (const [entityName, entityData] of memory.entries()) {
      // Check if entity is mentioned in this concept
      if (!description.toLowerCase().includes(entityName.toLowerCase())) {
        continue;
      }

      // Extract potential new details
      // Look for descriptive phrases that follow the entity name
      const nameIndex = description.toLowerCase().indexOf(entityName.toLowerCase());
      const afterName = description.slice(nameIndex + entityName.length);

      // Extract details using common patterns
      const patterns = [
        /wearing ([^,\.]+)/i,
        /holding ([^,\.]+)/i,
        /with ([^,\.]+)/i,
        /carrying ([^,\.]+)/i,
        /in ([^,\.]+)/i,
      ];

      const newDetails: string[] = [];

      for (const pattern of patterns) {
        const match = afterName.match(pattern);
        if (match) {
          const detail = match[1].trim();

          // Check if this detail is already in base description or enrichments
          const allDescriptions = [
            entityData.baseDescription,
            ...entityData.enrichments.map(e => e.detail),
          ].join(' ').toLowerCase();

          if (!allDescriptions.includes(detail.toLowerCase())) {
            newDetails.push(detail);
          }
        }
      }

      if (newDetails.length > 0) {
        updates.push({
          entityName,
          newDetails,
          sourceChapter: chapterNumber,
        });
      }
    }

    return updates;
  }

  /**
   * Apply memory updates (add enrichments)
   */
  async function applyUpdates(updates: MemoryUpdate[]): Promise<number> {
    if (updates.length === 0) {
      return 0;
    }

    let totalAdded = 0;

    // Thread-safe update with file lock
    await fileLock.withLock(async () => {
      // Reload memory to get latest state
      await load();

      const now = new Date().toISOString();

      for (const update of updates) {
        const entity = memory.get(update.entityName);
        if (!entity) continue;

        for (const detail of update.newDetails) {
          entity.enrichments.push({
            detail,
            sourceChapter: update.sourceChapter,
            addedAt: now,
          });
          totalAdded++;
        }

        entity.lastUpdated = now;
      }

      // Save updated memory
      await save();

      // Update Elements.md with enrichments
      await updateElementsMarkdown();
    });

    return totalAdded;
  }

  /**
   * Save memory to .elements-memory.json
   */
  async function save(): Promise<void> {
    const data = {
      version: 1,
      lastUpdated: new Date().toISOString(),
      entities: Object.fromEntries(memory.entries()),
    };

    await atomicWriteJSON(memoryPath, data);
  }

  /**
   * Update Elements.md with enriched descriptions
   */
  async function updateElementsMarkdown(): Promise<void> {
    const lines: string[] = [];

    lines.push('# Story Elements\n');
    lines.push('Comprehensive catalog of all characters, creatures, places, and items.\n');

    // Group by type
    const byType = new Map<string, EntityMemory[]>();

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
        lines.push(`**Description:** ${entity.baseDescription}`);

        // Add enrichments if any
        if (entity.enrichments.length > 0) {
          lines.push('\n\n**Additional Details:**');
          for (const enrichment of entity.enrichments) {
            lines.push(`\n- ${enrichment.detail} _(Chapter ${enrichment.sourceChapter})_`);
          }
        }

        lines.push('\n');
      }
    }

    const markdown = lines.join('\n');
    const { writeFile } = await import('fs/promises');
    await writeFile(elementsPath, markdown);
  }

  /**
   * Process chapter concepts and enrich memory
   */
  async function enrichFromConcepts(
    concepts: ImageConcept[],
    chapterNumber: number
  ): Promise<{ added: number; entities: string[] }> {
    // Ensure memory is loaded
    if (!loaded) {
      await load();
    }

    // Extract all potential updates
    const allUpdates: MemoryUpdate[] = [];

    for (const concept of concepts) {
      const updates = extractNewDetails(concept, chapterNumber);
      allUpdates.push(...updates);
    }

    if (allUpdates.length === 0) {
      return { added: 0, entities: [] };
    }

    // Apply updates
    const added = await applyUpdates(allUpdates);

    // Return summary
    const entities = [...new Set(allUpdates.map(u => u.entityName))];

    return { added, entities };
  }

  /**
   * Get enrichment statistics
   */
  function getStats(): {
    totalEntities: number;
    totalEnrichments: number;
    entitiesWithEnrichments: number;
  } {
    let totalEnrichments = 0;
    let entitiesWithEnrichments = 0;

    for (const entity of memory.values()) {
      totalEnrichments += entity.enrichments.length;
      if (entity.enrichments.length > 0) {
        entitiesWithEnrichments++;
      }
    }

    return {
      totalEntities: memory.size,
      totalEnrichments,
      entitiesWithEnrichments,
    };
  }

  return {
    load,
    enrichFromConcepts,
    getStats,
    isLoaded: () => loaded,
  };
}

export type ElementsMemory = ReturnType<typeof createElementsMemory>;
