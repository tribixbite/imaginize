/**
 * ElementsLookup - Parse and search Elements.md for entity details
 *
 * Enables enrichment of image prompts with consistent character/creature/place descriptions
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Entity type from Elements.md
 */
export type ElementType = 'character' | 'creature' | 'place' | 'object';

/**
 * Parsed entity from Elements.md
 */
export interface Element {
  type: ElementType;
  name: string;
  description: string;
  appearances: string[]; // Chapter numbers where it appears
}

/**
 * ElementsLookup - Service for searching and enriching with Elements.md data
 *
 * @example
 * const lookup = new ElementsLookup('imaginize_Book/Elements.md');
 * await lookup.load();
 *
 * const enriched = lookup.enrichPrompt(
 *   'A young wizard casting spells',
 *   ['Harry', 'Hogwarts']
 * );
 * // Returns: "A young wizard casting spells. Harry: [description]. Hogwarts: [description]."
 */
export class ElementsLookup {
  private filepath: string;
  private elements: Map<string, Element> = new Map();
  private loaded = false;

  /**
   * @param filepath - Path to Elements.md file
   */
  constructor(filepath: string) {
    this.filepath = filepath;
  }

  /**
   * Load and parse Elements.md
   *
   * Extracts structured data from markdown sections:
   * - ## Characters
   * - ## Creatures
   * - ## Places
   * - ## Objects
   *
   * @returns True if file loaded successfully
   */
  async load(): Promise<boolean> {
    if (!existsSync(this.filepath)) {
      return false;
    }

    try {
      const content = await readFile(this.filepath, 'utf-8');
      this.parseElements(content);
      this.loaded = true;
      return true;
    } catch (error) {
      console.warn(`Failed to load Elements.md: ${error}`);
      return false;
    }
  }

  /**
   * Parse Elements.md markdown into structured data
   */
  private parseElements(markdown: string): void {
    this.elements.clear();

    // Split into sections by ## headers
    const sections = markdown.split(/^## /m).filter((s) => s.trim());

    for (const section of sections) {
      const lines = section.split('\n');
      const header = lines[0].trim().toLowerCase();

      // Determine element type from section header
      let type: ElementType | null = null;
      if (header.includes('character')) type = 'character';
      else if (header.includes('creature')) type = 'creature';
      else if (header.includes('place') || header.includes('location')) type = 'place';
      else if (header.includes('object') || header.includes('item')) type = 'object';

      if (!type) continue;

      // Parse entries in section
      // Format: ### Name\nDescription\n**Appears in:** chapter list
      let currentName = '';
      let currentDesc = '';
      let currentAppearances: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('###')) {
          // Save previous entry
          if (currentName) {
            this.addElement(type, currentName, currentDesc, currentAppearances);
          }

          // Start new entry
          currentName = line.replace(/^###\s*/, '').trim();
          currentDesc = '';
          currentAppearances = [];
        } else if (line.startsWith('**Appears in:**')) {
          // Extract chapter numbers
          const chapterMatch = line.match(/\*\*Appears in:\*\*\s*(.+)/);
          if (chapterMatch) {
            currentAppearances = chapterMatch[1]
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s);
          }
        } else if (line && !line.startsWith('**')) {
          // Description line
          if (currentDesc) currentDesc += ' ';
          currentDesc += line;
        }
      }

      // Save last entry
      if (currentName) {
        this.addElement(type, currentName, currentDesc, currentAppearances);
      }
    }
  }

  /**
   * Add element to index
   */
  private addElement(
    type: ElementType,
    name: string,
    description: string,
    appearances: string[]
  ): void {
    // Use lowercase key for case-insensitive lookup
    const key = name.toLowerCase();

    this.elements.set(key, {
      type,
      name, // Preserve original capitalization
      description,
      appearances,
    });
  }

  /**
   * Look up element by name (case-insensitive)
   *
   * @param name - Entity name to search for
   * @returns Element data or null if not found
   */
  lookup(name: string): Element | null {
    return this.elements.get(name.toLowerCase()) || null;
  }

  /**
   * Search for entities mentioned in text
   *
   * @param text - Text to search for entity mentions
   * @returns Array of found elements
   */
  findMentions(text: string): Element[] {
    const found: Element[] = [];
    const foundKeys = new Set<string>(); // Track to avoid duplicates

    for (const [key, element] of this.elements) {
      // Check full name match (word boundary)
      const fullNameRegex = new RegExp(`\\b${this.escapeRegex(key)}\\b`, 'i');
      if (fullNameRegex.test(text)) {
        if (!foundKeys.has(key)) {
          found.push(element);
          foundKeys.add(key);
        }
        continue;
      }

      // For multi-word names (e.g., "Mal Arvorian"), also match individual words
      const nameParts = key.split(/\s+/);
      if (nameParts.length > 1) {
        // Check if any significant name part appears (skip common words like "the", "a")
        const significantParts = nameParts.filter(
          (part) => part.length > 2 && !['the', 'a', 'an', 'of'].includes(part)
        );

        for (const part of significantParts) {
          const partRegex = new RegExp(`\\b${this.escapeRegex(part)}\\b`, 'i');
          if (partRegex.test(text)) {
            if (!foundKeys.has(key)) {
              found.push(element);
              foundKeys.add(key);
            }
            break;
          }
        }
      }
    }

    return found;
  }

  /**
   * Escape regex special characters in entity names
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Enrich image prompt with entity details from Elements.md
   *
   * @param basePrompt - Original image generation prompt
   * @param entityNames - Optional explicit entity names to include
   * @returns Enriched prompt with entity descriptions appended
   *
   * @example
   * const enriched = lookup.enrichPrompt(
   *   'A young wizard in a castle',
   *   ['Harry Potter', 'Hogwarts']
   * );
   */
  enrichPrompt(basePrompt: string, entityNames?: string[]): string {
    if (!this.loaded) {
      // Elements.md not loaded - return original prompt
      return basePrompt;
    }

    let enrichedPrompt = basePrompt;
    const entitiesToAdd: Element[] = [];

    if (entityNames && entityNames.length > 0) {
      // Use explicitly provided entity names
      for (const name of entityNames) {
        const element = this.lookup(name);
        if (element) {
          entitiesToAdd.push(element);
        }
      }
    } else {
      // Auto-detect entities mentioned in prompt
      entitiesToAdd.push(...this.findMentions(basePrompt));
    }

    if (entitiesToAdd.length === 0) {
      return basePrompt;
    }

    // Append entity details to prompt
    enrichedPrompt += '\n\nCharacter/Entity Details:';

    for (const entity of entitiesToAdd) {
      enrichedPrompt += `\n- ${entity.name} (${entity.type}): ${entity.description}`;
    }

    return enrichedPrompt;
  }

  /**
   * Get all elements of a specific type
   *
   * @param type - Element type to filter by
   * @returns Array of elements matching type
   */
  getElementsByType(type: ElementType): Element[] {
    return Array.from(this.elements.values()).filter((e) => e.type === type);
  }

  /**
   * Get total count of loaded elements
   */
  getCount(): number {
    return this.elements.size;
  }

  /**
   * Check if Elements.md has been loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get all element names (for debugging/testing)
   */
  getAllNames(): string[] {
    return Array.from(this.elements.values()).map((e) => e.name);
  }
}

/**
 * Helper to create ElementsLookup for a book project
 *
 * @param outputDir - Book output directory
 * @returns ElementsLookup instance (not yet loaded - call .load())
 */
export function createElementsLookup(outputDir: string): ElementsLookup {
  return new ElementsLookup(`${outputDir}/Elements.md`);
}
