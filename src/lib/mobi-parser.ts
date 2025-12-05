/**
 * MOBI/AZW3 file parser
 * Extracts text content and metadata from MOBI files using @lingo-reader/mobi-parser
 */

import { initMobiFile, initKf8File } from '@lingo-reader/mobi-parser';
import { load } from 'cheerio';
import { readFile } from 'fs/promises';
import type { BookMetadata, ChapterContent } from '../types/config.js';

/**
 * Parse MOBI file and extract all content
 */
export async function parseMobi(filePath: string): Promise<{
  metadata: BookMetadata;
  chapters: ChapterContent[];
  fullText: string;
}> {
  // Read file as Uint8Array for the parser
  const fileBuffer = await readFile(filePath);
  const uint8Array = new Uint8Array(
    fileBuffer.buffer,
    fileBuffer.byteOffset,
    fileBuffer.byteLength
  );

  // Try KF8 format first (newer), fall back to MOBI
  let parser;
  let isKf8 = false;

  try {
    parser = await initKf8File(uint8Array);
    isKf8 = true;
  } catch {
    // Fall back to standard MOBI format
    parser = await initMobiFile(uint8Array);
  }

  // Get metadata
  const mobiMetadata = parser.getMetadata();
  const metadata: BookMetadata = {
    title: mobiMetadata.title || 'Unknown',
    author: mobiMetadata.author?.join(', ') || undefined,
    publisher: mobiMetadata.publisher || undefined,
    language: mobiMetadata.language || undefined,
  };

  // Get spine (chapter list)
  const spine = parser.getSpine();
  const toc = parser.getToc();

  const chapters: ChapterContent[] = [];
  let fullText = '';
  let currentPage = 1;
  let currentLine = 1;

  // Process each chapter in spine order
  for (let i = 0; i < spine.length; i++) {
    const spineItem = spine[i];
    const chapterId = spineItem.id;

    try {
      const processedChapter = parser.loadChapter(chapterId);

      if (!processedChapter || !processedChapter.html) {
        continue;
      }

      // Extract text content from HTML using cheerio
      const textContent = extractTextFromHtml(processedChapter.html);

      if (textContent.trim().length > 0) {
        // Estimate pages (roughly 300 words per page)
        const wordCount = textContent.split(/\s+/).length;
        const estimatedPages = Math.ceil(wordCount / 300);
        const pageRange = `${currentPage}-${currentPage + estimatedPages - 1}`;

        // Try to get chapter title from TOC or HTML
        let chapterTitle = `Chapter ${i + 1}`;

        // Check TOC for matching title
        const tocItem = findTocItemByHref(toc, chapterId);
        if (tocItem) {
          chapterTitle = tocItem.label;
        } else {
          // Try to extract from HTML
          const $ = load(processedChapter.html);
          const htmlTitle = $('h1').first().text() || $('h2').first().text();
          if (htmlTitle && htmlTitle.trim()) {
            chapterTitle = htmlTitle.trim();
          }
        }

        // Count lines in this chapter
        const lineCount = textContent.split('\n').length;
        const lineStart = currentLine;
        const lineEnd = currentLine + lineCount - 1;

        chapters.push({
          chapterNumber: i + 1,
          chapterTitle: chapterTitle.trim(),
          pageRange,
          content: textContent,
          lineNumbers: { start: lineStart, end: lineEnd },
        });

        fullText += textContent + '\n\n';
        currentPage += estimatedPages;
        currentLine = lineEnd + 1;
      }
    } catch (error) {
      console.warn(`Warning: Failed to parse chapter ${i + 1}:`, error);
    }
  }

  // Update total pages in metadata
  metadata.totalPages = currentPage - 1;

  // Clean up parser resources
  parser.destroy();

  return { metadata, chapters, fullText };
}

/**
 * Extract text content from HTML string using cheerio
 */
function extractTextFromHtml(html: string): string {
  const $ = load(html);

  // Remove script and style tags
  $('script, style').remove();

  // Get text content
  const text = $('body').text() || $.root().text();

  // Clean up whitespace
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Find TOC item by href/id
 */
function findTocItemByHref(
  toc: Array<{
    label: string;
    href: string;
    children?: Array<{ label: string; href: string }>;
  }>,
  targetId: string
): { label: string; href: string } | null {
  for (const item of toc) {
    // Check if href matches (might be full href or just id)
    if (item.href === targetId || item.href.includes(targetId)) {
      return item;
    }

    // Check children recursively
    if (item.children) {
      const found = findTocItemByHref(item.children, targetId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Sanitize filename for directory creation (including .mobi)
 */
export function sanitizeMobiFilename(filename: string): string {
  return filename
    .replace(/\.mobi$/i, '')
    .replace(/\.azw3?$/i, '')
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}
