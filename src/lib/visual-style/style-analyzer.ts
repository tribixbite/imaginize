/**
 * Style Analyzer - Extract visual style from first N generated images
 *
 * Uses multi-modal AI to analyze images and extract common patterns
 * for consistency across all subsequent image generations
 */

import { readFile } from 'fs/promises';
import type OpenAI from 'openai';
import type { IAiClient } from '../ai-client.js';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import type { VisualStyleGuide, ExtractedVisualFeatures } from './types.js';
import { createStyleGuide } from './style-guide.js';

/**
 * Analyze first N images to extract common visual style
 *
 * Uses GPT-4 Vision to analyze images and identify patterns
 */
export async function analyzeStyleFromImages(
  imagePaths: string[],
  openai: IAiClient,
  progressCallback?: (message: string) => Promise<void>
): Promise<VisualStyleGuide> {
  if (imagePaths.length === 0) {
    throw new Error('Cannot analyze style from empty image list');
  }

  if (progressCallback) {
    await progressCallback(`Analyzing visual style from ${imagePaths.length} images...`);
  }

  // Read images as base64
  const imageDataList: string[] = [];
  for (const path of imagePaths) {
    try {
      const imageData = await readFile(path);
      const base64 = imageData.toString('base64');
      imageDataList.push(base64);
    } catch (error) {
      console.error(`Failed to read image: ${path}`, error);
    }
  }

  if (imageDataList.length === 0) {
    throw new Error('Failed to read any images for style analysis');
  }

  // Build multi-modal prompt
  const prompt = buildStyleAnalysisPrompt(imagePaths.length);

  try {
    // Call GPT-4 Vision for style analysis
    const response = await openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert art director analyzing book illustrations for visual consistency. Return structured JSON only.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            ...imageDataList.map((base64) => ({
              type: 'image_url' as const,
              image_url: {
                url: `data:image/png;base64,${base64}`,
                detail: 'high' as const,
              },
            })),
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.3, // Lower temperature for more consistent analysis
    }) as ChatCompletion;

    const content = response.choices[0]?.message?.content || '{}';

    // Parse response
    const analysis = parseStyleAnalysis(content);

    // Calculate consistency score (0-1)
    // Higher score means the images are more visually consistent
    const consistencyScore = calculateConsistencyScore(analysis, imagePaths.length);

    // Create style guide
    const styleGuide = createStyleGuide(
      analysis.artStyle,
      analysis.colorPalette,
      analysis.lighting,
      analysis.mood,
      analysis.composition,
      consistencyScore,
      imagePaths.length
    );

    if (progressCallback) {
      await progressCallback(
        `Style guide created (consistency: ${(consistencyScore * 100).toFixed(0)}%)`
      );
    }

    return styleGuide;
  } catch (error: any) {
    console.error('Style analysis failed:', error);

    // Fallback: Create basic style guide
    if (progressCallback) {
      await progressCallback(
        'Warning: Style analysis failed, using fallback style guide'
      );
    }

    return createFallbackStyleGuide(imagePaths.length);
  }
}

/**
 * Build style analysis prompt for GPT-4 Vision
 */
function buildStyleAnalysisPrompt(imageCount: number): string {
  return `Analyze these ${imageCount} book illustrations and extract their common visual style characteristics.

**Your Task:**
1. Identify the predominant **art style** (e.g., "Digital illustration with soft brush strokes", "Watercolor with vibrant colors", "Realistic digital painting")
2. Extract the **color palette** - list 5-6 dominant hex color codes that appear across the images
3. Describe the **lighting** characteristics (e.g., "Natural daylight with warm undertones", "Dramatic shadows with golden hour lighting")
4. Identify the overall **mood/atmosphere** (e.g., "Whimsical and adventurous", "Dark and mysterious", "Light-hearted and playful")
5. Note common **composition patterns** (e.g., "Medium shots with characters centered", "Wide establishing shots", "Close-ups emphasizing emotion")

**Return Format (JSON):**
\`\`\`json
{
  "artStyle": "Descriptive art style",
  "colorPalette": ["#RRGGBB", "#RRGGBB", "#RRGGBB", "#RRGGBB", "#RRGGBB"],
  "lighting": "Lighting description",
  "mood": "Mood description",
  "composition": "Composition pattern description",
  "consistencyNotes": "Brief notes on how consistent these images are"
}
\`\`\`

Focus on COMMON patterns across all images. If images vary significantly, note that in consistencyNotes.`;
}

