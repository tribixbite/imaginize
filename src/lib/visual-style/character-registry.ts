/**
 * Character Registry - Track character appearances for visual consistency
 *
 * Ensures characters look the same across all images in the book
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { CharacterAppearance } from './types.js';

export class CharacterRegistry {
  private characters: Map<string, CharacterAppearance> = new Map();
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  /**
   * Load character registry from disk
   */
  async load(): Promise<void> {
    const registryPath = join(this.outputDir, 'data', 'character-registry.json');

    if (!existsSync(registryPath)) {
      return;
    }

    try {
      const content = await readFile(registryPath, 'utf-8');
      const data = JSON.parse(content);

      // Convert array to Map
      if (Array.isArray(data.characters)) {
        for (const char of data.characters) {
          this.characters.set(char.name.toLowerCase(), char);
        }
      }
    } catch (error) {
      console.error('Failed to load character registry:', error);
    }
  }

  /**
   * Save character registry to disk
   */
  async save(): Promise<void> {
    const dataDir = join(this.outputDir, 'data');

    // Ensure data directory exists
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    const registryPath = join(dataDir, 'character-registry.json');

    const data = {
      characters: Array.from(this.characters.values()),
      lastUpdated: new Date().toISOString(),
    };

    await writeFile(registryPath, JSON.stringify(data, null, 2));
  }

  /**
   * Register a character's first appearance
   */
  async registerFirstAppearance(
    characterName: string,
    chapterNumber: number,
    sceneNumber: number,
    imagePath: string,
    description: string
  ): Promise<void> {
    const key = characterName.toLowerCase();

    // Skip if already registered
    if (this.characters.has(key)) {
      return;
    }

    // Extract visual features from description
    const features = this.extractVisualFeatures(description);

    const appearance: CharacterAppearance = {
      name: characterName,
      firstAppearance: {
        chapterNumber,
        sceneNumber,
        imagePath,
        description,
      },
      visualFeatures: features,
      appearances: [
        {
          chapterNumber,
          sceneNumber,
          imagePath,
          consistencyScore: 1.0, // First appearance is baseline
        },
      ],
      lastUpdated: new Date().toISOString(),
    };

    this.characters.set(key, appearance);
    await this.save();
  }

  /**
   * Record a subsequent appearance of a character
   */
  async recordAppearance(
    characterName: string,
    chapterNumber: number,
    sceneNumber: number,
    imagePath: string,
    consistencyScore: number = 0
  ): Promise<void> {
    const key = characterName.toLowerCase();
    const character = this.characters.get(key);

    if (!character) {
      console.warn(`Character "${characterName}" not registered. Call registerFirstAppearance first.`);
      return;
    }

    character.appearances.push({
      chapterNumber,
      sceneNumber,
      imagePath,
      consistencyScore,
    });

    character.lastUpdated = new Date().toISOString();

    await this.save();
  }

  /**
   * Get character appearance reference for prompt inclusion
   */
  getCharacterReference(characterName: string): string | null {
    const key = characterName.toLowerCase();
    const character = this.characters.get(key);

    if (!character) {
      return null;
    }

    const features = character.visualFeatures;
    const parts: string[] = [];

    parts.push(`${character.name} - Appearance Reference:`);

    if (features.hairColor || features.hairStyle) {
      const hairDesc = [features.hairColor, features.hairStyle].filter(Boolean).join(', ');
      parts.push(`  • Hair: ${hairDesc}`);
    }

    if (features.eyeColor) {
      parts.push(`  • Eyes: ${features.eyeColor}`);
    }

    if (features.skinTone) {
      parts.push(`  • Skin: ${features.skinTone}`);
    }

    if (features.build) {
      parts.push(`  • Build: ${features.build}`);
    }

    if (features.clothing.length > 0) {
      parts.push(`  • Clothing: ${features.clothing.join(', ')}`);
    }

    if (features.distinguishingFeatures.length > 0) {
      parts.push(`  • Distinguishing: ${features.distinguishingFeatures.join(', ')}`);
    }

    parts.push(`  • First seen: Chapter ${character.firstAppearance.chapterNumber}, Scene ${character.firstAppearance.sceneNumber}`);
    parts.push(`  • IMPORTANT: Maintain visual consistency with previous ${character.appearances.length} appearance(s)`);

    return parts.join('\n');
  }

  /**
   * Get character by name
   */
  getCharacter(characterName: string): CharacterAppearance | null {
    return this.characters.get(characterName.toLowerCase()) || null;
  }

  /**
   * Check if character is registered
   */
  hasCharacter(characterName: string): boolean {
    return this.characters.has(characterName.toLowerCase());
  }

  /**
   * Get all registered characters
   */
  getAllCharacters(): CharacterAppearance[] {
    return Array.from(this.characters.values());
  }

  /**
   * Get character count
   */
  getCount(): number {
    return this.characters.size;
  }

  /**
   * Extract visual features from description text
   */
  private extractVisualFeatures(description: string): CharacterAppearance['visualFeatures'] {
    const features: CharacterAppearance['visualFeatures'] = {
      clothing: [],
      distinguishingFeatures: [],
    };

    const lower = description.toLowerCase();

    // Extract hair information
    const hairColorMatches = lower.match(/\b(blonde|brown|black|red|gray|grey|white|silver|dark|light)\s+hair\b/i);
    if (hairColorMatches) {
      features.hairColor = hairColorMatches[1];
    }

    const hairStyleMatches = lower.match(/\b(long|short|curly|straight|wavy|tousled|windblown|braided)\s+(hair|locks)\b/i);
    if (hairStyleMatches) {
      features.hairStyle = hairStyleMatches[1];
    }

    // Extract eye color
    const eyeColorMatches = lower.match(/\b(blue|brown|green|gray|grey|hazel|amber|dark|bright)\s+(eyes|gaze)\b/i);
    if (eyeColorMatches) {
      features.eyeColor = eyeColorMatches[1];
    }

    // Extract build
    const buildMatches = lower.match(/\b(tall|short|thin|slender|muscular|stocky|gangly|petite|large|small)\s+(build|frame|figure)\b/i);
    if (buildMatches) {
      features.build = buildMatches[1];
    }

    // Extract clothing (simplified - look for common clothing items)
    const clothingKeywords = ['coat', 'jacket', 'dress', 'robe', 'cloak', 'shirt', 'tunic', 'armor', 'uniform'];
    for (const item of clothingKeywords) {
      if (lower.includes(item)) {
        // Try to get descriptor before clothing item
        const regex = new RegExp(`(\\w+)\\s+${item}`, 'i');
        const match = description.match(regex);
        if (match) {
          features.clothing.push(`${match[1]} ${item}`);
        } else {
          features.clothing.push(item);
        }
      }
    }

    // Extract distinguishing features
    const distinguishingKeywords = ['scar', 'tattoo', 'mark', 'birthmark', 'beard', 'mustache', 'glasses', 'spectacles'];
    for (const feature of distinguishingKeywords) {
      if (lower.includes(feature)) {
        features.distinguishingFeatures.push(feature);
      }
    }

    return features;
  }
}

/**
 * Create a new character registry
 */
export function createCharacterRegistry(outputDir: string): CharacterRegistry {
  return new CharacterRegistry(outputDir);
}
