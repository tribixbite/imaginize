/**
 * Provider detection and multi-provider support utilities
 */

import type { AIProvider, IllustrateConfig, ModelConfig } from '../types/config.js';
import { getDefaultModelConfig } from './token-counter.js';

/**
 * Detect AI provider from base URL
 */
export function detectProvider(baseUrl: string): AIProvider {
  const url = baseUrl.toLowerCase();

  if (url.includes('openrouter.ai')) {
    return 'openrouter';
  }

  if (url.includes('api.openai.com')) {
    return 'openai';
  }

  return 'custom';
}

/**
 * Check if model supports image generation
 */
export function supportsImageGeneration(model: string | ModelConfig): boolean {
  const modelConfig = typeof model === 'string' ? getDefaultModelConfig(model) : model;
  return modelConfig.supportsImages || false;
}

/**
 * Get recommended free text model for OpenRouter
 * Priority: google/gemini-2.0-flash-exp:free (best performance)
 */
export function getRecommendedFreeTextModel(): ModelConfig {
  return {
    name: 'google/gemini-2.0-flash-exp:free',
    contextLength: 1_000_000,
    maxTokens: 8_192,
    inputCostPer1M: 0.0,
    outputCostPer1M: 0.0,
    supportsImages: false,
  };
}

/**
 * Get recommended free image model for OpenRouter
 * Currently: google/gemini-2.5-flash-image (top-weekly on OpenRouter)
 * Fallback: google/gemini-exp-1206:free
 */
export function getRecommendedFreeImageModel(): ModelConfig {
  return {
    name: 'google/gemini-2.5-flash-image',
    contextLength: 8_000,
    maxTokens: 8_000,
    inputCostPer1M: 0.0,
    outputCostPer1M: 0.0,
    supportsImages: true,
  };
}

/**
 * Get fallback free image model
 */
export function getFallbackFreeImageModel(): ModelConfig {
  return {
    name: 'google/gemini-exp-1206:free',
    contextLength: 8_000,
    maxTokens: 8_000,
    inputCostPer1M: 0.0,
    outputCostPer1M: 0.0,
    supportsImages: true,
  };
}

/**
 * Prompt user for API key interactively
 */
export async function promptForApiKey(purpose: string): Promise<string | undefined> {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      `Enter ${purpose} API key (or press Enter to skip): `,
      (answer: string) => {
        rl.close();
        resolve(answer.trim() || undefined);
      }
    );
  });
}

/**
 * Validate and prepare configuration for use
 * Handles API key detection, provider setup, and image endpoint configuration
 */
export async function prepareConfiguration(
  config: Required<IllustrateConfig>,
  needsImages: boolean
): Promise<{
  textConfig: { apiKey: string; baseUrl: string; model: ModelConfig };
  imageConfig?: { apiKey: string; baseUrl: string; model: ModelConfig };
  warnings: string[];
}> {
  const warnings: string[] = [];

  // Detect text provider
  const textProvider = detectProvider(config.baseUrl);
  const textModel =
    typeof config.model === 'string'
      ? getDefaultModelConfig(config.model)
      : config.model;

  // Prepare text configuration
  const textConfig = {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: textModel,
  };

  // Handle image generation if needed
  let imageConfig: { apiKey: string; baseUrl: string; model: ModelConfig } | undefined;

  if (needsImages) {
    // Check if primary model supports images
    if (supportsImageGeneration(textModel)) {
      imageConfig = textConfig;
    } else {
      // Need separate image endpoint
      if (config.imageEndpoint?.apiKey && config.imageEndpoint?.baseUrl) {
        // Use configured image endpoint
        const imageModel = config.imageEndpoint.model
          ? typeof config.imageEndpoint.model === 'string'
            ? getDefaultModelConfig(config.imageEndpoint.model)
            : config.imageEndpoint.model
          : getDefaultModelConfig('dall-e-3');

        imageConfig = {
          apiKey: config.imageEndpoint.apiKey,
          baseUrl: config.imageEndpoint.baseUrl,
          model: imageModel,
        };
      } else {
        // Try to find image API key in environment
        const openaiKey = process.env.OPENAI_API_KEY;

        if (openaiKey) {
          warnings.push(
            'Using OPENAI_API_KEY for image generation (separate from text model)'
          );

          imageConfig = {
            apiKey: openaiKey,
            baseUrl: 'https://api.openai.com/v1',
            model: getDefaultModelConfig('dall-e-3'),
          };
        } else {
          // Prompt user for image API key
          warnings.push(
            'Text model does not support image generation. Need separate image endpoint.'
          );

          const imageKey = await promptForApiKey('OpenAI (for images)');

          if (imageKey) {
            imageConfig = {
              apiKey: imageKey,
              baseUrl: 'https://api.openai.com/v1',
              model: getDefaultModelConfig('dall-e-3'),
            };
          } else {
            warnings.push('⚠️  Skipping image generation (no image API key provided)');
          }
        }
      }
    }
  }

  return { textConfig, imageConfig, warnings };
}

/**
 * Parse chapter selection string into array of chapter numbers
 * Supports: "1,2,5", "1-5", "1-3,7,10-12"
 */
export function parseChapterSelection(selection: string): number[] {
  const chapters = new Set<number>();

  const parts = selection.split(',').map((s) => s.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      // Range: "1-5"
      const [start, end] = part.split('-').map((n) => parseInt(n.trim(), 10));

      if (isNaN(start) || isNaN(end)) {
        throw new Error(`Invalid chapter range: ${part}`);
      }

      for (let i = start; i <= end; i++) {
        chapters.add(i);
      }
    } else {
      // Single chapter: "2"
      const num = parseInt(part, 10);

      if (isNaN(num)) {
        throw new Error(`Invalid chapter number: ${part}`);
      }

      chapters.add(num);
    }
  }

  return Array.from(chapters).sort((a, b) => a - b);
}

/**
 * Parse element selection with wildcards
 * Supports: "name", "type:name", "type:*", "*:pattern"
 */
export interface ElementFilter {
  type?: string;
  namePattern: string;
  isWildcard: boolean;
}

export function parseElementSelection(selection: string): ElementFilter[] {
  const filters: ElementFilter[] = [];

  const parts = selection.split(',').map((s) => s.trim().toLowerCase());

  for (const part of parts) {
    if (part.includes(':')) {
      // Type-specific: "character:aria" or "character:*"
      const [type, name] = part.split(':').map((s) => s.trim());

      filters.push({
        type: type === '*' ? undefined : type,
        namePattern: name,
        isWildcard: name.includes('*'),
      });
    } else {
      // Just name: "aria"
      filters.push({
        namePattern: part,
        isWildcard: part.includes('*'),
      });
    }
  }

  return filters;
}

/**
 * Check if element matches any filter
 */
export function matchesElementFilter(
  elementType: string,
  elementName: string,
  filters: ElementFilter[]
): boolean {
  const normalizedType = elementType.toLowerCase();
  const normalizedName = elementName.toLowerCase();

  for (const filter of filters) {
    // Check type match
    if (filter.type && filter.type !== normalizedType) {
      continue;
    }

    // Check name match
    if (filter.isWildcard) {
      const pattern = filter.namePattern.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`, 'i');

      if (regex.test(normalizedName)) {
        return true;
      }
    } else {
      if (normalizedName === filter.namePattern) {
        return true;
      }
    }
  }

  return false;
}
