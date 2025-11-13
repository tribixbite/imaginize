/**
 * Unified book parser interface for EPUB and PDF files
 */

import { parseEPUB, validateEPUB, getEPUBMetadata, type EPUBParseResult } from './epub-parser';
import { parsePDF, validatePDF, getPDFMetadata, type PDFParseResult } from './pdf-parser';
import type { BookFile } from '../types';

export interface BookMetadata {
  title: string;
  author: string;
  description?: string;
  language?: string;
  publisher?: string;
}

export interface BookChapter {
  id: string;
  number: number;
  title: string;
  content: string;
  wordCount: number;
}

export interface BookParseResult {
  metadata: BookMetadata;
  chapters: BookChapter[];
  totalChapters: number;
  totalWords: number;
  fileType: 'epub' | 'pdf';
}

/**
 * Parse book file (EPUB or PDF) and extract structured content
 */
export async function parseBook(
  bookFile: BookFile,
  onProgress?: (progress: number, message: string) => void
): Promise<BookParseResult> {
  if (bookFile.type === 'epub') {
    return parseEPUBBook(bookFile.file, onProgress);
  } else {
    return parsePDFBook(bookFile.file, onProgress);
  }
}

/**
 * Parse EPUB file
 */
async function parseEPUBBook(
  file: File,
  onProgress?: (progress: number, message: string) => void
): Promise<BookParseResult> {
  onProgress?.(0, 'Loading EPUB file...');

  const result: EPUBParseResult = await parseEPUB(file, (progress) => {
    onProgress?.(progress, `Parsing chapters... ${progress}%`);
  });

  onProgress?.(100, 'EPUB parsing complete');

  // Convert to unified format
  const chapters: BookChapter[] = result.chapters.map((ch, idx) => ({
    id: ch.id,
    number: idx + 1,
    title: ch.title,
    content: ch.content,
    wordCount: countWords(ch.content),
  }));

  const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

  return {
    metadata: {
      title: result.metadata.title || 'Unknown Title',
      author: result.metadata.creator || 'Unknown Author',
      description: result.metadata.description,
      language: result.metadata.language,
      publisher: result.metadata.publisher,
    },
    chapters,
    totalChapters: chapters.length,
    totalWords,
    fileType: 'epub',
  };
}

/**
 * Parse PDF file
 */
async function parsePDFBook(
  file: File,
  onProgress?: (progress: number, message: string) => void
): Promise<BookParseResult> {
  onProgress?.(0, 'Loading PDF file...');

  const result: PDFParseResult = await parsePDF(file, (progress) => {
    onProgress?.(progress, `Parsing pages... ${progress}%`);
  });

  onProgress?.(100, 'PDF parsing complete');

  // Convert to unified format
  const chapters: BookChapter[] = result.chapters.map((ch, idx) => ({
    id: ch.id,
    number: idx + 1,
    title: ch.title,
    content: ch.content,
    wordCount: countWords(ch.content),
  }));

  const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

  return {
    metadata: {
      title: result.metadata.title || 'Unknown Title',
      author: result.metadata.author || 'Unknown Author',
      description: result.metadata.subject,
      language: undefined,
      publisher: result.metadata.producer,
    },
    chapters,
    totalChapters: chapters.length,
    totalWords,
    fileType: 'pdf',
  };
}

/**
 * Validate book file before parsing
 */
export async function validateBook(bookFile: BookFile): Promise<{ valid: boolean; error?: string }> {
  try {
    if (bookFile.type === 'epub') {
      return await validateEPUB(bookFile.file);
    } else {
      return await validatePDF(bookFile.file);
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}

/**
 * Get book metadata without full parsing (faster)
 */
export async function getBookMetadata(bookFile: BookFile): Promise<BookMetadata> {
  try {
    if (bookFile.type === 'epub') {
      const metadata = await getEPUBMetadata(bookFile.file);
      return {
        title: metadata.title || 'Unknown Title',
        author: metadata.creator || 'Unknown Author',
        description: metadata.description,
        language: metadata.language,
        publisher: metadata.publisher,
      };
    } else {
      const metadata = await getPDFMetadata(bookFile.file);
      return {
        title: metadata.title || 'Unknown Title',
        author: metadata.author || 'Unknown Author',
        description: metadata.subject,
        language: undefined,
        publisher: metadata.producer,
      };
    }
  } catch (error) {
    return {
      title: bookFile.name,
      author: 'Unknown Author',
    };
  }
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Estimate processing time based on book size
 */
export function estimateProcessingTime(bookParseResult: BookParseResult): {
  estimatedMinutes: number;
  estimatedCost: number;
} {
  const { totalWords, totalChapters } = bookParseResult;

  // Rough estimates based on typical processing rates
  const wordsPerMinute = 5000; // Conservative estimate for analysis + generation
  const estimatedMinutes = Math.ceil(totalWords / wordsPerMinute);

  // Cost estimation (very rough)
  // Assumes GPT-4 for analysis (~$0.03/1K tokens) and DALL-E 3 for images (~$0.04/image)
  const tokensPerWord = 1.3; // Average tokens per word
  const totalTokens = totalWords * tokensPerWord;
  const analysisTokens = totalTokens * 2; // Input + output
  const analysisCost = (analysisTokens / 1000) * 0.03;
  const imageCost = totalChapters * 5 * 0.04; // ~5 images per chapter
  const estimatedCost = analysisCost + imageCost;

  return {
    estimatedMinutes,
    estimatedCost: Math.round(estimatedCost * 100) / 100, // Round to 2 decimals
  };
}
