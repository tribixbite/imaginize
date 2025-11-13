/**
 * EPUB parsing using epub.js
 * Extracts text content and table of contents from EPUB files
 */

import ePub, { type Book, type NavItem } from 'epubjs';

export interface EPUBMetadata {
  title?: string;
  creator?: string;
  description?: string;
  language?: string;
  publisher?: string;
  rights?: string;
}

export interface EPUBChapter {
  id: string;
  title: string;
  content: string;
  href: string;
}

export interface EPUBParseResult {
  metadata: EPUBMetadata;
  chapters: EPUBChapter[];
  toc: NavItem[];
  totalChapters: number;
}

/**
 * Parse EPUB file and extract content
 */
export async function parseEPUB(file: File, onProgress?: (progress: number) => void): Promise<EPUBParseResult> {
  // Convert File to ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Initialize epub.js book
  const book: Book = ePub(arrayBuffer);

  // Load the book
  await book.ready;

  // Extract metadata
  const metadata: EPUBMetadata = {
    title: book.packaging.metadata.title || 'Unknown Title',
    creator: book.packaging.metadata.creator || 'Unknown Author',
    description: book.packaging.metadata.description,
    language: book.packaging.metadata.language,
    publisher: book.packaging.metadata.publisher,
    rights: book.packaging.metadata.rights,
  };

  // Get table of contents
  const navigation = await book.loaded.navigation;
  const toc = navigation.toc || [];

  // Extract chapters
  const spine: any = book.spine;
  const spineItems = spine.spineItems || [];
  const chapters: EPUBChapter[] = [];

  for (let i = 0; i < spineItems.length; i++) {
    const item = spineItems[i];

    try {
      // Load section content
      const section = book.spine.get(item.href);
      if (!section) continue;

      await section.load(book.load.bind(book));

      // Extract text content from section
      const sectionContent: any = await section.contents;
      const bodyElement = sectionContent?.querySelector('body');
      const content = bodyElement ? extractTextFromElement(bodyElement) : '';

      // Find matching TOC entry
      const tocEntry = findTOCEntry(toc, item.href);

      chapters.push({
        id: item.idref || `chapter-${i + 1}`,
        title: tocEntry?.label || `Chapter ${i + 1}`,
        content: content || '',
        href: item.href,
      });

      // Report progress
      if (onProgress) {
        onProgress(Math.round(((i + 1) / spineItems.length) * 100));
      }

      // Unload section to free memory
      section.unload();
    } catch (error) {
      console.warn(`Failed to load chapter ${i + 1}:`, error);

      // Add placeholder for failed chapter
      chapters.push({
        id: item.idref || `chapter-${i + 1}`,
        title: `Chapter ${i + 1} (Load Failed)`,
        content: '',
        href: item.href,
      });
    }
  }

  // Filter out empty chapters
  const validChapters = chapters.filter(ch => ch.content.trim().length > 0);

  return {
    metadata,
    chapters: validChapters,
    toc,
    totalChapters: validChapters.length,
  };
}

/**
 * Extract plain text from DOM element
 */
function extractTextFromElement(element: any): string {
  if (!element) return '';

  // Get text content
  let text = element.textContent || element.innerText || '';

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\n\s*\n/g, '\n\n') // Preserve paragraph breaks
    .trim();

  return text;
}

/**
 * Find TOC entry matching a given href
 */
function findTOCEntry(toc: NavItem[], href: string): NavItem | null {
  for (const item of toc) {
    // Direct match
    if (item.href === href || item.href.includes(href) || href.includes(item.href)) {
      return item;
    }

    // Check subitems
    if (item.subitems && item.subitems.length > 0) {
      const found = findTOCEntry(item.subitems, href);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Validate EPUB file structure
 */
export async function validateEPUB(file: File): Promise<{ valid: boolean; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const book: Book = ePub(arrayBuffer);
    await book.ready;

    // Check for required components
    if (!book.packaging || !book.spine) {
      return { valid: false, error: 'Invalid EPUB structure: missing required components' };
    }

    const spine: any = book.spine;
    const spineItems = spine.spineItems || [];
    if (spineItems.length === 0) {
      return { valid: false, error: 'EPUB has no content' };
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
 * Get EPUB metadata without full parsing
 */
export async function getEPUBMetadata(file: File): Promise<EPUBMetadata> {
  const arrayBuffer = await file.arrayBuffer();
  const book: Book = ePub(arrayBuffer);
  await book.ready;

  return {
    title: book.packaging.metadata.title || 'Unknown Title',
    creator: book.packaging.metadata.creator || 'Unknown Author',
    description: book.packaging.metadata.description,
    language: book.packaging.metadata.language,
    publisher: book.packaging.metadata.publisher,
    rights: book.packaging.metadata.rights,
  };
}
