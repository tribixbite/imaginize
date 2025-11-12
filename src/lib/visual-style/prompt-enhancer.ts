/**
 * Prompt Enhancer - Enrich image generation prompts with style and character info
 *
 * Takes base scene descriptions and adds:
 * - Visual style guide tokens
 * - Character appearance references
 * - Consistency markers
 */

import type { ImageConcept } from '../../types/config.js';
import type { VisualStyleGuide } from './types.js';
import type { CharacterRegistry } from './character-registry.js';
import { formatStyleGuideForPrompt } from './style-guide.js';

/**
 * Extract character names from description text
 */
export function extractCharacterNames(text: string): string[] {
  const names: string[] = [];

  // Common patterns for character mentions
  // Look for capitalized names (simple approach)
  const words = text.split(/\s+/);
  const capitalizedWords = words.filter(word =>
    /^[A-Z][a-z]+/.test(word) && word.length > 2
  );

  // Remove duplicates
  return Array.from(new Set(capitalizedWords));
}

/**
 * Enhanced prompt with style guide and character references
 */
export interface EnhancedPrompt {
  fullPrompt: string;
  sections: {
    styleGuide?: string;
    characterReferences?: string;
    sceneDescription: string;
    consistencyReminder: string;
  };
}

/**
 * Enhance an image generation prompt with style and character info
 */
export function enhanceImagePrompt(
  concept: ImageConcept,
  styleGuide: VisualStyleGuide | null,
  characterRegistry: CharacterRegistry | null,
  charactersInScene?: string[]
): EnhancedPrompt {
  const sections: EnhancedPrompt['sections'] = {
    sceneDescription: '',
    consistencyReminder: '',
  };

  // Build prompt sections
  const parts: string[] = [];

  // 1. Scene description (always present)
  sections.sceneDescription = buildSceneDescription(concept);
  parts.push(sections.sceneDescription);

  // 2. Visual style guide (if available)
  if (styleGuide) {
    sections.styleGuide = formatStyleGuideForPrompt(styleGuide);
    parts.push('', sections.styleGuide);
  }

  // 3. Character references (if available)
  if (characterRegistry) {
    const characters = charactersInScene || extractCharacterNames(concept.description);

    if (characters.length > 0) {
      const characterRefs: string[] = [];

      for (const charName of characters) {
        const reference = characterRegistry.getCharacterReference(charName);
        if (reference) {
          characterRefs.push(reference);
        }
      }

      if (characterRefs.length > 0) {
        sections.characterReferences =
          'CHARACTER APPEARANCES (maintain visual consistency):\n' +
          characterRefs.join('\n\n');
        parts.push('', sections.characterReferences);
      }
    }
  }

  // 4. Consistency reminder
  sections.consistencyReminder = buildConsistencyReminder(styleGuide, characterRegistry);
  parts.push('', sections.consistencyReminder);

  return {
    fullPrompt: parts.join('\n'),
    sections,
  };
}

/**
 * Build scene description section
 */
function buildSceneDescription(concept: ImageConcept): string {
  const parts: string[] = [];

  parts.push('Create an illustration for this scene:');
  parts.push('');

  // Quote (primary source)
  if (concept.quote) {
    parts.push(`"${concept.quote}"`);
    parts.push('');
  }

  // Visual description
  parts.push('SCENE DESCRIPTION:');
  parts.push(concept.description);

  // Mood/lighting (if specified)
  if (concept.mood) {
    parts.push('');
    parts.push(`Mood: ${concept.mood}`);
  }

  if (concept.lighting) {
    parts.push(`Lighting: ${concept.lighting}`);
  }

  return parts.join('\n');
}

/**
 * Build consistency reminder based on available guides
 */
function buildConsistencyReminder(
  styleGuide: VisualStyleGuide | null,
  characterRegistry: CharacterRegistry | null
): string {
  const reminders: string[] = [];

  if (styleGuide) {
    reminders.push(
      `- Maintain the established visual style (art: ${styleGuide.artStyle})`
    );
    reminders.push(`- Use the defined color palette`);
    reminders.push(`- Match the lighting and mood characteristics`);
  }

  if (characterRegistry && characterRegistry.getCount() > 0) {
    reminders.push(
      `- Ensure character appearances match their previous depictions`
    );
    reminders.push(`- Maintain visual consistency for all recurring characters`);
  }

  if (reminders.length === 0) {
    return 'Create a visually compelling illustration that captures the essence of this scene.';
  }

  return `IMPORTANT - Maintain Consistency:\n${reminders.join('\n')}`;
}

/**
 * Enhance multiple prompts (batch operation)
 */
export function enhanceImagePrompts(
  concepts: ImageConcept[],
  styleGuide: VisualStyleGuide | null,
  characterRegistry: CharacterRegistry | null
): EnhancedPrompt[] {
  return concepts.map(concept =>
    enhanceImagePrompt(concept, styleGuide, characterRegistry)
  );
}

/**
 * Get character count in enhanced prompt
 */
export function getCharacterCountInPrompt(enhanced: EnhancedPrompt): number {
  if (!enhanced.sections.characterReferences) {
    return 0;
  }

  // Count character reference sections (simple heuristic)
  const matches = enhanced.sections.characterReferences.match(/Appearance Reference:/g);
  return matches ? matches.length : 0;
}

/**
 * Check if prompt is enhanced with style guide
 */
export function hasStyleGuide(enhanced: EnhancedPrompt): boolean {
  return !!enhanced.sections.styleGuide;
}

/**
 * Check if prompt is enhanced with character references
 */
export function hasCharacterReferences(enhanced: EnhancedPrompt): boolean {
  return !!enhanced.sections.characterReferences;
}

/**
 * Get prompt statistics
 */
export interface PromptStats {
  totalLength: number;
  hasStyleGuide: boolean;
  characterCount: number;
  sectionCount: number;
}

export function getPromptStats(enhanced: EnhancedPrompt): PromptStats {
  return {
    totalLength: enhanced.fullPrompt.length,
    hasStyleGuide: hasStyleGuide(enhanced),
    characterCount: getCharacterCountInPrompt(enhanced),
    sectionCount: Object.values(enhanced.sections).filter(Boolean).length,
  };
}

/**
 * Format enhanced prompt for display/logging
 */
export function formatEnhancedPrompt(enhanced: EnhancedPrompt): string {
  const stats = getPromptStats(enhanced);
  const parts: string[] = [];

  parts.push('='.repeat(80));
  parts.push('ENHANCED IMAGE GENERATION PROMPT');
  parts.push(`Length: ${stats.totalLength} chars | Sections: ${stats.sectionCount}`);
  if (stats.hasStyleGuide) {
    parts.push('✓ Style Guide Applied');
  }
  if (stats.characterCount > 0) {
    parts.push(`✓ ${stats.characterCount} Character Reference(s)`);
  }
  parts.push('='.repeat(80));
  parts.push('');
  parts.push(enhanced.fullPrompt);
  parts.push('');
  parts.push('='.repeat(80));

  return parts.join('\n');
}
