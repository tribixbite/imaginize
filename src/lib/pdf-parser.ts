/**
 * PDF file parser
 * Extracts text content and metadata from PDF files
 */

import { readFile } from 'fs/promises';
import pdfParse from 'pdf-parse';
import type { BookMetadata, ChapterContent } from '../types/config.js';

/**
 * Parse PDF file and extract all content
 */
export async function parsePdf(filePath: string): Promise<{
  metadata: BookMetadata;
  chapters: ChapterContent[];
  fullText: string;
}> {
  const dataBuffer = await readFile(filePath);
  const pdfData = await pdfParse(dataBuffer);

  // Extract metadata
  const metadata: BookMetadata = {
    title: pdfData.info?.Title || 'Unknown',
    author: pdfData.info?.Author || undefined,
    publisher: pdfData.info?.Producer || undefined,
    totalPages: pdfData.numpages,
  };

  // Split content into chapters (heuristic approach)
  const chapters = splitIntoChapters(pdfData.text, pdfData.numpages);
  const fullText = pdfData.text;

  return { metadata, chapters, fullText };
}

/**
 * Split PDF text into chapters using heuristics
 * Looks for common chapter markers like "Chapter N", "CHAPTER N", etc.
 */
function splitIntoChapters(text: string, totalPages: number): ChapterContent[] {
  const chapters: ChapterContent[] = [];

  // Try to find chapter markers
  const chapterRegex =
    /(?:^|\n)\s*(?:Chapter|CHAPTER|Ch\.|CH\.)\s+(\d+|[IVX]+)[\s.:]+([^\n]*)/gm;
  const matches = Array.from(text.matchAll(chapterRegex));

  if (matches.length === 0) {
    // No chapters found, treat entire book as one chapter
    return [
      {
        chapterNumber: 1,
        chapterTitle: 'Full Book',
        pageRange: `1-${totalPages}`,
        content: text,
      },
    ];
  }

  // Process each chapter
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const nextMatch = matches[i + 1];

    const chapterNum = i + 1;
    const chapterTitle = match[2]?.trim() || `Chapter ${chapterNum}`;
    const startPos = match.index || 0;
    const endPos = nextMatch?.index || text.length;

    const chapterText = text.substring(startPos, endPos).trim();

    // Estimate page range (rough approximation)
    const startPage = Math.floor((startPos / text.length) * totalPages) + 1;
    const endPage = Math.floor((endPos / text.length) * totalPages);
    const pageRange = `${startPage}-${endPage}`;

    chapters.push({
      chapterNumber: chapterNum,
      chapterTitle,
      pageRange,
      content: chapterText,
    });
  }

  return chapters;
}
