/**
 * Visual Style Guide - Extracted from first N images
 * Ensures consistency across all subsequent images
 */
export interface VisualStyleGuide {
  /**
   * Art style description (e.g., "Digital illustration with soft brush strokes")
   */
  artStyle: string;

  /**
   * Dominant color palette (hex codes)
   */
  colorPalette: string[];

  /**
   * Lighting characteristics (e.g., "Natural daylight with warm undertones")
   */
  lighting: string;

  /**
   * Overall mood/atmosphere (e.g., "Whimsical and adventurous")
   */
  mood: string;

  /**
   * Common composition patterns (e.g., "Medium shots, rule of thirds")
   */
  composition: string;

  /**
   * Consistency score (0-1) - how consistent first N images were
   */
  consistencyScore: number;

  /**
   * Timestamp when style guide was created
   */
  createdAt: string;

  /**
   * Number of images analyzed to create this guide
   */
  bootstrapCount: number;
}

/**
 * Character Appearance - Track how a character looks
 */
export interface CharacterAppearance {
  /**
   * Character name (from Elements.md)
   */
  name: string;

  /**
   * First appearance information
   */
  firstAppearance: {
    chapterNumber: number;
    sceneNumber: number;
    imagePath: string;
    description: string; // From Elements.md
  };

  /**
   * Extracted visual features
   */
  visualFeatures: {
    hairColor?: string;
    hairStyle?: string;
    eyeColor?: string;
    skinTone?: string;
    build?: string; // tall, short, thin, muscular, etc.
    clothing: string[];
    distinguishingFeatures: string[];
  };

  /**
   * All appearances of this character
   */
  appearances: Array<{
    chapterNumber: number;
    sceneNumber: number;
    imagePath: string;
    consistencyScore: number; // 0-1, compared to first appearance
  }>;

  /**
   * Last updated timestamp
   */
  lastUpdated: string;
}

/**
 * Consistency Report - Validation results for a generated image
 */
export interface ConsistencyReport {
  chapterNumber: number;
  sceneNumber: number;
  imagePath: string;

  /**
   * How well this image matches the style guide (0-1)
   */
  styleConsistency: number;

  /**
   * Character-specific consistency scores
   */
  characterConsistency: {
    [characterName: string]: number; // 0-1
  };

  /**
   * Suggestions for improvement if consistency < threshold
   */
  suggestions: string[];

  /**
   * Timestamp of validation
   */
  validatedAt: string;
}

/**
 * Visual Style Registry - Manages style guide and character appearances
 */
export interface VisualStyleRegistry {
  /**
   * Book title
   */
  bookTitle: string;

  /**
   * Visual style guide (null until bootstrap phase complete)
   */
  styleGuide: VisualStyleGuide | null;

  /**
   * Character appearance registry
   */
  characters: Map<string, CharacterAppearance>;

  /**
   * Consistency reports for all generated images
   */
  consistencyReports: ConsistencyReport[];

  /**
   * Bootstrap phase status
   */
  bootstrap: {
    complete: boolean;
    imagesPaths: string[];
    targetCount: number;
  };

  /**
   * Last updated timestamp
   */
  lastUpdated: string;
}

/**
 * Visual Features extracted from an image
 */
export interface ExtractedVisualFeatures {
  artStyle: string;
  colorPalette: string[];
  lighting: string;
  mood: string;
  composition: string;
}
