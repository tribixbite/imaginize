/**
 * EPUB file parser
 * Extracts text content and metadata from EPUB files
 */

import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';
import { load } from 'cheerio';
import type { BookMetadata, ChapterContent } from '../types/config.js';

/**
 * Patterns for detecting non-story front-matter and back-matter content
 * These should be filtered out to avoid generating images of book covers, TOCs, etc.
 */
const FRONT_MATTER_TITLE_PATTERNS = [
  /^cover$/i,
  /^title\s*page$/i,
  /^half\s*title$/i,
  /^copyright$/i,
  /^table\s*of\s*contents$/i,
  /^contents$/i,
  /^toc$/i,
  /^dedication$/i,
  /^acknowledgment/i,
  /^about\s*the\s*author/i,
  /^also\s*by/i,
  /^other\s*books/i,
  /^praise\s*for/i,
  /^mini\s*toc$/i,
];

const BACK_MATTER_TITLE_PATTERNS = [
  /^about\s*the\s*author/i,
  /^also\s*by/i,
  /^other\s*books/i,
  /^newsletter/i,
  /^sign\s*up/i,
  /^connect\s*with/i,
  /^follow\s*us/i,
  /^advertisement/i,
  /^preview/i,
  /^excerpt/i,
  /^teaser/i,
  /^bonus/i,
  /^afterword/i,
  /^appendix/i,
  /^glossary/i,
  /^index$/i,
  /^bibliography/i,
  /^notes$/i,
  /^endnotes/i,
];

/**
 * Content patterns that indicate non-story material
 */
const NON_STORY_CONTENT_PATTERNS = [
  /sign\s*up\s*(for|to)\s*(our|the|a)?\s*newsletter/i,
  /subscribe\s*(to|for)\s*(our|the|a)?\s*newsletter/i,
  /join\s*(our|the)?\s*(mailing\s*list|newsletter)/i,
  /tor\.com/i,
  /visit\s*(us\s*at|our\s*website)/i,
  /follow\s*(us\s*on|@)/i,
  /copyright\s*©?\s*\d{4}/i,
  /all\s*rights\s*reserved/i,
  /isbn[:\s]*[\d-]+/i,
  /printed\s*in\s*(the\s*)?(united\s*states|usa|u\.s\.a)/i,
  /first\s*(edition|printing)/i,
  /library\s*of\s*congress/i,
];

/**
 * Parse EPUB file and extract all content
 */
