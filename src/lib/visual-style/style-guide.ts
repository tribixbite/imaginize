/**
 * Visual Style Guide Management
 *
 * Utilities for creating, loading, and formatting visual style guides
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { VisualStyleGuide } from './types.js';

/**
 * Create a visual style guide from analyzed images
 */
export function createStyleGuide(
  artStyle: string,
  colorPalette: string[],
  lighting: string,
  mood: string,
  composition: string,
  consistencyScore: number,
  bootstrapCount: number
): VisualStyleGuide {
  return {
    artStyle,
    colorPalette,
    lighting,
    mood,
    composition,
    consistencyScore,
    createdAt: new Date().toISOString(),
    bootstrapCount,
  };
}

/**
 * Save style guide to disk
 */
export async function saveStyleGuide(
  outputDir: string,
  styleGuide: VisualStyleGuide
): Promise<void> {
  const dataDir = join(outputDir, 'data');

  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
  }

  const stylePath = join(dataDir, 'style-guide.json');
  await writeFile(stylePath, JSON.stringify(styleGuide, null, 2));
}

/**
 * Load style guide from disk
 */
export async function loadStyleGuide(
  outputDir: string
): Promise<VisualStyleGuide | null> {
  const stylePath = join(outputDir, 'data', 'style-guide.json');

  if (!existsSync(stylePath)) {
    return null;
  }

  try {
    const content = await readFile(stylePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load style guide:', error);
    return null;
  }
}

/**
 * Format style guide as a string for prompt inclusion
 */
export function formatStyleGuideForPrompt(styleGuide: VisualStyleGuide): string {
  return `VISUAL STYLE GUIDE (maintain consistency across all illustrations):
- Art Style: ${styleGuide.artStyle}
- Color Palette: ${styleGuide.colorPalette.join(', ')}
- Lighting: ${styleGuide.lighting}
- Mood: ${styleGuide.mood}
- Composition: ${styleGuide.composition}`;
}

/**
 * Validate style guide completeness
 */
export function isValidStyleGuide(styleGuide: any): styleGuide is VisualStyleGuide {
  return (
    typeof styleGuide === 'object' &&
    typeof styleGuide.artStyle === 'string' &&
    Array.isArray(styleGuide.colorPalette) &&
    typeof styleGuide.lighting === 'string' &&
    typeof styleGuide.mood === 'string' &&
    typeof styleGuide.composition === 'string' &&
    typeof styleGuide.consistencyScore === 'number' &&
    typeof styleGuide.createdAt === 'string' &&
    typeof styleGuide.bootstrapCount === 'number'
  );
}

/**
 * Merge two style guides (for refinement)
 */
export function mergeStyleGuides(
  existing: VisualStyleGuide,
  updated: Partial<VisualStyleGuide>
): VisualStyleGuide {
  return {
    ...existing,
    ...updated,
    createdAt: existing.createdAt, // Preserve original creation time
    lastUpdated: new Date().toISOString(),
  } as VisualStyleGuide;
}

/**
 * Calculate style similarity between two guides (0-1)
 */
export function calculateStyleSimilarity(
  guide1: VisualStyleGuide,
  guide2: VisualStyleGuide
): number {
  // Simple similarity based on matching keywords and color palette overlap
  let score = 0;
  let factors = 0;

  // Art style similarity (keyword matching)
  const style1Keywords = guide1.artStyle.toLowerCase().split(' ');
  const style2Keywords = guide2.artStyle.toLowerCase().split(' ');
  const styleOverlap =
    style1Keywords.filter(k => style2Keywords.includes(k)).length /
    Math.max(style1Keywords.length, style2Keywords.length);
  score += styleOverlap;
  factors++;

  // Color palette overlap
  const colorOverlap =
    guide1.colorPalette.filter(c => guide2.colorPalette.includes(c)).length /
    Math.max(guide1.colorPalette.length, guide2.colorPalette.length);
  score += colorOverlap;
  factors++;

  // Lighting similarity
  const lighting1Keywords = guide1.lighting.toLowerCase().split(' ');
  const lighting2Keywords = guide2.lighting.toLowerCase().split(' ');
  const lightingOverlap =
    lighting1Keywords.filter(k => lighting2Keywords.includes(k)).length /
    Math.max(lighting1Keywords.length, lighting2Keywords.length);
  score += lightingOverlap;
  factors++;

  // Mood similarity
  const mood1Keywords = guide1.mood.toLowerCase().split(' ');
  const mood2Keywords = guide2.mood.toLowerCase().split(' ');
  const moodOverlap =
    mood1Keywords.filter(k => mood2Keywords.includes(k)).length /
    Math.max(mood1Keywords.length, mood2Keywords.length);
  score += moodOverlap;
  factors++;

  return score / factors;
}
