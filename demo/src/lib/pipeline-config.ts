/**
 * Dynamic Pipeline Configuration System
 * Exposes CLI capabilities to the web app dynamically
 */

export interface PipelinePhase {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  order: number;
}

export interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: ModelOption[];
  requiresApiKey: boolean;
  freeModels?: string[];
}

export interface ModelOption {
  id: string;
  name: string;
  type: 'text' | 'image';
  contextWindow?: number;
  costPer1kTokens?: number;
  costPerImage?: number;
}

export interface ProcessingOptions {
  // Model configuration
  textModel: string;
  imageModel: string;
  provider: string;
  apiKey: string;
  imageApiKey?: string;
  baseUrl?: string;
  imageBaseUrl?: string;

  // Processing options
  pagesPerImage: number;
  maxConcurrency: number;
  tokenSafetyMargin: number;

  // Phases to run
  enableAnalysis: boolean;
  enableExtraction: boolean;
  enableIllustration: boolean;

  // Retry configuration
  maxRetries: number;
  retryTimeout: number;
  skipFailed: boolean;

  // Output options
  imageSize: '1024x1024' | '1024x1792' | '1792x1024';
  imageQuality: 'standard' | 'hd';

  // Advanced options
  enableStyleConsistency: boolean;
  trackCharacterAppearances: boolean;
  styleGuide?: string;
}

/**
 * Available pipeline phases
 * Derived from CLI capabilities
 */
export const PIPELINE_PHASES: PipelinePhase[] = [
  {
    id: 'parse',
    name: 'Parse',
    description: 'Extract text and structure from book file',
    enabled: true,
    order: 1,
  },
  {
    id: 'analyze',
    name: 'Analyze',
    description: 'Identify visual scenes for illustration',
    enabled: true,
    order: 2,
  },
  {
    id: 'extract',
    name: 'Extract Elements',
    description: 'Catalog characters, places, and objects',
    enabled: false,
    order: 3,
  },
  {
    id: 'illustrate',
    name: 'Illustrate',
    description: 'Generate images for identified scenes',
    enabled: true,
    order: 4,
  },
];

/**
 * Available model providers
 * Derived from CLI configuration system
 */
export const MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        type: 'text',
        contextWindow: 128000,
        costPer1kTokens: 0.005,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        type: 'text',
        contextWindow: 128000,
        costPer1kTokens: 0.00015,
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        type: 'text',
        contextWindow: 128000,
        costPer1kTokens: 0.01,
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        type: 'text',
        contextWindow: 8192,
        costPer1kTokens: 0.03,
      },
      {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        type: 'image',
        costPerImage: 0.04,
      },
      {
        id: 'dall-e-2',
        name: 'DALL-E 2',
        type: 'image',
        costPerImage: 0.02,
      },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    freeModels: [
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-3.2-3b-instruct:free',
    ],
    models: [
      {
        id: 'google/gemini-2.0-flash-exp:free',
        name: 'Gemini 2.0 Flash (Free)',
        type: 'text',
        contextWindow: 1000000,
        costPer1kTokens: 0,
      },
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        type: 'text',
        contextWindow: 200000,
        costPer1kTokens: 0.003,
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o (via OpenRouter)',
        type: 'text',
        contextWindow: 128000,
        costPer1kTokens: 0.005,
      },
      {
        id: 'meta-llama/llama-3.2-3b-instruct:free',
        name: 'Llama 3.2 3B (Free)',
        type: 'text',
        contextWindow: 131072,
        costPer1kTokens: 0,
      },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Endpoint',
    baseUrl: '',
    requiresApiKey: false,
    models: [
      {
        id: 'custom-text',
        name: 'Custom Text Model',
        type: 'text',
      },
      {
        id: 'custom-image',
        name: 'Custom Image Model',
        type: 'image',
      },
    ],
  },
];

/**
 * Default processing options
 */
export const DEFAULT_OPTIONS: ProcessingOptions = {
  // Model configuration
  textModel: 'gpt-4o-mini',
  imageModel: 'dall-e-3',
  provider: 'openai',
  apiKey: '',

  // Processing options
  pagesPerImage: 10,
  maxConcurrency: 3,
  tokenSafetyMargin: 0.9,

  // Phases
  enableAnalysis: true,
  enableExtraction: false,
  enableIllustration: true,

  // Retry
  maxRetries: 3,
  retryTimeout: 5000,
  skipFailed: true,

  // Output
  imageSize: '1024x1024',
  imageQuality: 'standard',

  // Advanced
  enableStyleConsistency: false,
  trackCharacterAppearances: false,
};

/**
 * Image size options
 */
export const IMAGE_SIZES = [
  { id: '1024x1024', name: 'Square (1024x1024)', aspect: '1:1' },
  { id: '1024x1792', name: 'Portrait (1024x1792)', aspect: '9:16' },
  { id: '1792x1024', name: 'Landscape (1792x1024)', aspect: '16:9' },
] as const;

/**
 * Get models for a specific provider and type
 */
export function getModelsForProvider(
  providerId: string,
  type: 'text' | 'image'
): ModelOption[] {
  const provider = MODEL_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return [];
  return provider.models.filter((m) => m.type === type);
}

/**
 * Get provider by ID
 */
export function getProvider(providerId: string): ModelProvider | undefined {
  return MODEL_PROVIDERS.find((p) => p.id === providerId);
}

/**
 * Get model info
 */
export function getModelInfo(
  providerId: string,
  modelId: string
): ModelOption | undefined {
  const provider = getProvider(providerId);
  if (!provider) return undefined;
  return provider.models.find((m) => m.id === modelId);
}

/**
 * Estimate cost for processing
 */
export function estimateCost(
  options: ProcessingOptions,
  chapters: number,
  estimatedTokens: number
): { analysisCost: number; imageCost: number; totalCost: number } {
  const textModel = getModelInfo(options.provider, options.textModel);
  const imageModel = getModelInfo(options.provider, options.imageModel);

  const costPer1kTokens = textModel?.costPer1kTokens || 0.01;
  const costPerImage = imageModel?.costPerImage || 0.04;

  // Estimate ~5 images per chapter
  const estimatedImages = chapters * 5;

  const analysisCost = (estimatedTokens / 1000) * costPer1kTokens;
  const imageCost = estimatedImages * costPerImage;
  const totalCost = analysisCost + imageCost;

  return {
    analysisCost: Math.round(analysisCost * 100) / 100,
    imageCost: Math.round(imageCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
  };
}

/**
 * Validate processing options
 */
export function validateOptions(
  options: ProcessingOptions
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!options.apiKey) {
    errors.push('API key is required');
  }

  const provider = getProvider(options.provider);
  if (!provider) {
    errors.push(`Unknown provider: ${options.provider}`);
  }

  if (options.provider === 'custom' && !options.baseUrl) {
    errors.push('Custom endpoint requires a base URL');
  }

  if (options.pagesPerImage < 1 || options.pagesPerImage > 100) {
    errors.push('Pages per image must be between 1 and 100');
  }

  if (options.maxConcurrency < 1 || options.maxConcurrency > 10) {
    errors.push('Max concurrency must be between 1 and 10');
  }

  if (!options.enableAnalysis && !options.enableExtraction) {
    errors.push('At least one processing phase must be enabled');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get base URL for a provider
 */
export function getBaseUrl(options: Partial<ProcessingOptions>): string {
  if (options.baseUrl) return options.baseUrl;
  const provider = getProvider(options.provider || 'openai');
  return provider?.baseUrl || 'https://api.openai.com/v1';
}
