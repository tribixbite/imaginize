/**
 * Configuration types for illustrate
 */

export type AIProvider = 'openai' | 'openrouter' | 'gemini' | 'custom';

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

  /** AI provider selection (auto-detected from baseUrl if not specified) */
  provider?: AIProvider;

  /** Separate image generation configuration */
  imageEndpoint?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string | ModelConfig;
  };

  /** Output directory name pattern (default: 'imaginize_{name}') */
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

  /**
   * Enable visual style consistency system (v2.4.0+)
   * Extracts style guide from first N images and applies to all subsequent images
   * @default true
   */
  enableStyleConsistency?: boolean;

  /**
   * Number of initial images to analyze for style guide extraction
   * @default 3
   */
  styleBootstrapCount?: number;

  /**
   * Minimum consistency score before warning user (0-1)
   * Images scoring below this threshold will trigger consistency alerts
   * @default 0.7
   */
  consistencyThreshold?: number;

  /**
   * Enable character appearance tracking across images
   * Ensures characters look the same in all scenes
   * @default true
   */
  trackCharacterAppearances?: boolean;

  /**
   * Multi-book series configuration
   * Enables element sharing and style inheritance across books
   * @since v2.7.0
   */
  series?: {
    /** Enable series mode */
    enabled: boolean;
    /** Path to series root directory (relative to book directory) */
    seriesRoot: string;
    /** Unique book ID (must match ID in .imaginize.series.json) */
    bookId: string;
    /** Book title for series catalog */
    bookTitle?: string;
  };

  /**
   * Custom prompt templates for fine-grained control
   * Allows overriding default prompts for each phase
   * @since v2.7.0
   */
  customTemplates?: {
    /** Enable custom templates */
    enabled: boolean;
    /** Directory containing template files */
    templatesDir?: string;
    /** Analyze phase template file */
    analyzeTemplate?: string;
    /** Extract phase template file */
    extractTemplate?: string;
    /** Illustrate phase template file */
    illustrateTemplate?: string;
    /** Use built-in preset (fantasy, scifi, mystery, romance) */
    preset?: 'fantasy' | 'scifi' | 'mystery' | 'romance';
  };

  /**
   * Book genre for template customization
   * Used in template variables like {{genre}}
   * @since v2.7.0
   */
  genre?: string;

  /**
   * Granular retry control
   * Allows skipping failed chapters or retrying only failed ones
   * @since v2.7.0
   */
  retryControl?: {
    /** Skip failed chapters and continue processing (default: false) */
    skipFailed?: boolean;
    /** Only retry chapters that previously failed (default: false) */
    retryFailed?: boolean;
    /** Clear error status for all chapters before processing (default: false) */
    clearErrors?: boolean;
  };

  /**
   * Maximum characters for element extraction per chunk
   * Prevents context window overflows when processing large books
   * @default 50000
   * @since v2.8.0
   */
  maxExtractionChars?: number;

  /**
   * Enable iterative element extraction (chapter-by-chapter)
   * Recommended for better token efficiency and element enrichment
   * @default true
   * @since v2.8.0
   */
  iterativeExtraction?: boolean;

  /**
   * Enable LLM-based element normalization
   * Uses AI to merge duplicate elements and handle aliases
   * @default true
   * @since v2.8.0
   */
  smartElementMerging?: boolean;

  /**
   * Confidence threshold for entity matching (0-1)
   * Lower values merge more aggressively, higher values are more conservative
   * @default 0.7
   * @since v2.8.0
   */
  entityMatchConfidence?: number;

  /**
   * Enable AI-powered description enrichment
   * Uses LLM to consolidate descriptions for better readability
   * @default false (uses simple concatenation)
   * @since v2.8.0
   */
  aiDescriptionEnrichment?: boolean;

  /**
   * Nano Banana (Gemini 2.5 Flash Image) specific configuration
   * @since v2.9.0
   */
  nanoBanana?: {
    /** Use markdown lists for requirements (recommended) */
    useMarkdownLists?: boolean;
    /** Add professional photography buzzwords */
    usePhotographyBuzzwords?: boolean;
    /** Enforce physical realism constraints */
    enforcePhysicality?: boolean;
    /** Use JSON-structured prompts (experimental) */
    useJsonPrompts?: boolean;
    /** Specify exact hex colors */
    useHexColors?: boolean;
  };
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
  mood?: string; // Emotional atmosphere of the scene
  lighting?: string; // Time of day and lighting conditions
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
  aliases?: string[]; // Tracked by entity resolution system
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
  concepts?: number; // DEPRECATED: Use sceneConcepts.length instead
  sceneConcepts?: ImageConcept[]; // Full scene data from analysis
  elements?: BookElement[]; // Full element data extracted from chapter
  tokensUsed?: number;
  completedAt?: string;
  error?: string;
  imageUrl?: string;
}

export interface PhaseState {
  status: PhaseStatus;
  currentSubPhase?: SubPhase;
  subPhases?: Partial<
    Record<
      SubPhase,
      {
        status: PhaseStatus;
        [key: string]: unknown;
      }
    >
  >;
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
  elements?: BookElement[]; // Full element data for regeneration
  lastUpdated: string;
}

/** CLI command options */
export interface CommandOptions {
  // Phase selection
  text?: boolean;
  elements?: boolean;
  images?: boolean;
  pdf?: boolean;
  cbz?: boolean;
  epub?: boolean;
  html?: boolean;
  webpAlbum?: boolean;
  webpStrip?: boolean;
  allFormats?: boolean;

  // Filtering
  chapters?: string; // e.g., "1,2,5-10"
  elementsFilter?: string; // e.g., "character:*, place:castle"
  limit?: number;

  // Control
  continue?: boolean;
  force?: boolean;
  migrate?: boolean;
  concurrent?: boolean;

  // Retry control
  skipFailed?: boolean;
  retryFailed?: boolean;
  clearErrors?: boolean;

  // Config override
  model?: string;
  apiKey?: string;
  imageKey?: string;
  provider?: string; // 'openai', 'openrouter', 'gemini', 'custom'

  // Output
  outputDir?: string;
  verbose?: boolean;
  quiet?: boolean;

  // Utilities
  initConfig?: boolean;
  estimate?: boolean;
  file?: string;

  // Dashboard
  dashboard?: boolean;
  dashboardPort?: number;
  dashboardHost?: string;
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
