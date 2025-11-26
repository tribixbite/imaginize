/**
 * AI-powered content analyzer
 * Uses OpenAI to identify key visual concepts and extract elements
 */

import OpenAI from 'openai';
import type {
  IllustrateConfig,
  ImageConcept,
  BookElement,
  ChapterContent,
} from '../types/config.js';
import { ExtractionMetricsCollector } from './extraction-metrics.js';
import { EntityResolutionCache } from './entity-resolution-cache.js';

// Export metrics and cache for external use
export { ExtractionMetricsCollector, EntityResolutionCache };

/**
 * Element context for scene analysis
 * Contains formatted descriptions of known story elements
 */
export interface ElementContext {
  characters?: string;
  places?: string;
  items?: string;
}

/**
 * Build element context section for prompts
 * Centralized helper to avoid code duplication
 */
function buildElementContextSection(elementContext?: ElementContext): string {
  if (!elementContext || (!elementContext.characters && !elementContext.places && !elementContext.items)) {
    return '';
  }

  let section = '\n\nKNOWN STORY ELEMENTS (maintain visual consistency):\n';
  if (elementContext.characters) {
    section += `\nCHARACTERS:\n${elementContext.characters}\n`;
  }
  if (elementContext.places) {
    section += `\nPLACES:\n${elementContext.places}\n`;
  }
  if (elementContext.items) {
    section += `\nITEMS:\n${elementContext.items}\n`;
  }
  section += '\nIMPORTANT: When these elements appear in scenes, use their descriptions above to ensure visual consistency.\n';
  return section;
}

/**
 * Combined result from unified analysis
 * Contains both visual scenes and extracted elements from a single API call
 */
export interface UnifiedAnalysisResult {
  scenes: ImageConcept[];
  elements: BookElement[];
}

/**
 * Analyze chapter content and identify key visual concepts
 *
 * @param chapter - Chapter content to analyze
 * @param config - Configuration
 * @param openai - OpenAI client
 * @param elementContext - Previously extracted elements for context injection (optional)
 */
export async function analyzeChapter(
  chapter: ChapterContent,
  config: Required<IllustrateConfig>,
  openai: OpenAI,
  elementContext?: ElementContext
): Promise<ImageConcept[]> {
  // Calculate images based on actual page range (more accurate than word count)
  const [startPage, endPage] = chapter.pageRange.split('-').map(Number);
  const pageCount = (endPage && startPage) ? (endPage - startPage + 1) : 1;
  const numImages = Math.max(1, Math.ceil(pageCount / config.pagesPerImage));

  // Build element context section if available (using centralized helper)
  const elementContextSection = buildElementContextSection(elementContext);

  const prompt = `You are analyzing a book chapter to identify the most visually interesting and important concepts for illustration.

Chapter: ${chapter.chapterTitle}
Page Range: ${chapter.pageRange}
${elementContextSection}
Content:
${chapter.content}

Please identify ${numImages} key visual concepts from this chapter that would make compelling illustrations. For each concept:
1. Choose a significant quote (20-50 words) that captures the visual moment
2. Provide a brief description of what should be illustrated
3. Explain why this moment is important or visually interesting
4. If known story elements appear in this scene, reference their established descriptions for consistency

Return your response as a JSON array with this structure:
[
  {
    "quote": "exact quote from the text",
    "description": "what to illustrate",
    "reasoning": "why this is significant"
  }
]`;

  try {
    const modelName = typeof config.model === 'string' ? config.model : config.model.name;
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content:
            'You are a literary analyst specializing in visual storytelling and book illustration. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    const concepts = Array.isArray(parsed) ? parsed : parsed.concepts || [];

    interface RawConcept {
      quote?: string;
      description?: string;
      reasoning?: string;
    }

    return concepts.map((c: unknown) => {
      const concept = c as RawConcept;
      return {
        chapter: chapter.chapterTitle,
        pageRange: chapter.pageRange,
        quote: concept.quote || '',
        description: concept.description || '',
        reasoning: concept.reasoning || '',
      };
    });
  } catch (error) {
    console.error(`Error analyzing chapter ${chapter.chapterTitle}:`, error);
    return [];
  }
}

