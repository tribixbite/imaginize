/**
 * Configuration management for illustrate
 * Loads config from .illustrate.config files and environment variables
 */

import { cosmiconfig } from 'cosmiconfig';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import type { IllustrateConfig, ModelConfig } from '../types/config.js';
import { getRecommendedFreeTextModel } from './provider-utils.js';

const DEFAULT_CONFIG: IllustrateConfig = {
  pagesPerImage: 10,
  extractElements: true,
  generateElementImages: false,
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  outputPattern: 'illustrate_{name}',
  maxConcurrency: 3,
  imageSize: '1024x1024',
  imageQuality: 'standard',
  pagesPerAutoChapter: 50,
  tokenSafetyMargin: 0.9,
  maxRetries: 1,
  retryTimeout: 5000,
};

/**
 * Load configuration from multiple sources with priority:
 * 1. Current directory .illustrate.config
 * 2. Home directory .illustrate.config
 * 3. Environment variables
 * 4. Default values
 */
export async function loadConfig(): Promise<Required<IllustrateConfig>> {
  const explorer = cosmiconfig('illustrate');

  // Start with defaults
  let config = { ...DEFAULT_CONFIG };

  // Load from home directory
  const homeConfigPath = join(homedir(), '.illustrate.config');
  if (existsSync(homeConfigPath)) {
    try {
      const result = await explorer.load(homeConfigPath);
      if (result?.config) {
        config = { ...config, ...result.config };
      }
    } catch (error) {
      console.warn(`Warning: Failed to load config from ${homeConfigPath}`);
    }
  }

  // Load from current directory (higher priority)
  try {
    const result = await explorer.search();
    if (result?.config) {
      config = { ...config, ...result.config };
    }
  } catch (error) {
    console.warn('Warning: Failed to load config from current directory');
  }

  // Override with environment variables (highest priority)
  // Priority: OPENROUTER_API_KEY > OPENAI_API_KEY
  if (process.env.OPENROUTER_API_KEY) {
    config.apiKey = process.env.OPENROUTER_API_KEY;
    if (!config.baseUrl || config.baseUrl === 'https://api.openai.com/v1') {
      config.baseUrl = 'https://openrouter.ai/api/v1';
    }
    if (config.model === 'gpt-4o-mini') {
      // Use free model for OpenRouter by default
      config.model = getRecommendedFreeTextModel().name;
    }
  } else if (process.env.OPENAI_API_KEY) {
    config.apiKey = process.env.OPENAI_API_KEY;
  }

  if (process.env.OPENAI_BASE_URL || process.env.OPENROUTER_BASE_URL) {
    config.baseUrl = process.env.OPENROUTER_BASE_URL || process.env.OPENAI_BASE_URL!;
  }

  if (process.env.OPENAI_MODEL || process.env.OPENROUTER_MODEL) {
    config.model = process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL!;
  }

  // Handle image endpoint env vars
  if (process.env.OPENAI_API_KEY && process.env.OPENROUTER_API_KEY) {
    // If both exist, use OpenAI for images by default
    config.imageEndpoint = {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: 'https://api.openai.com/v1',
      model: 'dall-e-3',
    };
  }

  // Validate required fields
  if (!config.apiKey) {
    throw new Error(
      'API key is required. Set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable, or add apiKey to .illustrate.config'
    );
  }

  return config as Required<IllustrateConfig>;
}

/**
 * Get a sample configuration file content
 */
export function getSampleConfig(): string {
  return `# illustrate configuration file v2.0
# Place this file as .illustrate.config in your home directory or project directory

# Text analysis (primary endpoint)
baseUrl: "https://openrouter.ai/api/v1"  # or "https://api.openai.com/v1"
apiKey: "\${OPENROUTER_API_KEY}"  # Reference env var or use literal key
model:
  name: "google/gemini-flash-1.5:free"  # Free model on OpenRouter
  contextLength: 1000000
  maxTokens: 8192

# Separate image generation endpoint (optional)
imageEndpoint:
  baseUrl: "https://api.openai.com/v1"
  apiKey: "\${OPENAI_API_KEY}"
  model: "dall-e-3"

# Processing options
pagesPerImage: 10
pagesPerAutoChapter: 50
extractElements: true
generateElementImages: false

# Performance & reliability
maxConcurrency: 3
tokenSafetyMargin: 0.9
maxRetries: 1
retryTimeout: 5000

# Output settings
outputPattern: "illustrate_{name}"
imageSize: "1024x1024"  # Options: 1024x1024, 1024x1792, 1792x1024
imageQuality: "standard"  # Options: standard, hd
`;
}
