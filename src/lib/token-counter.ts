/**
 * Token counting and estimation utilities
 * Helps manage API token limits and costs
 */

import type { ModelConfig, TokenEstimate, IllustrateConfig } from '../types/config.js';

/**
 * Estimate token count from text (conservative estimate: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  // More accurate estimation using character count and word count
  const charCount = text.length;
  const wordCount = text.split(/\s+/).length;

  // Use average of two methods for better accuracy
  const charBasedEstimate = Math.ceil(charCount / 4);
  const wordBasedEstimate = Math.ceil(wordCount * 1.3); // ~1.3 tokens per word

  return Math.max(charBasedEstimate, wordBasedEstimate);
}

/**
 * Calculate cost estimate for API call
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: ModelConfig
): number {
  const inputCost = (inputTokens / 1_000_000) * (model.inputCostPer1M || 0);
  const outputCost = (outputTokens / 1_000_000) * (model.outputCostPer1M || 0);
  return inputCost + outputCost;
}

/**
 * Check if text will exceed model's context limit
 */
export function willExceedLimit(
  inputTokens: number,
  outputTokens: number,
  model: ModelConfig,
  safetyMargin: number = 0.9
): boolean {
  const contextLength = model.contextLength || 128_000; // Default to 128k
  const totalTokens = inputTokens + outputTokens;
  const limit = Math.floor(contextLength * safetyMargin);

  return totalTokens > limit;
}

/**
 * Calculate how many splits are needed for large text
 */
export function calculateSplits(
  text: string,
  maxTokensPerChunk: number,
  _overlapTokens: number = 200
): { chunks: string[]; tokenCounts: number[] } {
  const totalTokens = estimateTokens(text);

  if (totalTokens <= maxTokensPerChunk) {
    return { chunks: [text], tokenCounts: [totalTokens] };
  }

  // Split by paragraphs first for cleaner breaks
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  const tokenCounts: number[] = [];

  let currentChunk = '';
  let currentTokens = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);

    // If single paragraph exceeds limit, split by sentences
    if (paragraphTokens > maxTokensPerChunk) {
      if (currentChunk) {
        chunks.push(currentChunk);
        tokenCounts.push(currentTokens);
        currentChunk = '';
        currentTokens = 0;
      }

      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      for (const sentence of sentences) {
        const sentenceTokens = estimateTokens(sentence);

        if (currentTokens + sentenceTokens > maxTokensPerChunk) {
          chunks.push(currentChunk);
          tokenCounts.push(currentTokens);
          currentChunk = sentence;
          currentTokens = sentenceTokens;
        } else {
          currentChunk += sentence;
          currentTokens += sentenceTokens;
        }
      }
      continue;
    }

    // Check if adding this paragraph would exceed limit
    if (currentTokens + paragraphTokens > maxTokensPerChunk && currentChunk) {
      chunks.push(currentChunk);
      tokenCounts.push(currentTokens);

      // Add overlap from end of previous chunk
      const overlapText = currentChunk.slice(-500); // Rough character-based overlap
      currentChunk = overlapText + '\n\n' + paragraph;
      currentTokens = estimateTokens(currentChunk);
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      currentTokens += paragraphTokens;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
    tokenCounts.push(currentTokens);
  }

  return { chunks, tokenCounts };
}

/**
 * Get model configuration from string or ModelConfig
 */
export function resolveModelConfig(
  model: string | ModelConfig,
  _config: Required<IllustrateConfig>
): ModelConfig {
  if (typeof model === 'string') {
    return getDefaultModelConfig(model);
  }
  return model;
}

/**
 * Get default model configuration based on model name
 */
export function getDefaultModelConfig(modelName: string): ModelConfig {
  // OpenAI models
  if (modelName.includes('gpt-4o')) {
    return {
      name: modelName,
      contextLength: 128_000,
      maxTokens: 4096,
      inputCostPer1M: 2.5,
      outputCostPer1M: 10.0,
      supportsImages: false,
    };
  }

  if (modelName.includes('gpt-4o-mini')) {
    return {
      name: modelName,
      contextLength: 128_000,
      maxTokens: 16_384,
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.6,
      supportsImages: false,
    };
  }

  if (modelName.includes('dall-e-3')) {
    return {
      name: modelName,
      contextLength: 4_000,
      maxTokens: 4_000,
      supportsImages: true,
    };
  }

  // Google models (OpenRouter)
  if (modelName.includes('gemini-flash')) {
    return {
      name: modelName,
      contextLength: 1_000_000,
      maxTokens: 8_192,
      inputCostPer1M: 0.0, // Free on OpenRouter
      outputCostPer1M: 0.0,
      supportsImages: false,
    };
  }

  if (modelName.includes('gemini-pro')) {
    return {
      name: modelName,
      contextLength: 1_000_000,
      maxTokens: 8_192,
      inputCostPer1M: 1.25,
      outputCostPer1M: 5.0,
      supportsImages: false,
    };
  }

  // Anthropic models (OpenRouter)
  if (modelName.includes('claude-3.5-sonnet')) {
    return {
      name: modelName,
      contextLength: 200_000,
      maxTokens: 8_192,
      inputCostPer1M: 3.0,
      outputCostPer1M: 15.0,
      supportsImages: false,
    };
  }

  // Meta models (OpenRouter)
  if (modelName.includes('llama')) {
    return {
      name: modelName,
      contextLength: 128_000,
      maxTokens: 4_096,
      inputCostPer1M: 0.0, // Often free on OpenRouter
      outputCostPer1M: 0.0,
      supportsImages: false,
    };
  }

  // Image generation models
  if (modelName.includes('flux-schnell')) {
    return {
      name: modelName,
      contextLength: 4_000,
      maxTokens: 4_000,
      inputCostPer1M: 0.0,
      outputCostPer1M: 0.0,
      supportsImages: true,
    };
  }

  // Default fallback
  return {
    name: modelName,
    contextLength: 128_000,
    maxTokens: 4_096,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    supportsImages: false,
  };
}

/**
 * Create token estimate for a text analysis task
 */
export function createTokenEstimate(
  inputText: string,
  expectedOutputTokens: number,
  model: ModelConfig,
  safetyMargin: number = 0.9
): TokenEstimate {
  const inputTokens = estimateTokens(inputText);
  const outputTokens = expectedOutputTokens;
  const totalTokens = inputTokens + outputTokens;

  const willExceed = willExceedLimit(inputTokens, outputTokens, model, safetyMargin);
  const estimatedCost = estimateCost(inputTokens, outputTokens, model);

  const result: TokenEstimate = {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost,
    willExceedLimit: willExceed,
  };

  if (willExceed) {
    const maxPerChunk = Math.floor((model.contextLength || 128_000) * safetyMargin);
    result.suggestedSplits = Math.ceil(totalTokens / maxPerChunk);
  }

  return result;
}
