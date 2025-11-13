/**
 * Scene-level regeneration
 * Allows regenerating specific images without re-running analysis
 */

import { readFile } from 'fs/promises';
import { join, basename } from 'path';
import { existsSync } from 'fs';
import type { ImageConcept } from '../types/config.js';

export interface RegenerateOptions {
  outputDir: string;
  chapter?: number;
  scene?: number;
  sceneId?: string;
  all?: boolean;
}

export interface SceneIdentifier {
  chapterNumber: number;
  chapterTitle: string;
  sceneNumber: number;
  concept: ImageConcept;
  imageFilename?: string;
}

/**
 * Parse Chapters.md to extract all image concepts
 */
export async function loadImageConcepts(outputDir: string): Promise<Map<string, ImageConcept[]>> {
  const chaptersPath = join(outputDir, 'Chapters.md');

  if (!existsSync(chaptersPath)) {
    throw new Error('Chapters.md not found. Run analyze phase first.');
  }

  const content = await readFile(chaptersPath, 'utf-8');
  const lines = content.split('\n');

  const conceptsByChapter = new Map<string, ImageConcept[]>();
  let currentChapter: string | null = null;
  let currentConcept: Partial<ImageConcept> = {};
  let inJsonBlock = false;
  let jsonBuffer = '';

  for (const line of lines) {
    // Detect chapter heading
    if (line.startsWith('### ')) {
      currentChapter = line.replace('### ', '').trim();
      if (!conceptsByChapter.has(currentChapter)) {
        conceptsByChapter.set(currentChapter, []);
      }
      continue;
    }

    // Detect scene heading
    if (line.startsWith('#### Scene ')) {
      if (currentConcept.description) {
        // Save previous concept
        if (currentChapter) {
          conceptsByChapter.get(currentChapter)!.push(currentConcept as ImageConcept);
        }
      }
      currentConcept = {};
      continue;
    }

    // Parse JSON block
    if (line.startsWith('```json')) {
      inJsonBlock = true;
      jsonBuffer = '';
      continue;
    }

    if (line.startsWith('```') && inJsonBlock) {
      inJsonBlock = false;
      try {
        const parsed = JSON.parse(jsonBuffer);
        currentConcept = { ...currentConcept, ...parsed };
      } catch (error) {
        console.error('Failed to parse JSON:', jsonBuffer);
      }
      continue;
    }

    if (inJsonBlock) {
      jsonBuffer += line + '\n';
    }
  }

  // Save last concept
  if (currentConcept.description && currentChapter) {
    conceptsByChapter.get(currentChapter)!.push(currentConcept as ImageConcept);
  }

  return conceptsByChapter;
}

/**
 * Find scenes to regenerate based on options
 */
export async function findScenesToRegenerate(
  outputDir: string,
  options: RegenerateOptions
): Promise<SceneIdentifier[]> {
  const conceptsByChapter = await loadImageConcepts(outputDir);
  const scenes: SceneIdentifier[] = [];

  let sceneGlobalIndex = 0;

  for (const [chapterTitle, concepts] of conceptsByChapter.entries()) {
    for (let i = 0; i < concepts.length; i++) {
      const concept = concepts[i];
      const chapterNumber = concept.chapterNumber || 0;
      const sceneNumber = i + 1;
      sceneGlobalIndex++;

      // Check if this scene matches the selection criteria
      let matches = false;

      if (options.all) {
        matches = true;
      } else if (options.sceneId) {
        // Match by scene ID (format: "chapter_X_scene_Y")
        const sceneId = `chapter_${chapterNumber}_scene_${sceneNumber}`;
        matches = sceneId === options.sceneId;
      } else if (options.chapter && options.scene) {
        // Match by chapter and scene number
        matches = chapterNumber === options.chapter && sceneNumber === options.scene;
      } else if (options.chapter) {
        // Match all scenes in chapter
        matches = chapterNumber === options.chapter;
      } else if (options.scene) {
        // Match scene number across all chapters
        matches = sceneNumber === options.scene;
      }

      if (matches) {
        // Try to find existing image filename
        const sanitizedTitle = chapterTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 50);

        const imageFilename = `chapter_${chapterNumber}_${sanitizedTitle}_scene_${sceneNumber}.png`;
        const imagePath = join(outputDir, imageFilename);

        scenes.push({
          chapterNumber,
          chapterTitle,
          sceneNumber,
          concept,
          imageFilename: existsSync(imagePath) ? imageFilename : undefined,
        });
      }
    }
  }

  if (scenes.length === 0) {
    throw new Error('No scenes match the specified criteria');
  }

  return scenes;
}

/**
 * Generate scene ID for a given chapter and scene number
 */
export function generateSceneId(chapterNumber: number, sceneNumber: number): string {
  return `chapter_${chapterNumber}_scene_${sceneNumber}`;
}

/**
 * Parse scene ID into chapter and scene numbers
 */
export function parseSceneId(sceneId: string): { chapter: number; scene: number } | null {
  const match = sceneId.match(/^chapter_(\d+)_scene_(\d+)$/);
  if (!match) return null;

  return {
    chapter: parseInt(match[1]),
    scene: parseInt(match[2]),
  };
}
