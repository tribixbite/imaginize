/**
 * Configuration management for imaginize
 * Loads config from .imaginize.config files and environment variables
 */

import { cosmiconfig } from 'cosmiconfig';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import type { IllustrateConfig } from '../types/config.js';
import {
  getRecommendedFreeTextModel,
  getRecommendedFreeImageModel,
} from './provider-utils.js';

const DEFAULT_CONFIG: IllustrateConfig = {
  pagesPerImage: 10,
  extractElements: true,
  generateElementImages: false,
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  outputPattern: 'imaginize_{name}',
  maxConcurrency: 3,
  imageSize: '1024x1024',
  imageQuality: 'standard',
  pagesPerAutoChapter: 50,
  tokenSafetyMargin: 0.9,
  maxRetries: 10, // Increased for rate limit handling (OpenRouter free tier)
  retryTimeout: 5000,
};

/**
 * Load configuration from multiple sources with priority:
 * 1. CLI arguments (applied in index.ts after loadConfig)
 * 2. Current directory .imaginize.config
 * 3. Home directory .imaginize.config
 * 4. Environment variables (fallback only)
 * 5. Default values
 */
export async function loadConfig(): Promise<Required<IllustrateConfig>> {
  const explorer = cosmiconfig('imaginize');

  // Start with defaults
  let config = { ...DEFAULT_CONFIG };

  // Apply environment variables first (lowest priority, fallback only)
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

    // Set OpenRouter for images if no explicit image endpoint configured
    if (!config.imageEndpoint?.apiKey) {
      const recommendedImage = getRecommendedFreeImageModel();
      config.imageEndpoint = {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseUrl: 'https://openrouter.ai/api/v1',
        model: recommendedImage.name,
      };
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
  // If both OpenAI and OpenRouter exist but no image endpoint set, prefer OpenAI for images (DALL-E better quality)
  if (
    process.env.OPENAI_API_KEY &&
    process.env.OPENROUTER_API_KEY &&
    !config.imageEndpoint?.apiKey
  ) {
    config.imageEndpoint = {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: 'https://api.openai.com/v1',
      model: 'dall-e-3',
    };
  }

  // Validate required fields
  // Load from home directory (overrides env vars)
  const homeConfigPath = join(homedir(), '.imaginize.config');
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

  // Load from current directory (highest priority, overrides everything except CLI args)
  try {
    const result = await explorer.search();
    if (result?.config) {
      config = { ...config, ...result.config };
    }
  } catch (error) {
    console.warn('Warning: Failed to load config from current directory');
  }

  // Note: API key validation removed - will be done after CLI overrides in index.ts
  // This allows --api-key CLI option to work properly
  return config as Required<IllustrateConfig>;
}

/**
 * Get a sample configuration file content
 */
export function getSampleConfig(): string {
  return `# illustrate configuration file v2.0
# Place this file as .imaginize.config in your home directory or project directory

# =============================================================================
# TEXT ANALYSIS ENDPOINT (Primary)
# =============================================================================
baseUrl: "https://openrouter.ai/api/v1"  # or "https://api.openai.com/v1"
apiKey: "\${OPENROUTER_API_KEY}"  # Reference env var or use literal key
model:
  name: "google/gemini-2.0-flash-exp:free"  # Free model (validated with unified analysis)
  # Alternative: "openrouter/bert-nebulon-alpha" (also free, working)
  # Paid options: "gpt-4o", "claude-sonnet-4", etc.
  contextLength: 1000000
  maxTokens: 8192

# =============================================================================
# IMAGE GENERATION ENDPOINT (Optional, for --images phase)
# =============================================================================
imageEndpoint:
  baseUrl: "https://api.openai.com/v1"
  apiKey: "\${OPENAI_API_KEY}"
  model: "dall-e-3"

# =============================================================================
# PROCESSING OPTIONS
# =============================================================================
pagesPerImage: 10
pagesPerAutoChapter: 50
extractElements: true
generateElementImages: false

# =============================================================================
# PERFORMANCE & RELIABILITY
# =============================================================================
maxConcurrency: 3
tokenSafetyMargin: 0.9
maxRetries: 1
retryTimeout: 5000

# =============================================================================
# OUTPUT SETTINGS
# =============================================================================
outputPattern: "imaginize_{name}"
imageSize: "1024x1024"  # Options: 1024x1024, 1024x1792, 1792x1024
imageQuality: "standard"  # Options: standard, hd

# =============================================================================
# CLI FLAGS REFERENCE (use these when running imaginize)
# =============================================================================
#
# BASIC USAGE:
#   imaginize --file <path> --text --continue
#
# FILE SELECTION:
#   --file <path>, -f <path>    Specify exact book file (REQUIRED for resume)
#                                Without this, tool auto-selects next unprocessed book
#
# PHASE CONTROL:
#   --text                      Generate Chapters.md (analyze phase - scenes + elements)
#   --elements                  Generate Elements.md (extract phase)
#   --images                    Generate images with DALL-E (illustrate phase)
#
# COMPILATION FORMATS:
#   --pdf                       Compile graphic novel PDF
#   --cbz                       Compile CBZ comic book archive
#   --epub                      Compile EPUB eBook
#   --html                      Generate HTML gallery
#   --webp-album                Compile WebP album (smaller than PDF)
#   --webp-strip                Create single vertical strip WebP image
#   --all-formats               Generate all output formats
#
# RESUME & RETRY:
#   --continue                  Continue from saved progress (auto-resume)
#   --force                     Force regeneration (ignores existing state)
#   --retry-failed              Only retry chapters that previously failed
#   --skip-failed               Skip failed chapters and continue
#   --clear-errors              Clear error status before processing
#
# FILTERING:
#   --chapters <range>          Process specific chapters (e.g., "1-5,10")
#   --elements-filter <filter>  Filter elements (e.g., "character:*,place:castle")
#   --limit <n>                 Limit number of items (for testing)
#
# CONFIG OVERRIDES:
#   --model <name>              Override model (e.g., "gpt-4o")
#   --api-key <key>             Override API key
#   --image-key <key>           Separate image API key
#   --output-dir <dir>          Override output directory
#
# OTHER OPTIONS:
#   --dashboard                 Start web dashboard for real-time progress
#   --dashboard-port <port>     Dashboard server port (default: 3000)
#   --dashboard-host <host>     Dashboard server host (default: localhost)
#   --concurrent                Use concurrent processing (experimental)
#   --migrate                   Migrate old state to new schema
#   --verbose                   Verbose logging
#   --quiet                     Minimal output
#   --init-config               Generate this config file
#   --estimate                  Estimate costs without executing
#
# EXAMPLES:
#
#   # Process entire book with free tier model (slow but free)
#   imaginize --file book.epub --text
#
#   # Resume processing after interruption
#   imaginize --file book.epub --text --continue
#
#   # Force regenerate specific chapters
#   imaginize --file book.epub --text --force --chapters 1-5
#
#   # Retry only failed chapters
#   imaginize --file book.epub --text --retry-failed
#
#   # Full pipeline with all formats
#   imaginize --file book.epub --text --elements --images --all-formats
#
#   # Use specific model
#   imaginize --file book.epub --text --model gpt-4o
#
# =============================================================================
`;
}
