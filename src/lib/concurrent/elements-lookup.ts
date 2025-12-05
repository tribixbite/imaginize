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
  // Index: character name -> related items/objects (e.g., "deliverator" -> ["Deliverator's car", "samurai swords"])
  private characterItems: Map<string, string[]> = new Map();

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
      this.buildCharacterItemIndex();
      this.loaded = true;
      return true;
    } catch (error) {
      console.warn(`Failed to load Elements.md: ${error}`);
      return false;
    }
  }

  /**
   * Parse Elements.md markdown into structured data
   *
   * Supports multiple formats:
   * - ### Section headers with #### entries
   * - **Description:** field for element descriptions
   * - **Reference Quotes:** or **Appears in:** for appearances
   */
  private parseElements(markdown: string): void {
    this.elements.clear();

    // Split into sections by ### headers (section types like "### Characters")
    const sections = markdown.split(/^### /m).filter((s) => s.trim());

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
      // Format: #### Name\n**Description:** text\n**Reference Quotes:**...
      let currentName = '';
      let currentDesc = '';
      let currentAppearances: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('####')) {
          // Save previous entry
          if (currentName) {
            this.addElement(type, currentName, currentDesc, currentAppearances);
          }

          // Start new entry
          currentName = line.replace(/^####\s*/, '').trim();
          currentDesc = '';
          currentAppearances = [];
        } else if (line.startsWith('**Description:**')) {
          // Extract description from Description field
          const descMatch = line.match(/\*\*Description:\*\*\s*(.+)/);
          if (descMatch) {
            currentDesc = descMatch[1].trim();
          }
        } else if (
          line.startsWith('**Appears in:**') ||
          line.startsWith('**Reference Quotes:**')
        ) {
          // Extract chapter numbers or note presence
          const chapterMatch = line.match(
            /\*\*(?:Appears in|Reference Quotes):\*\*\s*(.+)/
          );
          if (chapterMatch) {
            currentAppearances = chapterMatch[1]
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s);
          }
        }
        // Skip other lines like quotes
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
   * Build index mapping characters to their related items/objects
   *
   * Matches items like "Deliverator's car" or "Hiro's katana" to their owner characters.
   * This enables automatic inclusion of character equipment/vehicles in image prompts.
   */
  private buildCharacterItemIndex(): void {
    this.characterItems.clear();

    // Get all characters
    const characters = this.getElementsByType('character');
    const items = [
      ...this.getElementsByType('object'),
      ...this.getElementsByType('creature'),
    ];

    for (const character of characters) {
      const charName = character.name.toLowerCase();
      const relatedItems: string[] = [];

      // Extract key name parts (e.g., "The Deliverator" -> ["deliverator", "the deliverator"])
      const nameParts = charName
        .split(/\s+/)
        .filter((p) => !['the', 'a', 'an'].includes(p));
      const keyNames = [charName, ...nameParts]; // Full name and individual significant parts

      // Check each item for character name reference
      for (const item of items) {
        const itemNameLower = item.name.toLowerCase();
        const itemDescLower = item.description.toLowerCase();

        // Check if item name contains any form of character name (e.g., "Deliverator's car")
        // Also check possessive forms for each key name variation
        let nameMatch = false;
        for (const keyName of keyNames) {
          const possessiveForms = [`${keyName}'s`, `${keyName}s`, keyName];
          if (possessiveForms.some((form) => itemNameLower.includes(form))) {
            nameMatch = true;
            break;
          }
        }

        // Also check if description explicitly mentions ownership
        let descMatch = false;
        for (const keyName of keyNames) {
          if (
            itemDescLower.includes(`${keyName}'s`) ||
            itemDescLower.includes(`belongs to ${keyName}`) ||
            itemDescLower.includes(`owned by ${keyName}`)
          ) {
            descMatch = true;
            break;
          }
        }

        if (nameMatch || descMatch) {
          relatedItems.push(item.name);
        }
      }

      if (relatedItems.length > 0) {
        this.characterItems.set(charName, relatedItems);
      }
    }
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
   * Also includes related items for any characters found (e.g., if "Deliverator" is found,
   * also includes "Deliverator's car" for accurate visual representation).
   *
   * @param text - Text to search for entity mentions
   * @returns Array of found elements
   */
  findMentions(text: string): Element[] {
    const found: Element[] = [];
    const foundKeys = new Set<string>(); // Track to avoid duplicates
    const charactersFound: string[] = []; // Track characters to add their items

    for (const [key, element] of this.elements) {
      // Check full name match (word boundary)
      const fullNameRegex = new RegExp(`\\b${this.escapeRegex(key)}\\b`, 'i');
      if (fullNameRegex.test(text)) {
        if (!foundKeys.has(key)) {
          found.push(element);
          foundKeys.add(key);
          if (element.type === 'character') {
            charactersFound.push(key);
          }
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
              if (element.type === 'character') {
                charactersFound.push(key);
              }
            }
            break;
          }
        }
      }
    }

    // Add related items for each character found
    // This ensures that when "Deliverator" is mentioned, we also include "Deliverator's car"
    for (const charKey of charactersFound) {
      const relatedItems = this.characterItems.get(charKey);
      if (relatedItems) {
        for (const itemName of relatedItems) {
          const itemKey = itemName.toLowerCase();
          if (!foundKeys.has(itemKey)) {
            const item = this.elements.get(itemKey);
            if (item) {
              found.push(item);
              foundKeys.add(itemKey);
            }
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