/**
 * UNIFIED ANALYSIS: Extract both visual scenes AND story elements in a single API call
 * This eliminates duplicate processing of the same chapter text
 *
 * @param chapter - Chapter content to analyze
 * @param config - Configuration
 * @param openai - OpenAI client
 * @param elementContext - Previously extracted elements for context injection (optional)
 * @returns Combined scenes and elements from single API call
 */
export async function analyzeChapterUnified(
  chapter: ChapterContent,
  config: Required<IllustrateConfig>,
  openai: OpenAI,
  elementContext?: ElementContext
): Promise<UnifiedAnalysisResult> {
  // Calculate images based on actual page range
  const [startPage, endPage] = chapter.pageRange.split('-').map(Number);
  const pageCount = (endPage && startPage) ? (endPage - startPage + 1) : 1;
  const numImages = Math.max(1, Math.ceil(pageCount / config.pagesPerImage));

  // Build element context section if available (using centralized helper)
  const elementContextSection = buildElementContextSection(elementContext);

  const prompt = `### PRIMARY GOAL
Analyze the provided chapter content to extract key visual scenes and story elements.

### STEP-BY-STEP INSTRUCTIONS
1. **First, identify ${numImages} key visual scenes.** These should be moments with strong, clear imagery suitable for illustration. For each scene, gather the required details (quote, description, reasoning).
2. **Second, extract ALL important story elements.** These include characters, places, items, etc., that are visually described.
3. **Finally, format ALL collected information** into a single JSON object according to the specified structure. It is critical that BOTH the "scenes" and "elements" arrays are populated.

### HIGH-QUALITY OUTPUT EXAMPLE
Here is an example of a perfect response for a fictional sci-fi chapter:
{
  "scenes": [
    {
      "quote": "The SecUnit crouched on the rusted gantry, its armor plating dripping with acidic rain as the twin suns of Kepler-186f set behind the jagged, purple mountains.",
      "description": "A lone, armored android (SecUnit) is perched on a high, industrial walkway overlooking an alien landscape at sunset. The scene is moody, with rain and a dramatic sky.",
      "reasoning": "This moment establishes the main character's isolation and the harsh, alien environment. The contrast between the high-tech armor and the decaying infrastructure is visually compelling."
    }
  ],
  "elements": [
    {
      "type": "character",
      "name": "SecUnit",
      "quotes": [
        {"text": "Its helmet was a smooth, dark gray plate, devoid of features except for a single red optical sensor.", "page": "p. 12"},
        {"text": "The armor was a patchwork of mismatched corporate-issue plates, scarred from previous engagements.", "page": "p. 14"}
      ],
      "description": "A humanoid android construct in full body armor. The armor is dark gray and utilitarian, showing signs of wear and tear. Its face is a featureless plate with a single glowing red camera lens."
    }
  ]
}

### CHAPTER DETAILS
Chapter: ${chapter.chapterTitle}
Page Range: ${chapter.pageRange}
${elementContextSection}
### CHAPTER CONTENT
${chapter.content}

### REQUIRED JSON OUTPUT
Return your full analysis in the JSON format demonstrated in the example above. The "scenes" array must not be empty if the text contains any visual moments. Both "scenes" and "elements" arrays must be populated.`;

  try {
    const modelName = typeof config.model === 'string' ? config.model : config.model.name;
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content:
            'You are a literary analyst AI specializing in visual storytelling and element extraction. Your task is to analyze a book chapter in a single pass and perform two distinct tasks: identifying key visual scenes and extracting all story elements. You must return a single, valid JSON object containing the results of both tasks.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);

    // DEBUG: Log response structure for model comparison
    console.log(`[MODEL: ${modelName}] Chapter "${chapter.chapterTitle}":`, JSON.stringify({
      scenes: Array.isArray(parsed.scenes) ? parsed.scenes.length : 0,
      elements: Array.isArray(parsed.elements) ? parsed.elements.length : 0
    }));

    // Parse scenes
    const rawScenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
    const scenes: ImageConcept[] = rawScenes.map((s: any) => ({
      chapter: chapter.chapterTitle,
      pageRange: chapter.pageRange,
      quote: s.quote || '',
      description: s.description || '',
      reasoning: s.reasoning || '',
    }));

    // Parse elements
    const rawElements = Array.isArray(parsed.elements) ? parsed.elements : [];
    const elements: BookElement[] = rawElements.map((e: any) => ({
      type: e.type || 'object',
      name: e.name || 'Unknown',
      quotes: Array.isArray(e.quotes) ? e.quotes : [],
      description: e.description || '',
      aliases: e.aliases || [],
    }));

    return { scenes, elements };
  } catch (error) {
    console.error(`Error in unified analysis for chapter ${chapter.chapterTitle}:`, error);
    return { scenes: [], elements: [] };
  }
}

