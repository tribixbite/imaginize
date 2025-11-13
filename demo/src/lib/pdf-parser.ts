/**
 * PDF parsing using pdf.js
 * Extracts text content from PDF files
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
}

export interface PDFChapter {
  id: string;
  title: string;
  content: string;
  pageStart: number;
  pageEnd: number;
}

export interface PDFParseResult {
  metadata: PDFMetadata;
  chapters: PDFChapter[];
  totalPages: number;
  totalChapters: number;
}

/**
 * Parse PDF file and extract content
 */
export async function parsePDF(file: File, onProgress?: (progress: number) => void): Promise<PDFParseResult> {
  // Convert File to ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Load PDF document
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  // Extract metadata
  const metadataObj = await pdf.getMetadata();
  const info: any = metadataObj.info || {};
  const metadata: PDFMetadata = {
    title: info.Title || 'Unknown Title',
    author: info.Author || 'Unknown Author',
    subject: info.Subject,
    keywords: info.Keywords,
    creator: info.Creator,
    producer: info.Producer,
    creationDate: info.CreationDate,
  };

  // Get outline (table of contents) if available
  const outline = await pdf.getOutline();

  // Extract text from all pages
  const totalPages = pdf.numPages;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Combine text items
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    pageTexts.push(pageText);

    // Report progress
    if (onProgress) {
      onProgress(Math.round((pageNum / totalPages) * 100));
    }
  }

  // Create chapters based on outline or heuristics
  const chapters = await createChapters(pageTexts, outline, metadata);

  return {
    metadata,
    chapters,
    totalPages,
    totalChapters: chapters.length,
  };
}

/**
 * Create chapter divisions from page text and outline
 */
async function createChapters(
  pageTexts: string[],
  outline: any[] | null,
  metadata: PDFMetadata
): Promise<PDFChapter[]> {
  const chapters: PDFChapter[] = [];

  // If outline exists, use it to create chapters
  if (outline && outline.length > 0) {
    for (let i = 0; i < outline.length; i++) {
      const item = outline[i];

      // TODO: Extract page numbers from outline destinations
      // For now, create simplified chapters
      const chapterPages = Math.ceil(pageTexts.length / outline.length);
      const startPage = i * chapterPages;
      const endPage = Math.min(startPage + chapterPages, pageTexts.length);

      const content = pageTexts.slice(startPage, endPage).join('\n\n');

      chapters.push({
        id: `chapter-${i + 1}`,
        title: item.title || `Chapter ${i + 1}`,
        content,
        pageStart: startPage + 1,
        pageEnd: endPage,
      });
    }
  } else {
    // No outline - use heuristic chapter detection
    chapters.push(...detectChaptersHeuristic(pageTexts));
  }

  // If still no chapters, create one chapter with all content
  if (chapters.length === 0) {
    chapters.push({
      id: 'chapter-1',
      title: metadata.title || 'Full Document',
      content: pageTexts.join('\n\n'),
      pageStart: 1,
      pageEnd: pageTexts.length,
    });
  }

  return chapters;
}

/**
 * Detect chapter boundaries using heuristics
 */
function detectChaptersHeuristic(pageTexts: string[]): PDFChapter[] {
  const chapters: PDFChapter[] = [];
  const chapterPattern = /^(Chapter|CHAPTER|Ch\.|ch\.)\s+(\d+|[IVXLCDM]+)/;

  let currentChapter: PDFChapter | null = null;
  let chapterContent: string[] = [];

  for (let i = 0; i < pageTexts.length; i++) {
    const pageText = pageTexts[i];

    // Check if page starts with chapter marker
    const match = pageText.match(chapterPattern);

    if (match) {
      // Save previous chapter if exists
      if (currentChapter) {
        currentChapter.content = chapterContent.join('\n\n');
        currentChapter.pageEnd = i;
        chapters.push(currentChapter);
      }

      // Start new chapter
      const chapterNumber = chapters.length + 1;
      currentChapter = {
        id: `chapter-${chapterNumber}`,
        title: `Chapter ${chapterNumber}`,
        content: '',
        pageStart: i + 1,
        pageEnd: i + 1,
      };
      chapterContent = [pageText];
    } else if (currentChapter) {
      // Add to current chapter
      chapterContent.push(pageText);
    } else {
      // No chapter started yet, accumulate content
      chapterContent.push(pageText);
    }
  }

  // Save last chapter
  if (currentChapter) {
    currentChapter.content = chapterContent.join('\n\n');
    currentChapter.pageEnd = pageTexts.length;
    chapters.push(currentChapter);
  } else if (chapterContent.length > 0) {
    // No chapters detected - create single chapter
    chapters.push({
      id: 'chapter-1',
      title: 'Full Document',
      content: chapterContent.join('\n\n'),
      pageStart: 1,
      pageEnd: pageTexts.length,
    });
  }

  return chapters;
}

/**
 * Validate PDF file structure
 */
export async function validatePDF(file: File): Promise<{ valid: boolean; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    if (pdf.numPages === 0) {
      return { valid: false, error: 'PDF has no pages' };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}

/**
 * Get PDF metadata without full parsing
 */
export async function getPDFMetadata(file: File): Promise<PDFMetadata> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const metadataObj = await pdf.getMetadata();
  const info: any = metadataObj.info || {};

  return {
    title: info.Title || 'Unknown Title',
    author: info.Author || 'Unknown Author',
    subject: info.Subject,
    keywords: info.Keywords,
    creator: info.Creator,
    producer: info.Producer,
    creationDate: info.CreationDate,
  };
}
