/**
 * Configuration types for illustrate
 */

export type AIProvider = 'openai' | 'openrouter' | 'custom';

export interface ModelConfig {
  /** Model name (supports OpenRouter syntax: provider/model) */
  name: string;

  /** Maximum context length in tokens */
  contextLength?: number;

  /** Max tokens per completion */
  maxTokens?: number;

  /** Cost per 1M input tokens (for estimation) */
  inputCostPer1M?: number;

  /** Cost per 1M output tokens (for estimation) */
  outputCostPer1M?: number;

  /** Whether this model supports image generation */
  supportsImages?: boolean;
}

export interface IllustrateConfig {
  /** Number of pages per image recommendation (default: 10) */
  pagesPerImage?: number;

  /** Whether to extract character/item descriptions (default: true) */
  extractElements?: boolean;

  /** Whether to generate images for characters/items (default: false) */
  generateElementImages?: boolean;

  /** API key for text analysis */
  apiKey?: string;

  /** Base URL for API endpoint */
  baseUrl?: string;

  /** Model configuration for text analysis */
  model?: string | ModelConfig;

  /** Separate image generation configuration */
  imageEndpoint?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string | ModelConfig;
  };

  /** Output directory name pattern (default: 'illustrate_{name}') */
  outputPattern?: string;

  /** Maximum concurrent AI requests (default: 3) */
  maxConcurrency?: number;

  /** Image size for generation (default: '1024x1024') */
  imageSize?: '1024x1024' | '1024x1792' | '1792x1024';

  /** Image quality (default: 'standard') */
  imageQuality?: 'standard' | 'hd';

  /** Pages per chapter when no chapters detected (default: 50) */
  pagesPerAutoChapter?: number;

  /** Token safety margin percentage (default: 0.9 = 90% of max) */
  tokenSafetyMargin?: number;

  /** Retry attempts on API failure (default: 1) */
  maxRetries?: number;

  /** Initial retry timeout in ms (default: 5000) */
  retryTimeout?: number;

  /** Limit number of items to process (for testing) */
  limit?: number;
}

export interface BookMetadata {
  title: string;
  author?: string;
  publisher?: string;
  language?: string;
  totalPages?: number;
}

export interface ImageConcept {
  chapter: string;
  chapterNumber?: number; // Actual chapter number from TOC
  pageRange: string;
  quote: string;
  description: string;
  reasoning?: string;
  imageUrl?: string;
  lineNumbers?: { start: number; end: number };
}

export interface BookElement {
  type: 'character' | 'creature' | 'place' | 'item' | 'object';
  name: string;
  quotes: Array<{
    text: string;
    page: string;
  }>;
  description?: string;
  imageUrl?: string;
}

export interface ChapterContent {
  chapterNumber: number;
  chapterTitle: string;
  pageRange: string;
  content: string;
  tokenCount?: number;
  lineNumbers?: { start: number; end: number };
}

/** State management types */
export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type SubPhase = 'plan' | 'estimate' | 'prepare' | 'execute' | 'save';

export interface ChapterState {
  status: PhaseStatus;
  concepts?: number;
  tokensUsed?: number;
  completedAt?: string;
  error?: string;
  imageUrl?: string;
}

export interface PhaseState {
  status: PhaseStatus;
  currentSubPhase?: SubPhase;
  subPhases?: Partial<Record<SubPhase, {
    status: PhaseStatus;
    [key: string]: any;
  }>>;
  chapters?: Record<string, ChapterState>;
  completedAt?: string;
  error?: string;
}

export interface IllustrateState {
  version: string;
  bookFile: string;
  bookTitle: string;
  totalPages: number;
  avgTokensPerPage?: number;
  phases: {
    parse: PhaseState;
    analyze: PhaseState;
    extract: PhaseState;
    illustrate: PhaseState;
  };
  toc: {
    chapters: Array<{
      number: number;
      title: string;
      pages: string;
      tokenCount?: number;
    }>;
  };
  tokenStats: {
    totalUsed: number;
    estimatedRemaining?: number;
  };
  elements?: Array<{
    type: string;
    name: string;
    status: PhaseStatus;
    imageUrl?: string;
  }>;
  lastUpdated: string;
}

/** CLI command options */
export interface CommandOptions {
  // Phase selection
  text?: boolean;
  elements?: boolean;
  images?: boolean;

  // Filtering
  chapters?: string;  // e.g., "1,2,5-10"
  elementsFilter?: string;  // e.g., "character:*, place:castle"
  limit?: number;

  // Control
  continue?: boolean;
  force?: boolean;
  migrate?: boolean;

  // Config override
  model?: string;
  apiKey?: string;
  imageKey?: string;

  // Output
  outputDir?: string;
  verbose?: boolean;
  quiet?: boolean;

  // Utilities
  initConfig?: boolean;
  estimate?: boolean;
  file?: string;
}

/** Token estimation result */
export interface TokenEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  willExceedLimit: boolean;
  suggestedSplits?: number;
}
