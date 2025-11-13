/**
 * Visual Style System Types
 *
 * Type definitions for the automatic style consistency system.
 * Based on docs/specs/visual-style-system.md
 */

/**
 * Color palette characteristics extracted from images
 */
export interface ColorPalette {
  dominantColors: string[]; // Hex color codes
  temperature: 'warm' | 'cool' | 'neutral';
  saturation: 'low' | 'moderate' | 'high' | 'vibrant';
  description: string; // Human-readable color palette description
}

/**
 * Composition and framing characteristics
 */
export interface Composition {
  framing: string; // e.g., "medium-wide shots", "close-ups"
  perspective: string; // e.g., "eye-level", "low angle", "bird's eye"
  focalPoints: string; // e.g., "rule of thirds", "center-focused"
  description: string;
}

/**
 * Art style and technique characteristics
 */
export interface ArtStyle {
  technique: string; // e.g., "digital painting", "watercolor", "cel-shaded"
  detailLevel: string; // e.g., "high detail", "stylized simplicity"
  lineWork?: string; // e.g., "bold outlines", "soft edges"
  textures?: string; // e.g., "visible brush strokes", "smooth gradients"
  description: string;
}

/**
 * Lighting characteristics
 */
export interface Lighting {
  quality: string; // e.g., "soft, diffused", "hard, dramatic"
  direction: string; // e.g., "three-quarter front", "backlighting"
  mood: string; // e.g., "mysterious", "cheerful", "ominous"
  timeOfDay?: string; // e.g., "golden hour", "midnight", "overcast"
  description: string;
}

/**
 * Character design characteristics
 */
export interface CharacterDesign {
  proportions: string; // e.g., "realistic", "anime-style", "chibi"
  realism: string; // e.g., "photorealistic", "semi-realistic", "stylized"
  clothingDetail: string; // e.g., "highly detailed", "simplified shapes"
  description: string;
}

/**
 * Overall mood and atmosphere
 */
export interface MoodAtmosphere {
  tone: string; // e.g., "dark and gritty", "whimsical and light"
  emotional: string; // e.g., "tense", "joyful", "melancholic"
  description: string;
}

/**
 * Complete style guide structure
 */
export interface StyleGuideData {
  colorPalette: ColorPalette;
  composition: Composition;
  artStyle: ArtStyle;
  lighting: Lighting;
  characterDesign: CharacterDesign;
  moodAtmosphere: MoodAtmosphere;
}

/**
 * Style guide with metadata
 */
export interface StyleGuide {
  version: number; // Format version (currently 1)
  generatedAt: string; // ISO timestamp
  analyzedImages: string[]; // Filenames of images analyzed
  bookGenre: string; // Genre from config
  styleGuide: StyleGuideData;
  promptTemplate: string; // Condensed style description for prompts
}

/**
 * Character appearance tracking
 */
export interface CharacterAppearance {
  name: string;
  type: string; // 'character', 'creature', etc.
  chapterNumber: number;
  sceneNumber: number;
  imageFilename: string;
  visualDescription: string;
  firstAppearance: boolean;
}

/**
 * Character registry for tracking appearances
 */
export interface CharacterRegistry {
  version: number;
  updatedAt: string;
  characters: Record<string, CharacterAppearance[]>; // Key: character name
}
