/**
 * Output Generation Benchmarks
 *
 * Benchmarks for Markdown file generation (string building operations)
 */

import type { BenchmarkSuite } from '../harness/types.js';
import type { ImageConcept, BookElement, BookMetadata } from '../../../types/config.js';

// Test data - realistic book metadata
const testMetadata: BookMetadata = {
  title: 'The Chronicles of Aethermoor',
  author: 'J.R. Storyteller',
  publisher: 'Fantasy Press',
  totalPages: 450,
  language: 'en',
};

// Generate test visual concepts
function generateTestConcepts(count: number): Map<string, ImageConcept[]> {
  const conceptsByChapter = new Map<string, ImageConcept[]>();

  for (let chapter = 1; chapter <= 10; chapter++) {
    const concepts: ImageConcept[] = [];
    for (let i = 0; i < count; i++) {
      concepts.push({
        chapter: `Chapter ${chapter}`,
        pageRange: `${chapter * 10}-${chapter * 10 + 10}`,
        quote: `"The wizard raised his staff, and a brilliant light emanated from its tip, illuminating the dark forest with an ethereal glow. Shadows danced across the ancient trees as the magic pulsed through the air."`,
        description: `A dramatic scene showing a wizard using powerful magic in a dark forest, with glowing light and dancing shadows`,
        reasoning: `This is a visually striking moment that captures the wonder and danger of magic in this world`,
      });
    }
    conceptsByChapter.set(`Chapter ${chapter}`, concepts);
  }

  return conceptsByChapter;
}

// Generate test story elements
function generateTestElements(count: number): BookElement[] {
  const elements: BookElement[] = [];
  const types = ['character', 'creature', 'place', 'item', 'object'];

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    elements.push({
      type: type as 'character' | 'creature' | 'place' | 'item' | 'object',
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${i + 1}`,
      description: `A detailed description of this ${type}, including physical appearance, characteristics, and significance to the story. This description is based on multiple references throughout the text.`,
      quotes: [
        {
          text: `"A vivid description from the text that provides visual details about this ${type}."`,
          page: `${Math.floor(Math.random() * 400) + 1}`,
        },
        {
          text: `"Another quote providing additional context and visual information about this ${type}."`,
          page: `${Math.floor(Math.random() * 400) + 1}`,
        },
        {
          text: `"A third reference that helps complete the picture of this ${type}."`,
          page: `${Math.floor(Math.random() * 400) + 1}`,
        },
      ],
    });
  }

  return elements;
}

// Benchmark helper - build Contents.md string
function buildContentsMarkdown(
  metadata: BookMetadata,
  chaptersCount: number,
  elementsCount: number
): string {
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
  content +=
    '1. **Chapters.md**: Browse visual scenes chapter by chapter. Each scene includes exact quotes from the source text and factual descriptions.\n\n';
  content +=
    '2. **Elements.md**: Reference catalog of characters, creatures, places, and items with multiple source quotes for accurate illustration.\n\n';
  content +=
    '3. **Cross-Reference**: When illustrating a scene mentioning a character or place, check Elements.md for their complete description.\n\n';

  return content;
}

// Benchmark helper - build Chapters.md string
function buildChaptersMarkdown(
  metadata: BookMetadata,
  conceptsByChapter: Map<string, ImageConcept[]>
): string {
  let content = `# Chapters - ${metadata.title}\n\n`;
  content += '## Visual Scenes by Chapter\n\n';
  content +=
    'Each scene includes exact quotes from the source text for illustration reference.\n\n';
  content += '---\n\n';

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

  return content;
}

// Benchmark helper - build Elements.md string
function buildElementsMarkdown(metadata: BookMetadata, elements: BookElement[]): string {
  let content = `# Elements - ${metadata.title}\n\n`;

  if (metadata.author) {
    content += `**Author:** ${metadata.author}\n\n`;
  }

  content += '---\n\n';
  content += '## Story Elements\n\n';
  content +=
    'This document catalogs key characters, creatures, places, items, and objects mentioned in the book, with direct quotes for accurate illustration reference.\n\n';

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

      content += '---\n\n';
    });
  }

  // Add statistics
  content += '## Statistics\n\n';
  for (const [type, typeElements] of elementsByType.entries()) {
    const label = typeLabels[type as keyof typeof typeLabels] || type;
    content += `- **${label}:** ${typeElements.length}\n`;
  }

  return content;
}

export const outputSuite: BenchmarkSuite = {
  name: 'Output Generation',
  description: 'Markdown file generation (string building)',
  benchmarks: [
    {
      name: 'Build Contents.md (small - 10 chapters, 20 elements)',
      fn: () => {
        buildContentsMarkdown(testMetadata, 10, 20);
      },
      config: {
        warmupIterations: 5,
        iterations: 20,
        collectMemory: true,
      },
    },
    {
      name: 'Build Contents.md (large - 50 chapters, 200 elements)',
      fn: () => {
        buildContentsMarkdown(testMetadata, 50, 200);
      },
      config: {
        warmupIterations: 5,
        iterations: 20,
        collectMemory: true,
      },
    },
    {
      name: 'Build Chapters.md (small - 1 concept per chapter)',
      fn: () => {
        const concepts = generateTestConcepts(1);
        buildChaptersMarkdown(testMetadata, concepts);
      },
      config: {
        warmupIterations: 3,
        iterations: 10,
        collectMemory: true,
      },
    },
    {
      name: 'Build Chapters.md (medium - 5 concepts per chapter)',
      fn: () => {
        const concepts = generateTestConcepts(5);
        buildChaptersMarkdown(testMetadata, concepts);
      },
      config: {
        warmupIterations: 3,
        iterations: 10,
        collectMemory: true,
      },
    },
    {
      name: 'Build Chapters.md (large - 10 concepts per chapter)',
      fn: () => {
        const concepts = generateTestConcepts(10);
        buildChaptersMarkdown(testMetadata, concepts);
      },
      config: {
        warmupIterations: 2,
        iterations: 5,
        collectMemory: true,
      },
    },
    {
      name: 'Build Elements.md (small - 20 elements)',
      fn: () => {
        const elements = generateTestElements(20);
        buildElementsMarkdown(testMetadata, elements);
      },
      config: {
        warmupIterations: 3,
        iterations: 10,
        collectMemory: true,
      },
    },
    {
      name: 'Build Elements.md (medium - 50 elements)',
      fn: () => {
        const elements = generateTestElements(50);
        buildElementsMarkdown(testMetadata, elements);
      },
      config: {
        warmupIterations: 3,
        iterations: 10,
        collectMemory: true,
      },
    },
    {
      name: 'Build Elements.md (large - 100 elements)',
      fn: () => {
        const elements = generateTestElements(100);
        buildElementsMarkdown(testMetadata, elements);
      },
      config: {
        warmupIterations: 2,
        iterations: 5,
        collectMemory: true,
      },
    },
  ],
};
