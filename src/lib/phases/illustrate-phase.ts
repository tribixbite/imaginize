/**
 * Illustrate phase - Generate images for chapters and elements
 * Corresponds to --images flag
 */

import { BasePhase, type PhaseContext, type SubPhaseResult } from './base-phase.js';
import { resolveModelConfig } from '../token-counter.js';
import type { ImageConcept, BookElement } from '../../types/config.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { generateChaptersFile } from '../output-generator.js';
import fetch from 'node-fetch';

export class IllustratePhase extends BasePhase {
  private concepts: ImageConcept[] = [];
  private elements: BookElement[] = [];
  private styleGuide: string = '';

  constructor(context: PhaseContext) {
    super(context, 'illustrate');
  }

  /**
   * Sub-phase 1: Plan image generation
   */
  protected async plan(): Promise<SubPhaseResult> {
    const { progressTracker, stateManager } = this.context;

    await progressTracker.log('Planning image generation...', 'info');

    // Check prerequisites
    const state = stateManager.getState();
    if (state.phases.analyze.status !== 'completed') {
      throw new Error(
        'Cannot generate images: Contents.md not found. Run: npx imaginize --text'
      );
    }

    // Count how many images we need to generate
    // This would parse Contents.md to find concepts, or check state
    const totalConcepts = Object.values(state.phases.analyze.chapters || {}).reduce(
      (sum, ch) => sum + (ch.concepts || 0),
      0
    );

    await progressTracker.log(
      `Plan: Generate images for ${totalConcepts} concepts`,
      'info'
    );

    return {
      success: true,
      data: {
        totalConcepts,
      },
    };
  }

  /**
   * Sub-phase 2: Estimate costs
   */
  protected async estimate(): Promise<SubPhaseResult> {
    const { config, imageOpenai, progressTracker } = this.context;

    if (!imageOpenai) {
      await progressTracker.log(
        '⚠️  No image generation endpoint configured. Skipping image generation.',
        'warning'
      );
      return { success: true, data: { skipImages: true } };
    }

    // Get image model config
    const imageModel = config.imageEndpoint?.model || 'dall-e-3';
    const modelConfig = resolveModelConfig(imageModel, config);

    await progressTracker.log(
      `Using image model: ${typeof modelConfig === 'string' ? modelConfig : modelConfig.name}`,
      'info'
    );

    return { success: true };
  }

  /**
   * Sub-phase 3: Prepare - Generate style guide
   */
  protected async prepare(): Promise<SubPhaseResult> {
    // Validate image endpoint is configured
    const { imageOpenai, progressTracker, chapters, stateManager } = this.context;

    if (!imageOpenai) {
      await progressTracker.log(
        'Image generation not available (no endpoint configured)',
        'warning'
      );
      return { success: true, data: { skipImages: true } };
    }

    // Generate style guide from book content
    await progressTracker.log('Generating book-wide visual style guide...', 'info');
    this.styleGuide = await this.generateStyleGuide(chapters, stateManager);
    await progressTracker.log('Style guide created', 'success');

    return { success: true };
  }

