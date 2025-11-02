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
 * Analyze chapter content and identify key visual concepts
 */
export async function analyzeChapter(
  chapter: ChapterContent,
  config: Required<IllustrateConfig>,
  openai: OpenAI
): Promise<ImageConcept[]> {
  const numImages = Math.ceil(
    chapter.content.split(/\s+/).length / (config.pagesPerImage * 300)
  );

  const prompt = `You are analyzing a book chapter to identify the most visually interesting and important concepts for illustration.

Chapter: ${chapter.chapterTitle}
Page Range: ${chapter.pageRange}

Content:
${chapter.content}

Please identify ${numImages} key visual concepts from this chapter that would make compelling illustrations. For each concept:
1. Choose a significant quote (20-50 words) that captures the visual moment
2. Provide a brief description of what should be illustrated
3. Explain why this moment is important or visually interesting

Return your response as a JSON array with this structure:
[
  {
    "quote": "exact quote from the text",
    "description": "what to illustrate",
    "reasoning": "why this is significant"
  }
]`;

  try {
    const response = await openai.chat.completions.create({
      model: config.model,
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

    return concepts.map((c: any) => ({
      chapter: chapter.chapterTitle,
      pageRange: chapter.pageRange,
      quote: c.quote || '',
      description: c.description || '',
      reasoning: c.reasoning || '',
    }));
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
  const prompt = `Analyze this book text and extract key elements (characters, creatures, places, items, objects).

For each element:
1. Identify the type (character/creature/place/item/object)
2. Provide the name
3. Extract 2-3 direct quotes with approximate page references that describe this element
4. Provide a brief consolidated description

Text (truncated if necessary):
${fullText.substring(0, 50000)}

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
    const response = await openai.chat.completions.create({
      model: config.model,
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
 */
export async function generateImage(
  description: string,
  config: Required<IllustrateConfig>,
  openai: OpenAI
): Promise<string | undefined> {
  try {
    const response = await openai.images.generate({
      model: config.imageModel,
      prompt: description,
      size: config.imageSize,
      quality: config.imageQuality,
      n: 1,
    });

    return response.data[0]?.url;
  } catch (error) {
    console.error('Error generating image:', error);
    return undefined;
  }
}

/**
 * Process chapters with rate limiting
 */
export async function processChaptersInBatches<T>(
  items: T[],
  processor: (item: T) => Promise<any>,
  maxConcurrency: number
): Promise<any[]> {
  const results: any[] = [];

  for (let i = 0; i < items.length; i += maxConcurrency) {
    const batch = items.slice(i, i + maxConcurrency);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}
