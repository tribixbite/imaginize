/**
 * Configuration management for illustrate
 * Loads config from .illustrate.config files and environment variables
 */

import { cosmiconfig } from 'cosmiconfig';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import type { IllustrateConfig } from '../types/config.js';

const DEFAULT_CONFIG: Required<IllustrateConfig> = {
  pagesPerImage: 10,
  extractElements: true,
  generateElementImages: false,
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  outputPattern: 'illustrate_{name}',
  maxConcurrency: 3,
  imageModel: 'dall-e-3',
  imageSize: '1024x1024',
  imageQuality: 'standard',
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
  if (process.env.OPENAI_API_KEY) {
    config.apiKey = process.env.OPENAI_API_KEY;
  }
  if (process.env.OPENAI_BASE_URL) {
    config.baseUrl = process.env.OPENAI_BASE_URL;
  }
  if (process.env.OPENAI_MODEL) {
    config.model = process.env.OPENAI_MODEL;
  }

  // Validate required fields
  if (!config.apiKey) {
    throw new Error(
      'OpenAI API key is required. Set OPENAI_API_KEY environment variable or add apiKey to .illustrate.config'
    );
  }

  return config;
}

/**
 * Get a sample configuration file content
 */
export function getSampleConfig(): string {
  return `# illustrate configuration file
# Place this file as .illustrate.config in your home directory or project directory

# Number of pages per image recommendation
pagesPerImage: 10

# Whether to extract character/item descriptions
extractElements: true

# Whether to generate actual images for characters/items (requires API credits)
generateElementImages: false

# OpenAI API configuration
apiKey: "your-api-key-here"
baseUrl: "https://api.openai.com/v1"
model: "gpt-4o"

# Image generation settings
imageModel: "dall-e-3"
imageSize: "1024x1024"  # Options: 1024x1024, 1024x1792, 1792x1024
imageQuality: "standard"  # Options: standard, hd

# Output settings
outputPattern: "illustrate_{name}"
maxConcurrency: 3
`;
}