/**
 * Extract characters, places, items, etc. from the full text
 */
export async function extractElements(
  fullText: string,
  config: Required<IllustrateConfig>,
  openai: OpenAI
): Promise<BookElement[]> {
  // Use configurable max extraction chars (defaults to 50000)
  const maxChars = config.maxExtractionChars || 50000;

  const prompt = `Analyze this book text and extract key elements (characters, creatures, places, items, objects).

For each element:
1. Identify the type (character/creature/place/item/object)
2. Provide the name
3. Extract 2-3 direct quotes with approximate page references that describe this element
4. Provide a brief consolidated description

Text (truncated if necessary):
${fullText.substring(0, maxChars)}

Return as JSON array:
[
  {
    "type": "character",
    "name": "Character Name",
    "quotes": [
      {"text": "quote describing them", "page": "estimated page"}
    ],
    "description": "consolidated description"
  }
]`;

  try {
    const modelName = typeof config.model === 'string' ? config.model : config.model.name;
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content:
            'You are a literary analyst expert at identifying and cataloging story elements. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : parsed.elements || [];
  } catch (error) {
    console.error('Error extracting elements:', error);
    return [];
  }
}

/**
 * Extract elements from a single chapter (iterative extraction)
 *
 * @param chapter - Chapter content to extract from
 * @param config - Configuration
 * @param openai - OpenAI client
 * @returns Array of extracted elements
 */
export async function extractElementsFromChapter(
  chapter: ChapterContent,
  config: Required<IllustrateConfig>,
  openai: OpenAI
): Promise<BookElement[]> {
  const prompt = `Analyze this chapter and extract all important story elements.

Chapter ${chapter.chapterNumber}: ${chapter.chapterTitle}
Page Range: ${chapter.pageRange}

${chapter.content}

Extract:
- Characters: Name, physical description, distinctive features
- Places: Name, visual description, atmosphere
- Items: Name, appearance, significance

For each element provide:
1. Type (character/creature/place/item/object)
2. Name
3. 2-3 direct quotes with approximate page references
4. VISUAL description (2-3 sentences) including colors, shapes, materials, textures, and distinctive visual characteristics

VISUAL DESCRIPTION EXAMPLES:
- Character: "Tall woman with silver-streaked black hair, wearing a dark blue coat with brass buttons. Her eyes are sharp gray and she carries a worn leather satchel."
- Place: "Gothic cathedral with flying buttresses and rose windows. Gargoyles perch at the corners and vines climb the weathered gray stone walls."
- Item: "Ornate silver compass with intricate engravings of constellations. The needle glows faintly blue in darkness."

Return as JSON array:
[
  {
    "type": "character",
    "name": "Character Name",
    "quotes": [
      {"text": "direct quote describing them", "page": "${chapter.pageRange}"}
    ],
    "description": "VISUAL description with colors, shapes, materials, textures"
  }
]`;

  try {
    const modelName = typeof config.model === 'string' ? config.model : config.model.name;
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content:
            'You are a literary analyst expert at identifying and cataloging story elements. Focus on visual descriptions. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : parsed.elements || [];
  } catch (error) {
    console.error(`Error extracting elements from chapter ${chapter.chapterNumber}:`, error);
    return [];
  }
}

/**
 * Merge new element into catalog with LLM-based entity resolution
 *
 * @param newElement - Newly extracted element
 * @param catalog - Existing element catalog (Map for efficient lookups)
 * @param config - Configuration
 * @param openai - OpenAI client
 */
