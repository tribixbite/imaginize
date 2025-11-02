/**
 * Illustrate phase - Generate images for chapters and elements
 * Corresponds to --images flag
 */

import { BasePhase, type PhaseContext, type SubPhaseResult } from './base-phase.js';
import { resolveModelConfig } from '../token-counter.js';
import type { ImageConcept } from '../../types/config.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { generateChaptersFile } from '../output-generator.js';

export class IllustratePhase extends BasePhase {
  private concepts: ImageConcept[] = [];

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
        'Cannot generate images: Contents.md not found. Run: npx illustrate --text'
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
   * Sub-phase 3: Prepare
   */
  protected async prepare(): Promise<SubPhaseResult> {
    // Validate image endpoint is configured
    const { imageOpenai, progressTracker } = this.context;

    if (!imageOpenai) {
      await progressTracker.log(
        'Image generation not available (no endpoint configured)',
        'warning'
      );
      return { success: true, data: { skipImages: true } };
    }

    return { success: true };
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

    await progressTracker.log(`Generating images for ${this.concepts.length} concepts...`, 'info');

    const imageModel = config.imageEndpoint?.model || 'dall-e-3';
    let generatedCount = 0;

    for (const concept of this.concepts) {
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

        // Save URL to concept
        concept.imageUrl = imageUrl;
        generatedCount++;

        await progressTracker.log(
          `✅ Generated image: ${imageUrl.substring(0, 50)}...`,
          'success'
        );

        // Update state with image URL
        stateManager.updateChapter('illustrate', this.getChapterNumber(concept.chapter), 'completed', {
          imageUrl,
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
    const { outputDir } = this.context;
    try {
      const chaptersPath = join(outputDir, 'Chapters.md');
      const chaptersContent = await readFile(chaptersPath, 'utf-8');
      this.concepts = this.parseChaptersFile(chaptersContent);
    } catch (error) {
      // Chapters.md doesn't exist yet
    }
  }

  /**
   * Parse Chapters.md to extract concepts
   */
  private parseChaptersFile(content: string): ImageConcept[] {
    const concepts: ImageConcept[] = [];
    const chapterRegex = /### (.+?)\n\n#### Scene \d+\n\n\*\*Pages:\*\* (.+?)\n\n\*\*Source Text:\*\*\n> (.+?)\n\n\*\*Visual Elements:\*\* (.+?)\n/gs;

    let match;
    while ((match = chapterRegex.exec(content)) !== null) {
      concepts.push({
        chapter: match[1],
        pageRange: match[2],
        quote: match[3].replace(/\n> /g, ' '),
        description: match[4],
      });
    }

    return concepts;
  }

  /**
   * Build image prompt from concept
   * TODO: Cross-reference with Elements.md for character/place descriptions
   */
  private buildImagePrompt(concept: ImageConcept): string {
    // For now, use the description directly
    // TODO: Extract entity names and cross-reference Elements.md
    return concept.description;
  }

  /**
   * Generate image using DALL-E API
   */
  private async generateImage(
    imageOpenai: any,
    prompt: string,
    model: string | any,
    config: any
  ): Promise<string> {
    const modelName = typeof model === 'string' ? model : model.name;

    const response = await imageOpenai.images.generate({
      model: modelName,
      prompt: prompt,
      n: 1,
      size: config.imageSize || '1024x1024',
      quality: config.imageQuality || 'standard',
    });

    return response.data[0].url;
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
