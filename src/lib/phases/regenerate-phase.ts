/**
 * Regenerate Phase - Scene-level image regeneration
 *
 * Regenerates specific images without re-running the analyze phase.
 * Uses existing Chapters.md concepts and Elements.md enrichment.
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';
import OpenAI from 'openai';
import type { IllustrateConfig, ImageConcept } from '../../types/config.js';
import { createElementsLookup } from '../concurrent/elements-lookup.js';
import type { SceneIdentifier } from '../regenerate.js';
import fetch from 'node-fetch';

export interface RegenerateContext {
  outputDir: string;
  config: IllustrateConfig;
  imageOpenai: OpenAI;
  scenes: SceneIdentifier[];
}

export class RegeneratePhase {
  private context: RegenerateContext;
  private elementsLookup: ReturnType<typeof createElementsLookup>;

  constructor(context: RegenerateContext) {
    this.context = context;
    this.elementsLookup = createElementsLookup(context.outputDir);
  }

  /**
   * Execute regeneration for all selected scenes
   */
  async execute(): Promise<{ generated: number; failed: number }> {
    const { scenes, config, imageOpenai, outputDir } = this.context;

    console.log(`\n🎨 Regenerating ${scenes.length} scene(s)...\n`);

    // Load Elements.md for enrichment
    await this.elementsLookup.load();

    let generated = 0;
    let failed = 0;

    for (const scene of scenes) {
      try {
        console.log(
          `  Generating: Chapter ${scene.chapterNumber}, Scene ${scene.sceneNumber}`
        );
        console.log(`  ${scene.concept.description.substring(0, 60)}...`);

        // Build enriched prompt
        const prompt = await this.buildEnrichedPrompt(scene.concept);

        // Generate image
        const imageModelValue = config.imageEndpoint?.model || 'dall-e-3';
        const imageModel =
          typeof imageModelValue === 'string' ? imageModelValue : imageModelValue.name;

        const response = await imageOpenai.images.generate({
          model: imageModel,
          prompt,
          n: 1,
          size: config.imageSize || '1024x1024',
          quality: config.imageQuality || 'standard',
          response_format: 'url',
        });

        if (!response.data || response.data.length === 0) {
          throw new Error('No image data returned from API');
        }

        const imageUrl = response.data[0]?.url;
        if (!imageUrl) {
          throw new Error('No image URL returned from API');
        }

        // Download and save image
        const sanitizedTitle = scene.chapterTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 50);

        const filename = `chapter_${scene.chapterNumber}_${sanitizedTitle}_scene_${scene.sceneNumber}.png`;
        const filepath = join(outputDir, filename);

        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: ${imageResponse.statusText}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        await writeFile(filepath, Buffer.from(imageBuffer));

        console.log(`  ✅ Saved: ${filename}\n`);
        generated++;
      } catch (error: any) {
        console.error(`  ❌ Failed: ${error.message}\n`);
        failed++;
      }
    }

    return { generated, failed };
  }

  /**
   * Build enriched prompt with Elements.md context
   */
  private async buildEnrichedPrompt(concept: ImageConcept): Promise<string> {
    let prompt = concept.description;

    // Enrich with Elements.md if available
    if (this.elementsLookup.isLoaded()) {
      const mentions = this.elementsLookup.findMentions(concept.description);

      if (mentions.length > 0) {
        prompt += '\n\nCHARACTER DETAILS:';

        for (const entity of mentions) {
          prompt += `\n- ${entity.name} (${entity.type}): ${entity.description}`;
        }
      }

      // Apply full enrichment
      prompt = this.elementsLookup.enrichPrompt(prompt);
    }

    return prompt;
  }
}