export async function mergeElementIntoCatalog(
  newElement: BookElement,
  catalog: Map<string, BookElement>,
  config: Required<IllustrateConfig>,
  openai: OpenAI
): Promise<void> {
  // Get existing elements of the same type
  const existingElements = Array.from(catalog.values()).filter(
    (e) => e.type === newElement.type
  );

  if (existingElements.length === 0) {
    // First occurrence - add to catalog
    catalog.set(newElement.name.toLowerCase(), newElement);
    return;
  }

  // Skip entity resolution if disabled
  if (config.smartElementMerging === false) {
    // Simple case-insensitive match
    const key = newElement.name.toLowerCase();
    if (catalog.has(key)) {
      const existing = catalog.get(key)!;
      // Merge quotes
      if (!existing.quotes) existing.quotes = [];
      if (newElement.quotes) {
        existing.quotes.push(...newElement.quotes);
      }
      // Enrich description
      if (newElement.description && existing.description !== newElement.description) {
        existing.description = `${existing.description} ${newElement.description}`;
      }
      catalog.set(key, existing);
    } else {
      catalog.set(key, newElement);
    }
    return;
  }

  // Use LLM to check for entity matches (handle aliases, variants)
  const confidenceThreshold = config.entityMatchConfidence || 0.7;
  const prompt = `Does the new element refer to an existing element?

New Element:
- Type: ${newElement.type}
- Name: "${newElement.name}"
- Description: "${newElement.description || 'N/A'}"

Existing Elements:
${existingElements.map((e, i) => `${i + 1}. "${e.name}" - ${e.description || 'N/A'}`).join('\n')}

Question: Is the new element the same as any existing element (accounting for aliases, nicknames, titles, variants)?

Examples of matches:
- "Dr. Jekyll" matches "Henry Jekyll"
- "The Dark Lord" matches "Voldemort"
- "Jon Snow" matches "John Snow"

Return JSON:
{
  "is_match": true/false,
  "matched_index": <number 1-based or null>,
  "confidence": <0-1>,
  "reasoning": "brief explanation"
}`;

  try {
    const modelName = typeof config.model === 'string' ? config.model : config.model.name;
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at entity resolution and matching. Be conservative with matches - only match if confident they refer to the same entity.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const result = JSON.parse(content);

    if (
      result.is_match &&
      result.confidence >= confidenceThreshold &&
      result.matched_index !== null
    ) {
      // Merge with existing element
      const existingElement = existingElements[result.matched_index - 1]; // Convert to 0-based
      if (!existingElement) {
        // Invalid index, add as new
        catalog.set(newElement.name.toLowerCase(), newElement);
        return;
      }

      const key = existingElement.name.toLowerCase();
      const merged = catalog.get(key)!;

      // Track alias (now properly typed in BookElement)
      if (!merged.aliases) {
        merged.aliases = [];
      }
      if (!merged.aliases.includes(newElement.name)) {
        merged.aliases.push(newElement.name);
      }

      // Enrich description (use AI if enabled, otherwise simple concatenation)
      if (newElement.description && merged.description !== newElement.description) {
        const useAIEnrichment = config.aiDescriptionEnrichment === true;
        if (useAIEnrichment) {
          const modelName = typeof config.model === 'string' ? config.model : config.model.name;
          merged.description = await enrichDescriptionWithAI(
            merged.description || '',
            newElement.description,
            merged.name,
            openai,
            modelName,
            true
          );
        } else {
          merged.description = enrichDescription(merged.description || '', newElement.description);
        }
      }

      // Accumulate quotes
      if (!merged.quotes) merged.quotes = [];
      if (newElement.quotes) {
        merged.quotes.push(...newElement.quotes);
      }

      catalog.set(key, merged);
    } else {
      // New unique element
      catalog.set(newElement.name.toLowerCase(), newElement);
    }
  } catch (error) {
    console.error('Error in entity resolution, using simple matching:', error);
    // Fallback to simple matching
    const key = newElement.name.toLowerCase();
    if (catalog.has(key)) {
      const existing = catalog.get(key)!;
      if (!existing.quotes) existing.quotes = [];
      if (newElement.quotes) {
        existing.quotes.push(...newElement.quotes);
      }
      if (newElement.description && existing.description !== newElement.description) {
        existing.description = `${existing.description} ${newElement.description}`;
      }
      catalog.set(key, existing);
    } else {
      catalog.set(key, newElement);
    }
  }
}

/**
 * Enrich existing description with new details using AI consolidation
 * Produces coherent, readable descriptions without redundancy
 *
 * @param existing - Current description
 * @param additional - New details to merge
 * @param elementName - Name of element for context
 * @param openai - OpenAI client
 * @param model - Model to use for consolidation
 * @param useAI - Whether to use AI enrichment (default: true)
 */
