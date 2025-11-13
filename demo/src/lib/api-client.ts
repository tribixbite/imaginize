/**
 * OpenAI API client wrapper for browser-based processing
 */

import OpenAI from 'openai';
import type { BookChapter } from './book-parser';

export interface AnalysisResult {
  chapterNumber: number;
  scenes: SceneDescription[];
  summary: string;
}

export interface SceneDescription {
  sceneNumber: number;
  description: string;
  mood?: string;
  lighting?: string;
  elements: string[];
}

export interface ImageGenerationResult {
  chapterNumber: number;
  sceneNumber: number;
  imageUrl: string;
  prompt: string;
  timestamp: Date;
}

/**
 * Analyze chapter and extract scene descriptions
 */
export async function analyzeChapter(
  openai: OpenAI,
  chapter: BookChapter,
  bookTitle: string
): Promise<AnalysisResult> {
  const prompt = `You are analyzing Chapter ${chapter.number} of "${bookTitle}" titled "${chapter.title}".

Analyze this chapter and identify key scenes that would make good illustrations. For each scene, provide:
1. A detailed visual description suitable for image generation
2. The mood/atmosphere of the scene
3. Lighting conditions
4. Key visual elements (characters, objects, setting)

Chapter content:
${chapter.content}

Return your analysis in this JSON format:
{
  "summary": "Brief chapter summary",
  "scenes": [
    {
      "sceneNumber": 1,
      "description": "Detailed visual description for image generation",
      "mood": "atmosphere/emotion",
      "lighting": "lighting conditions",
      "elements": ["character1", "object1", "setting1"]
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert at analyzing fiction and identifying visually compelling scenes for illustration.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from API');
  }

  const result = JSON.parse(content);

  return {
    chapterNumber: chapter.number,
    scenes: result.scenes || [],
    summary: result.summary || '',
  };
}

/**
 * Generate image for a scene
 */
export async function generateSceneImage(
  openai: OpenAI,
  scene: SceneDescription,
  chapterNumber: number,
  styleGuide?: string
): Promise<ImageGenerationResult> {
  // Construct image prompt
  let prompt = scene.description;

  // Add mood and lighting
  if (scene.mood) {
    prompt += `. Mood: ${scene.mood}`;
  }
  if (scene.lighting) {
    prompt += `. Lighting: ${scene.lighting}`;
  }

  // Add style guide if provided
  if (styleGuide) {
    prompt += `. Style: ${styleGuide}`;
  }

  // Generate image
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: prompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
  });

  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error('No image URL in response');
  }

  return {
    chapterNumber,
    sceneNumber: scene.sceneNumber,
    imageUrl,
    prompt,
    timestamp: new Date(),
  };
}

/**
 * Extract visual elements from all chapters
 */
export async function extractElements(
  openai: OpenAI,
  chapters: BookChapter[],
  bookTitle: string
): Promise<ElementsCatalog> {
  const allScenes = chapters.flatMap((ch) => ch.content).join('\n\n');

  const prompt = `You are analyzing the book "${bookTitle}".

Extract and categorize all significant visual elements that appear in this book:
- Characters (with physical descriptions)
- Places/Settings (with visual details)
- Important objects (with descriptions)

Book content:
${allScenes.slice(0, 50000)} // Limit to avoid token limits

Return your analysis in this JSON format:
{
  "characters": [
    {
      "name": "Character Name",
      "description": "Detailed physical description",
      "appearances": [1, 2, 3]
    }
  ],
  "places": [
    {
      "name": "Place Name",
      "description": "Visual description of the setting",
      "appearances": [1, 2]
    }
  ],
  "objects": [
    {
      "name": "Object Name",
      "description": "Visual description",
      "appearances": [3, 4]
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'You are an expert at analyzing fiction and cataloging visual elements.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from API');
  }

  const result = JSON.parse(content);

  return {
    characters: result.characters || [],
    places: result.places || [],
    objects: result.objects || [],
  };
}

export interface ElementsCatalog {
  characters: ElementDescription[];
  places: ElementDescription[];
  objects: ElementDescription[];
}

export interface ElementDescription {
  name: string;
  description: string;
  appearances: number[];
}

/**
 * Test API key by making a simple request
 */
export async function testAPIKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true, // Required for browser usage
    });

    // Make a minimal request to test the key
    await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 5,
    });

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown API error',
    };
  }
}

/**
 * Create OpenAI client instance
 */
export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true, // Required for browser usage
  });
}