  /**
   * Generate a consistent visual style guide from book content
   */
  private async generateStyleGuide(chapters: any[], stateManager: any): Promise<string> {
    const { openai } = this.context;

    // Sample first 3 chapters for style analysis
    const sampleText = chapters.slice(0, 3).map(ch => ch.content).join('\n\n').substring(0, 8000);

    const state = stateManager.getState();
    const bookTitle = state.bookTitle;

    const prompt = `Analyze this fantasy book excerpt and create a concise visual style guide for illustration.

Book: ${bookTitle}

Sample text:
${sampleText}

Create a brief style guide (3-4 sentences) covering:
1. Overall visual tone and atmosphere (whimsical, dark, realistic, painterly, etc.)
2. Color palette tendencies
3. Level of detail (realistic vs stylized)
4. Any signature visual elements

Return ONLY the style guide text, no JSON or formatting.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a visual style analyst for book illustrations.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    return response.choices[0]?.message?.content || 'Detailed fantasy illustration with rich atmospheric detail.';
  }

  /**
   * Sub-phase 4: Execute image generation
   */
  protected async executePhase(): Promise<SubPhaseResult> {
    const { progressTracker, imageOpenai, config, outputDir, stateManager } = this.context;

    if (!imageOpenai) {
      await progressTracker.log('No image generation endpoint configured', 'warning');
      return { success: true };
    }

    // Load concepts from state
    const state = stateManager.getState();
    await this.loadConceptsFromState(state);

    if (this.concepts.length === 0) {
      await progressTracker.log('No concepts found to generate images for', 'warning');
      return { success: true };
    }

    // Apply limit if specified
    const limit = config.limit ?? undefined;
    const conceptsToProcess = limit !== undefined ? this.concepts.slice(0, limit) : this.concepts;

    await progressTracker.log(
      `Generating images for ${conceptsToProcess.length} concepts${limit ? ` (limited from ${this.concepts.length})` : ''}...`,
      'info'
    );

    const imageModel = config.imageEndpoint?.model || 'dall-e-3';
    let generatedCount = 0;

    // Track scene numbers per chapter
    const sceneCounters = new Map<number, number>();

    for (const concept of conceptsToProcess) {
      try {
        await progressTracker.log(
          `Generating image for: ${concept.chapter} (${concept.pageRange})`,
          'info'
        );

        // Build prompt from description
        const prompt = this.buildImagePrompt(concept);

        // Generate image with DALL-E
        const imageUrl = await this.executeWithRetry(
          async () => await this.generateImage(imageOpenai, prompt, imageModel, config),
          `generate image for ${concept.chapter}`
        );

        if (!imageUrl) {
          throw new Error('Image generation returned no URL');
        }

        await progressTracker.log(
          `✅ Generated image URL: ${imageUrl.substring(0, 50)}...`,
          'success'
        );

        // Download image from temporary URL and save to disk
        const chapterNum = concept.chapterNumber || this.getChapterNumber(concept.chapter);

        // Get or initialize scene counter for this chapter
        const sceneNum = (sceneCounters.get(chapterNum) || 0) + 1;
        sceneCounters.set(chapterNum, sceneNum);

        const filename = `chapter_${chapterNum}_scene_${sceneNum}.png`;
        const filepath = join(outputDir, filename);

        await progressTracker.log(
          `Downloading image to ${filename}...`,
          'info'
        );

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.statusText}`);
        }

        const imageBuffer = await response.arrayBuffer();
        await writeFile(filepath, Buffer.from(imageBuffer));

        await progressTracker.log(
          `✅ Saved image to ${filename}`,
          'success'
        );

        // Update concept with local file path (relative to output dir)
        concept.imageUrl = `./${filename}`;
        generatedCount++;

        // Update state with local image path
        stateManager.updateChapter('illustrate', chapterNum, 'completed', {
          imageUrl: concept.imageUrl,
        });
        await stateManager.save();

      } catch (error: any) {
        await progressTracker.log(
          `Failed to generate image for ${concept.chapter}: ${error.message}`,
          'error'
        );
        // Continue with other images
      }
    }

    await progressTracker.log(`Generated ${generatedCount} images`, 'success');

    return { success: true, data: { generatedCount } };
  }

  /**
   * Load concepts from analyze phase state
   */
  private async loadConceptsFromState(state: any): Promise<void> {
    // Get concepts from analyze phase chapters
    const analyzeChapters = state.phases.analyze.chapters || {};

    // We need to reconstruct concepts from the state
    // For now, we'll just note that concepts should be stored better
    // TODO: Store full concept data in state, not just count

    // For testing, let's try to load from Chapters.md
    const { outputDir, progressTracker } = this.context;
    try {
      const chaptersPath = join(outputDir, 'Chapters.md');
      const chaptersContent = await readFile(chaptersPath, 'utf-8');
      this.concepts = this.parseChaptersFile(chaptersContent);
    } catch (error) {
      // Chapters.md doesn't exist yet
    }

    // Load elements from Elements.md for cross-referencing
    try {
      const elementsPath = join(outputDir, 'Elements.md');
      if (existsSync(elementsPath)) {
        const elementsContent = await readFile(elementsPath, 'utf-8');
        this.elements = this.parseElementsFile(elementsContent);
        await progressTracker.log(`Loaded ${this.elements.length} elements for cross-referencing`, 'info');
      }
    } catch (error) {
      // Elements.md doesn't exist, cross-referencing not available
    }
  }

  /**
   * Parse Chapters.md to extract concepts
   */
  private parseChaptersFile(content: string): ImageConcept[] {
    const concepts: ImageConcept[] = [];
    const chapterRegex = /### (.+?)\n\n#### Scene \d+\n\n\*\*Pages:\*\* (.+?)\n\n\*\*Source Text:\*\*\n> (.+?)\n\n\*\*Visual Elements:\*\* (.+?)\n/gs;

    // Get chapter number mapping from state TOC
    const state = this.context.stateManager.getState();
    const toc = state.toc?.chapters || [];
    const chapterTitleToNumber = new Map<string, number>();
    toc.forEach(ch => chapterTitleToNumber.set(ch.title, ch.number));

    let match;
    while ((match = chapterRegex.exec(content)) !== null) {
      const chapterTitle = match[1];
      concepts.push({
        chapter: chapterTitle,
        chapterNumber: chapterTitleToNumber.get(chapterTitle),
        pageRange: match[2],
        quote: match[3].replace(/\n> /g, ' '),
        description: match[4],
      });
    }

    return concepts;
  }

  /**
   * Parse Elements.md to extract element definitions
   */
  private parseElementsFile(content: string): BookElement[] {
    const elements: BookElement[] = [];

    // Match each element section (#### Name)
    const elementRegex = /#### (.+?)\n\n\*\*Description:\*\* (.+?)\n\n\*\*Reference Quotes:\*\*/gs;

    let match;
    while ((match = elementRegex.exec(content)) !== null) {
      const name = match[1];
      const description = match[2];

      // Determine type from section headers
      let type: BookElement['type'] = 'object';
      const beforeElement = content.substring(0, match.index);
      if (beforeElement.includes('### Characters') && !beforeElement.includes('### Creatures')) {
        type = 'character';
      } else if (beforeElement.includes('### Creatures')) {
        type = 'creature';
      } else if (beforeElement.includes('### Places')) {
        type = 'place';
      } else if (beforeElement.includes('### Items') || beforeElement.includes('### Objects')) {
        type = 'item';
      }

      elements.push({
        type,
        name,
        description,
        quotes: [], // We don't need quotes for cross-referencing prompts
      });
    }

    return elements;
  }

  /**
   * Build image prompt from concept with element cross-referencing and style guide
   */
  private buildImagePrompt(concept: ImageConcept): string {
    // Start with the visual description from the concept
    let prompt = concept.description;

    // Add element cross-references if available
    if (this.elements.length > 0) {
      const referencedElements: string[] = [];

      // Extract entity names mentioned in the description
      const mentionedEntities = this.extractEntityNames(concept.description, concept.quote);

      for (const entityName of mentionedEntities) {
        // Find matching element (fuzzy match)
        const element = this.findElement(entityName);
        if (element) {
          referencedElements.push(`${element.name}: ${element.description}`);
        }
      }

      // Append element descriptions to prompt
      if (referencedElements.length > 0) {
        prompt += '\n\nCharacter/creature details:\n' + referencedElements.join('\n');
      }
    }

    // Prepend style guide
    if (this.styleGuide) {
      prompt = `Style: ${this.styleGuide}\n\nScene: ${prompt}`;
    }

    // Add critical instruction about text
    prompt += '\n\nIMPORTANT: Do not include any text, letters, words, or writing in the image unless explicitly described in the scene.';

    return prompt;
  }

  /**
   * Extract entity names from description and quote
   */
  private extractEntityNames(description: string, quote: string): string[] {
    const entities = new Set<string>();

    // Common proper noun patterns and capitalized words
    const text = `${description} ${quote}`;

    // Extract capitalized words (potential entity names)
    const capitalizedWords = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];

    for (const word of capitalizedWords) {
      // Skip common non-entity words
      const skipWords = ['The', 'A', 'An', 'She', 'He', 'It', 'They', 'When', 'Where', 'What', 'How', 'Why'];
      if (!skipWords.includes(word)) {
        entities.add(word);
      }
    }

    return Array.from(entities);
  }

  /**
   * Find element by name (fuzzy matching)
   */
  private findElement(entityName: string): BookElement | undefined {
    // Exact match
    let element = this.elements.find(e => e.name === entityName);
    if (element) return element;

    // Case-insensitive match
    element = this.elements.find(e => e.name.toLowerCase() === entityName.toLowerCase());
    if (element) return element;

    // Partial match (entity name contains element name or vice versa)
    element = this.elements.find(e =>
      e.name.toLowerCase().includes(entityName.toLowerCase()) ||
      entityName.toLowerCase().includes(e.name.toLowerCase())
    );

    return element;
  }

  /**
   * Generate image using best available API
   * Supports: gpt-image-1, Gemini Imagen, dall-e-3
   */
  private async generateImage(
    imageOpenai: any,
    prompt: string,
    model: string | any,
    config: any
  ): Promise<string> {
    const size = config.imageSize || '1024x1024';
    const { progressTracker } = this.context;

    // Determine which model to use
    const imageModel = typeof model === 'string' ? model : model?.model || 'dall-e-3';

    // Try gpt-image-1 first (if configured)
    if (imageModel === 'gpt-image-1') {
      try {
        // gpt-image-1 quality: 'low', 'medium', 'high', 'auto'
        const qualityMap: Record<string, string> = {
          'standard': 'medium',
          'hd': 'high',
        };
        const quality = qualityMap[config.imageQuality || 'standard'] || 'high';

        const response = await imageOpenai.images.generate({
          model: 'gpt-image-1',
          prompt: prompt,
          n: 1,
          size: size,
          quality: quality,
        });

        const url = response.data?.[0]?.url;
        if (url) {
          await progressTracker.log('Using gpt-image-1', 'info');
          return url;
        }

        // No URL returned - fall back
        await progressTracker.log(
          'gpt-image-1 returned no URL, falling back to dall-e-3',
          'warning'
        );
      } catch (error: any) {
        await progressTracker.log(
          `gpt-image-1 failed (${error.message}), falling back to dall-e-3`,
          'warning'
        );
      }
    }

    // Try Gemini Imagen (if configured)
    if (imageModel.includes('imagen')) {
      try {
        const geminiApiKey = (config as any).geminiApiKey;
        if (!geminiApiKey) {
          await progressTracker.log(
            'Gemini API key not found, skipping Imagen',
            'warning'
          );
        } else {
          const url = await this.generateImagenImage(prompt, geminiApiKey);
          if (url) {
            await progressTracker.log(`Using Gemini ${imageModel}`, 'info');
            return url;
          }
        }
      } catch (error: any) {
        await progressTracker.log(
          `Gemini Imagen failed (${error.message}), falling back to dall-e-3`,
          'warning'
        );
      }
    }

    // Fallback to dall-e-3
    const quality = config.imageQuality || 'standard';

    const response = await imageOpenai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: size,
      quality: quality,
    });

    await progressTracker.log('Using dall-e-3', 'info');
    return response.data[0].url;
  }

  /**
   * Generate image using Google Gemini Imagen
   */
  private async generateImagenImage(prompt: string, apiKey: string): Promise<string> {
    const { progressTracker } = this.context;

    // Use Imagen via Google AI API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [
            {
              prompt: prompt,
            },
          ],
          parameters: {
            sampleCount: 1,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Imagen API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as any;

    // Extract base64 image and convert to URL
    if (data.predictions && data.predictions[0]?.bytesBase64Encoded) {
      const base64 = data.predictions[0].bytesBase64Encoded;
      return `data:image/png;base64,${base64}`;
    }

    throw new Error('No image data returned from Imagen');
  }

  /**
   * Extract chapter number from chapter title
   */
  private getChapterNumber(chapterTitle: string): number {
    // Try to extract number from title like "Chapter 10: Title"
    const match = chapterTitle.match(/^Chapter (\d+)/i);
    if (match) {
      return parseInt(match[1]);
    }
    // Default to 1 if no number found
    return 1;
  }

  /**
   * Sub-phase 5: Save image URLs to Chapters.md
   */
  protected async save(): Promise<SubPhaseResult> {
    const { outputDir, stateManager, progressTracker } = this.context;

    if (this.concepts.length === 0) {
      return { success: true };
    }

    // Group concepts by chapter for regeneration
    const conceptsByChapter = new Map<string, ImageConcept[]>();
    for (const concept of this.concepts) {
      if (!conceptsByChapter.has(concept.chapter)) {
        conceptsByChapter.set(concept.chapter, []);
      }
      conceptsByChapter.get(concept.chapter)!.push(concept);
    }

    // Regenerate Chapters.md with image URLs
    await progressTracker.log('Updating Chapters.md with image URLs...', 'info');

    const state = stateManager.getState();
    const metadata = {
      title: state.bookTitle,
      totalPages: state.totalPages,
    };

    await generateChaptersFile(outputDir, metadata, conceptsByChapter);

    await progressTracker.log('Chapters.md updated with image URLs', 'success');

    return { success: true };
  }
}