export async function parseEpub(filePath: string): Promise<{
  metadata: BookMetadata;
  chapters: ChapterContent[];
  fullText: string;
}> {
  // EPUB is a ZIP archive
  const zip = new AdmZip(filePath);
  const zipEntries = zip.getEntries();

  // Find container.xml to locate content.opf
  const containerEntry = zipEntries.find((e) => e.entryName.endsWith('container.xml'));
  if (!containerEntry) {
    throw new Error('Invalid EPUB: container.xml not found');
  }

  const containerXml = containerEntry.getData().toString('utf8');
  const containerData = await parseStringPromise(containerXml);
  const rootfilePath = containerData.container.rootfiles[0].rootfile[0].$['full-path'];

  // Parse content.opf
  const opfEntry = zipEntries.find((e) => e.entryName === rootfilePath);
  if (!opfEntry) {
    throw new Error('Invalid EPUB: content.opf not found');
  }

  const opfXml = opfEntry.getData().toString('utf8');
  const opfData = await parseStringPromise(opfXml);

  // Extract metadata
  const metadataNode = opfData.package.metadata[0];

  // Helper to extract text from xml2js objects
  const extractText = (value: unknown): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null && '_' in value) {
      return (value as { _: string })._;
    }
    if (typeof value === 'object' && !Array.isArray(value)) return undefined;
    return String(value);
  };

  const metadata: BookMetadata = {
    title: extractText(metadataNode['dc:title']?.[0]) || 'Unknown',
    author: extractText(metadataNode['dc:creator']?.[0]) || undefined,
    publisher: extractText(metadataNode['dc:publisher']?.[0]) || undefined,
    language: extractText(metadataNode['dc:language']?.[0]) || undefined,
  };

  // Get spine (reading order) and manifest (file locations)
  interface ItemRef {
    $: { idref: string };
  }
  interface ManifestItem {
    $: { id: string; href: string };
  }
  const spine = opfData.package.spine[0].itemref.map((item: ItemRef) => item.$.idref);
  const manifest = new Map(
    opfData.package.manifest[0].item.map((item: ManifestItem) => [item.$.id, item.$.href])
  );

  // Get the base directory for content files
  const baseDir = rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1);

  const chapters: ChapterContent[] = [];
  let fullText = '';
  let currentPage = 1;
  let currentLine = 1;

  // Process each chapter in spine order
  for (let i = 0; i < spine.length; i++) {
    const itemId = spine[i];
    const href = manifest.get(itemId);

    if (!href) continue;

    const contentPath = baseDir + href;
    const contentEntry = zipEntries.find((e) => e.entryName === contentPath);

    if (!contentEntry) continue;

    try {
      const htmlContent = contentEntry.getData().toString('utf8');
      const textContent = extractTextFromHtml(htmlContent);

      if (textContent.trim().length > 0) {
        // Try to get chapter title from HTML
        const $ = load(htmlContent);
        const chapterTitle =
          $('h1').first().text() ||
          $('h2').first().text() ||
          $('title').text() ||
          `Chapter ${i + 1}`;

        const trimmedTitle = chapterTitle.trim();

        // Skip non-story content based on title patterns
        if (isFrontMatter(trimmedTitle) || isBackMatter(trimmedTitle)) {
          console.log(`[epub-parser] Skipping front/back matter: "${trimmedTitle}"`);
          continue;
        }

        // Skip non-story content based on content patterns
        if (isNonStoryContent(textContent)) {
          console.log(`[epub-parser] Skipping promotional/marketing content: "${trimmedTitle}"`);
          continue;
        }

        // Estimate pages (roughly 300 words per page)
        const wordCount = textContent.split(/\s+/).length;
        const estimatedPages = Math.ceil(wordCount / 300);
        const pageRange = `${currentPage}-${currentPage + estimatedPages - 1}`;

        // Count lines in this chapter
        const lineCount = textContent.split('\n').length;
        const lineStart = currentLine;
        const lineEnd = currentLine + lineCount - 1;

        chapters.push({
          chapterNumber: chapters.length + 1, // Sequential numbering after filtering
          chapterTitle: trimmedTitle,
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
 * Check if a chapter title matches front-matter patterns
 */
function isFrontMatter(title: string): boolean {
  return FRONT_MATTER_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

/**
 * Check if a chapter title matches back-matter patterns
 */
function isBackMatter(title: string): boolean {
  return BACK_MATTER_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

/**
 * Check if content contains non-story material (marketing, promotional, legal)
 * Returns true if more than 30% of the content matches non-story patterns
 * or if the content is very short with mostly non-story indicators
 */
function isNonStoryContent(content: string): boolean {
  const lowercaseContent = content.toLowerCase();
  const wordCount = content.split(/\s+/).length;

  // Short content with multiple non-story indicators is likely promotional
  if (wordCount < 200) {
    const matchCount = NON_STORY_CONTENT_PATTERNS.filter((pattern) =>
      pattern.test(content)
    ).length;
    // If more than 2 patterns match in short content, skip it
    if (matchCount >= 2) {
      return true;
    }
  }

  // Check for specific promotional content that should always be skipped
  if (
    lowercaseContent.includes('sign up for') &&
    lowercaseContent.includes('newsletter')
  ) {
    return true;
  }

  // Check for ISBN/copyright blocks that indicate title/copyright pages
  if (
    lowercaseContent.includes('isbn') &&
    (lowercaseContent.includes('copyright') || lowercaseContent.includes('published'))
  ) {
    return true;
  }

  return false;
}

/**
 * Sanitize filename for directory creation
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.epub$/i, '')
    .replace(/\.pdf$/i, '')
    .replace(/\.mobi$/i, '')
    .replace(/\.azw3?$/i, '')
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}