/**
 * Parse GPT-4 Vision response
 */
function parseStyleAnalysis(content: string): ExtractedVisualFeatures {
  try {
    // Try direct JSON parse
    const parsed = JSON.parse(content);
    return {
      artStyle: parsed.artStyle || 'Unknown art style',
      colorPalette: parsed.colorPalette || [],
      lighting: parsed.lighting || 'Unknown lighting',
      mood: parsed.mood || 'Unknown mood',
      composition: parsed.composition || 'Unknown composition',
    };
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
          artStyle: parsed.artStyle || 'Unknown art style',
          colorPalette: parsed.colorPalette || [],
          lighting: parsed.lighting || 'Unknown lighting',
          mood: parsed.mood || 'Unknown mood',
          composition: parsed.composition || 'Unknown composition',
        };
      } catch {}
    }

    // Fallback: Parse text manually
    return parseStyleFromText(content);
  }
}

/**
 * Parse style from unstructured text (fallback)
 */
function parseStyleFromText(content: string): ExtractedVisualFeatures {
  const features: ExtractedVisualFeatures = {
    artStyle: 'Digital illustration',
    colorPalette: [],
    lighting: 'Natural lighting',
    mood: 'Neutral',
    composition: 'Balanced composition',
  };

  // Try to extract art style
  const artStyleMatch = content.match(/art style[:\s]+([^.\n]+)/i);
  if (artStyleMatch) {
    features.artStyle = artStyleMatch[1].trim();
  }

  // Try to extract color codes
  const hexMatches = content.match(/#[0-9A-Fa-f]{6}/g);
  if (hexMatches) {
    features.colorPalette = hexMatches.slice(0, 6);
  }

  // Try to extract lighting
  const lightingMatch = content.match(/lighting[:\s]+([^.\n]+)/i);
  if (lightingMatch) {
    features.lighting = lightingMatch[1].trim();
  }

  // Try to extract mood
  const moodMatch = content.match(/mood[:\s]+([^.\n]+)/i);
  if (moodMatch) {
    features.mood = moodMatch[1].trim();
  }

  // Try to extract composition
  const compositionMatch = content.match(/composition[:\s]+([^.\n]+)/i);
  if (compositionMatch) {
    features.composition = compositionMatch[1].trim();
  }

  return features;
}

/**
 * Calculate consistency score based on analysis
 *
 * Returns 0-1 score indicating how visually consistent the images are
 */
function calculateConsistencyScore(
  analysis: ExtractedVisualFeatures,
  imageCount: number
): number {
  let score = 0.5; // Base score

  // Color palette diversity check
  if (analysis.colorPalette.length >= 4) {
    score += 0.2; // Good color palette extraction indicates consistency
  }

  // Descriptive detail check
  if (analysis.artStyle.split(' ').length >= 3) {
    score += 0.1; // Detailed description indicates clear patterns
  }

  if (analysis.lighting.split(' ').length >= 3) {
    score += 0.1;
  }

  if (analysis.composition.split(' ').length >= 3) {
    score += 0.1;
  }

  // Ensure score is between 0 and 1
  return Math.min(1.0, Math.max(0.0, score));
}

/**
 * Create fallback style guide when analysis fails
 */
function createFallbackStyleGuide(bootstrapCount: number): VisualStyleGuide {
  return createStyleGuide(
    'Digital illustration with contemporary style',
    ['#3A5F7D', '#C9A961', '#8B6F47', '#E8D5B7', '#5A7D8F'],
    'Natural lighting with balanced exposure',
    'Neutral storytelling atmosphere',
    'Balanced composition with clear focal points',
    0.5, // Medium consistency (unknown)
    bootstrapCount
  );
}

/**
 * Analyze a single image for style (for incremental updates)
 */
export async function analyzeImageStyle(
  imagePath: string,
  openai: IAiClient
): Promise<ExtractedVisualFeatures> {
  const imageData = await readFile(imagePath);
  const base64 = imageData.toString('base64');

  const response = await openai.chat.completions.create({
    model: 'gpt-4-vision-preview',
    messages: [
      {
        role: 'system',
        content: 'You are an expert at analyzing visual style. Return JSON only.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze this image and extract: artStyle, colorPalette (hex codes), lighting, mood, composition. Return JSON.',
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0.3,
  }) as ChatCompletion;

  const content = response.choices[0]?.message?.content || '{}';
  return parseStyleAnalysis(content);
}
