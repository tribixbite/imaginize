/**
 * Output file generators
 * Creates Contents.md and Elements.md files
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';
import type { ImageConcept, BookElement, BookMetadata } from '../types/config.js';

/**
 * Generate Contents.md - Table of Contents linking to other files
 */
export async function generateContentsFile(
  outputDir: string,
  metadata: BookMetadata,
  chaptersCount: number,
  elementsCount: number
): Promise<void> {
  let content = `# ${metadata.title}\n\n`;

  if (metadata.author) {
    content += `**Author:** ${metadata.author}\n`;
  }
  if (metadata.publisher) {
    content += `**Publisher:** ${metadata.publisher}\n`;
  }
  if (metadata.totalPages) {
    content += `**Total Pages:** ${metadata.totalPages}\n`;
  }

  content += '\n---\n\n';
  content += '## Generated Documentation\n\n';
  content += 'This illustration guide contains:\n\n';
  content += `- **[Chapters.md](./Chapters.md)** - ${chaptersCount} visual scenes organized by chapter\n`;
  content += `- **[Elements.md](./Elements.md)** - ${elementsCount} story elements (characters, places, items)\n`;
  content += '\n---\n\n';
  content += '## How to Use This Guide\n\n';
  content += '1. **Chapters.md**: Browse visual scenes chapter by chapter. Each scene includes exact quotes from the source text and factual descriptions.\n\n';
  content += '2. **Elements.md**: Reference catalog of characters, creatures, places, and items with multiple source quotes for accurate illustration.\n\n';
  content += '3. **Cross-Reference**: When illustrating a scene mentioning a character or place, check Elements.md for their complete description.\n\n';

  const filePath = join(outputDir, 'Contents.md');
  await writeFile(filePath, content);
}

/**
 * Generate Chapters.md file with visual scenes by chapter
 */
export async function generateChaptersFile(
  outputDir: string,
  metadata: BookMetadata,
  conceptsByChapter: Map<string, ImageConcept[]>
): Promise<void> {
  let content = `# Chapters - ${metadata.title}\n\n`;
  content += '## Visual Scenes by Chapter\n\n';
  content += 'Each scene includes exact quotes from the source text for illustration reference.\n\n';
  content += '---\n\n';

  // Group concepts by chapter
  for (const [chapterTitle, concepts] of conceptsByChapter.entries()) {
    if (concepts.length === 0) continue;

    content += `### ${chapterTitle}\n\n`;

    concepts.forEach((concept, index) => {
      content += `#### Scene ${index + 1}\n\n`;
      content += `**Pages:** ${concept.pageRange}\n\n`;
      content += `**Source Text:**\n> ${concept.quote}\n\n`;
      content += `**Visual Elements:** ${concept.description}\n\n`;
      content += '---\n\n';
    });
  }

  const filePath = join(outputDir, 'Chapters.md');
  await writeFile(filePath, content);
}

/**
 * Generate Elements.md file with characters, places, items, etc.
 */
export async function generateElementsFile(
  outputDir: string,
  metadata: BookMetadata,
  elements: BookElement[]
): Promise<void> {
  let content = `# Elements - ${metadata.title}\n\n`;

  if (metadata.author) {
    content += `**Author:** ${metadata.author}\n\n`;
  }

  content += '---\n\n';
  content += '## Story Elements\n\n';
  content += 'This document catalogs key characters, creatures, places, items, and objects mentioned in the book, with direct quotes for accurate illustration reference.\n\n';

  // Group elements by type
  const elementsByType = new Map<string, BookElement[]>();
  for (const element of elements) {
    const type = element.type;
    if (!elementsByType.has(type)) {
      elementsByType.set(type, []);
    }
    elementsByType.get(type)!.push(element);
  }

  // Generate sections for each type
  const typeOrder = ['character', 'creature', 'place', 'item', 'object'];
  const typeLabels = {
    character: 'Characters',
    creature: 'Creatures',
    place: 'Places',
    item: 'Items',
    object: 'Objects',
  };

  for (const type of typeOrder) {
    const typeElements = elementsByType.get(type);
    if (!typeElements || typeElements.length === 0) continue;

    content += `### ${typeLabels[type as keyof typeof typeLabels]}\n\n`;

    typeElements.forEach((element) => {
      content += `#### ${element.name}\n\n`;

      if (element.description) {
        content += `**Description:** ${element.description}\n\n`;
      }

      content += '**Reference Quotes:**\n\n';
      element.quotes.forEach((quote, index) => {
        content += `${index + 1}. (Page ${quote.page})\n`;
        content += `   > ${quote.text}\n\n`;
      });

      if (element.imageUrl) {
        content += `**Generated Image:** [View Image](${element.imageUrl})\n\n`;
      }

      content += '---\n\n';
    });
  }

  // Add statistics
  content += '## Statistics\n\n';
  for (const [type, typeElements] of elementsByType.entries()) {
    const label = typeLabels[type as keyof typeof typeLabels] || type;
    content += `- **${label}:** ${typeElements.length}\n`;
  }

  const filePath = join(outputDir, 'Elements.md');
  await writeFile(filePath, content);
}