async function enrichDescriptionWithAI(
  existing: string,
  additional: string,
  elementName: string,
  openai: OpenAI,
  model: string,
  useAI: boolean = true
): Promise<string> {
  if (!additional || existing.toLowerCase().includes(additional.toLowerCase())) {
    return existing;
  }

  // If AI enrichment disabled, use simple concatenation
  if (!useAI) {
    return `${existing}. Additional details: ${additional}`;
  }

  try {
    const prompt = `Consolidate and refine the description for the story element "${elementName}".
Combine the existing description with the new details into a single, coherent paragraph.
Eliminate redundancy but preserve all unique visual information.

Existing Description: "${existing}"
New Details: "${additional}"

Return only the new, consolidated description as a single string.`;

    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || `${existing}. ${additional}`;
  } catch (error) {
    // Fallback to simple concatenation on error
    console.error('Error in AI description enrichment:', error);
    return `${existing}. Additional details: ${additional}`;
  }
}

/**
 * Enrich existing description with new details (simple version)
 * Avoids redundancy while preserving unique information
 */
function enrichDescription(existing: string, additional: string): string {
  if (!additional || additional === existing) return existing;

  // Check if additional info is already in existing
  const existingLower = existing.toLowerCase();
  const additionalLower = additional.toLowerCase();

  if (existingLower.includes(additionalLower)) {
    return existing; // Already contains this info
  }

  // Merge: existing + new details
  return `${existing}. Additional details: ${additional}`;
}

/**
 * Extract and enrich story elements chapter-by-chapter (iterative extraction)
 *
 * Benefits:
 * - Dramatically reduced token costs (process in chunks)
 * - No context window limitations
 * - Progressive description enrichment
 * - More accurate element catalog
 *
 * @param chapters - All chapters to extract from
 * @param config - Configuration
 * @param openai - OpenAI client
 * @returns Complete element catalog
 */
export async function extractElementsIterative(
  chapters: ChapterContent[],
  config: Required<IllustrateConfig>,
  openai: OpenAI,
  onProgress?: (current: number, total: number, chapterTitle: string) => void
): Promise<BookElement[]> {
  const elementCatalog: Map<string, BookElement> = new Map();

  console.log(`\n📊 Iterative element extraction: ${chapters.length} chapters\n`);

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const chapterLabel = `Chapter ${chapter.chapterNumber}: ${chapter.chapterTitle}`;

    if (onProgress) {
      onProgress(i + 1, chapters.length, chapter.chapterTitle);
    }

    console.log(`   ${i + 1}/${chapters.length} - Extracting from ${chapterLabel}...`);

    // Extract elements from this chapter
    const chapterElements = await extractElementsFromChapter(chapter, config, openai);

    console.log(`      Found ${chapterElements.length} elements`);

    // Normalize and merge with catalog
    for (const newElement of chapterElements) {
      await mergeElementIntoCatalog(newElement, elementCatalog, config, openai);
    }

    console.log(`      Catalog now has ${elementCatalog.size} unique elements\n`);
  }

  const finalElements = Array.from(elementCatalog.values());
  console.log(
    `✅ Extraction complete: ${finalElements.length} unique elements identified\n`
  );

  return finalElements;
}

/**
 * Generate an image for a given concept or element
 * Note: Expects imageOpenai client configured with image-capable model
 */
export async function generateImage(
  description: string,
  config: Required<IllustrateConfig>,
  openai: OpenAI
): Promise<string | undefined> {
  try {
    // Extract model name from config
    const rawModel = config.imageEndpoint?.model || 'dall-e-3';
    const imageModel = typeof rawModel === 'string' ? rawModel : rawModel.name;
    const response = await openai.images.generate({
      model: imageModel,
      prompt: description,
      size: config.imageSize,
      quality: config.imageQuality,
      n: 1,
    });

    return response.data?.[0]?.url;
  } catch (error) {
    console.error('Error generating image:', error);
    return undefined;
  }
}

/**
 * Process chapters with rate limiting
 */
export async function processChaptersInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  maxConcurrency: number
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += maxConcurrency) {
    const batch = items.slice(i, i + maxConcurrency);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}
