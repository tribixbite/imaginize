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

  // Build element context section if available
  let elementContextSection = '';
  if (elementContext && (elementContext.characters || elementContext.places || elementContext.items)) {
    elementContextSection = '\n\nKNOWN STORY ELEMENTS (maintain visual consistency):\n';
    if (elementContext.characters) {
      elementContextSection += `\nCHARACTERS:\n${elementContext.characters}\n`;
    }
    if (elementContext.places) {
      elementContextSection += `\nPLACES:\n${elementContext.places}\n`;
    }
    if (elementContext.items) {
      elementContextSection += `\nITEMS:\n${elementContext.items}\n`;
    }
    elementContextSection += '\nIMPORTANT: When these elements appear in scenes, use their descriptions above to ensure visual consistency.\n';
  }

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
