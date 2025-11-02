/**
 * Configuration types for illustrate
 */

export interface IllustrateConfig {
  /** Number of pages per image recommendation (default: 10) */
  pagesPerImage?: number;

  /** Whether to extract character/item descriptions (default: true) */
  extractElements?: boolean;

  /** Whether to generate images for characters/items (default: false) */
  generateElementImages?: boolean;

  /** OpenAI API key */
  apiKey?: string;

  /** OpenAI base URL (for custom endpoints) */
  baseUrl?: string;

  /** AI model to use (default: 'gpt-4o') */
  model?: string;

  /** Output directory name pattern (default: 'illustrate_{name}') */
  outputPattern?: string;

  /** Maximum concurrent AI requests (default: 3) */
  maxConcurrency?: number;

  /** Image generation model (default: 'dall-e-3') */
  imageModel?: string;

  /** Image size for generation (default: '1024x1024') */
  imageSize?: '1024x1024' | '1024x1792' | '1792x1024';

  /** Image quality (default: 'standard') */
  imageQuality?: 'standard' | 'hd';
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
  pageRange: string;
  quote: string;
  description: string;
  reasoning?: string;
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
}
