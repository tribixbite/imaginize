/**
 * Fast entity extraction for Pass 1 of two-pass analyze
 *
 * Lightweight extraction of character/creature/place names from chapter text.
 * Used to build Elements.md before full analysis.
 */

import type OpenAI from 'openai';

/**
 * Extracted entity from text
 */
export interface ExtractedEntity {
  name: string;
  type: 'character' | 'creature' | 'place' | 'object';
  context: string; // VISUAL description for characters/creatures, or brief context for places/objects
}

/**
 * Entity extraction result
 */
export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  chapterNumber: number;
  chapterTitle: string;
}

/**
 * Fast entity extraction using minimal AI calls
 *
 * Strategy: Use small, fast model with focused prompt asking only for entity names.
 * No detailed descriptions - just identify what entities exist.
 *
 * @param chapterContent - Chapter text to analyze
 * @param chapterNumber - Chapter number
 * @param chapterTitle - Chapter title
 * @param openai - OpenAI client
 * @param model - Model to use (should be fast/cheap like gpt-4o-mini)
 * @returns Extracted entities
 */
export async function extractEntitiesFast(
  chapterContent: string,
  chapterNumber: number,
  chapterTitle: string,
  openai: OpenAI,
  model: string = 'gpt-4o-mini'
): Promise<EntityExtractionResult> {
  // Truncate very long chapters to first 8000 chars for speed
  // This is just for entity identification - we'll analyze fully in Pass 2
  const truncated = chapterContent.substring(0, 8000);

  const prompt = `Extract key entities from this book chapter with VISUAL descriptions suitable for illustration.

For each entity, provide:
- **Characters/Creatures**: VISUAL appearance (age, clothing, physical features, distinguishing traits)
- **Places/Objects**: Brief descriptive context

Return as JSON array with format:
[
  {"name": "Entity Name", "type": "character|creature|place|object", "context": "VISUAL description or brief mention"}
]

**CRITICAL for characters/creatures:** Extract actual visual details from the text:
- Physical appearance (hair, eyes, build, age)
- Clothing descriptions (colors, style, notable items)
- Distinguishing features (scars, expressions, posture)
- For creatures: size, color, features (teeth, claws, fur, etc.)

Example GOOD context for character: "A young boy with determined expression, dressed casually, quick and clever"
Example BAD context for character: "the protagonist" or "main character"

Be selective - only extract entities that appear to be important to the story.

Chapter: ${chapterTitle}

Text:
${truncated}`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a literary analysis assistant that extracts story elements from text. Return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Low temperature for consistent extraction
      max_tokens: 1000, // Keep response short - just entity lists
    });

    const content = response.choices[0]?.message?.content || '[]';

    // Parse JSON response
    let entities: ExtractedEntity[] = [];
    try {
      entities = JSON.parse(content);
    } catch (parseError) {
      // If JSON parsing fails, try to extract from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (jsonMatch) {
        entities = JSON.parse(jsonMatch[1]);
      } else {
        console.warn(`Failed to parse entities for chapter ${chapterNumber}: ${parseError}`);
        entities = [];
      }
    }

    return {
      entities,
      chapterNumber,
      chapterTitle,
    };
  } catch (error: any) {
    console.warn(`Entity extraction failed for chapter ${chapterNumber}: ${error.message}`);
    return {
      entities: [],
      chapterNumber,
      chapterTitle,
    };
  }
}

/**
 * Merge and deduplicate entities from multiple chapters
 *
 * @param results - Array of entity extraction results
 * @returns Deduplicated entities with appearance tracking
 */
export function mergeEntityResults(
  results: EntityExtractionResult[]
): Array<ExtractedEntity & { appearances: string[] }> {
  const entityMap = new Map<string, ExtractedEntity & { appearances: string[] }>();

  for (const result of results) {
    for (const entity of result.entities) {
      // Use lowercase key for case-insensitive deduplication
      const key = `${entity.type}:${entity.name.toLowerCase()}`;

      if (entityMap.has(key)) {
        // Entity already exists - add chapter to appearances
        const existing = entityMap.get(key)!;
        const chapterRef = `Chapter ${result.chapterNumber}`;
        if (!existing.appearances.includes(chapterRef)) {
          existing.appearances.push(chapterRef);
        }
      } else {
        // New entity
        entityMap.set(key, {
          ...entity,
          appearances: [`Chapter ${result.chapterNumber}`],
        });
      }
    }
  }

  // Return sorted by type, then name
  return Array.from(entityMap.values()).sort((a, b) => {
    if (a.type !== b.type) {
      const typeOrder = { character: 0, creature: 1, place: 2, object: 3 };
      return typeOrder[a.type] - typeOrder[b.type];
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Generate Elements.md content from extracted entities
 *
 * @param entities - Merged entity list
 * @param bookTitle - Book title for header
 * @returns Markdown content for Elements.md
 */
export function generateElementsMarkdown(
  entities: Array<ExtractedEntity & { appearances: string[] }>,
  bookTitle: string
): string {
  const lines: string[] = [];

  lines.push(`# Story Elements - ${bookTitle}`);
  lines.push('');
  lines.push('*Auto-generated entity extraction from story analysis*');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Group by type
  const byType = {
    character: entities.filter(e => e.type === 'character'),
    creature: entities.filter(e => e.type === 'creature'),
    place: entities.filter(e => e.type === 'place'),
    object: entities.filter(e => e.type === 'object'),
  };

  // Characters section
  if (byType.character.length > 0) {
    lines.push('## Characters');
    lines.push('');
    for (const entity of byType.character) {
      lines.push(`### ${entity.name}`);
      lines.push(entity.context);
      lines.push(`**Appears in:** ${entity.appearances.join(', ')}`);
      lines.push('');
    }
  }

  // Creatures section
  if (byType.creature.length > 0) {
    lines.push('## Creatures');
    lines.push('');
    for (const entity of byType.creature) {
      lines.push(`### ${entity.name}`);
      lines.push(entity.context);
      lines.push(`**Appears in:** ${entity.appearances.join(', ')}`);
      lines.push('');
    }
  }

  // Places section
  if (byType.place.length > 0) {
    lines.push('## Places');
    lines.push('');
    for (const entity of byType.place) {
      lines.push(`### ${entity.name}`);
      lines.push(entity.context);
      lines.push(`**Appears in:** ${entity.appearances.join(', ')}`);
      lines.push('');
    }
  }

  // Objects section
  if (byType.object.length > 0) {
    lines.push('## Objects');
    lines.push('');
    for (const entity of byType.object) {
      lines.push(`### ${entity.name}`);
      lines.push(entity.context);
      lines.push(`**Appears in:** ${entity.appearances.join(', ')}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
