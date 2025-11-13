/**
 * IllustratePhaseV2 - Manifest-driven concurrent image generation
 *
 * Instead of EventEmitter (in-memory, fragile), uses manifest polling.
 * Can start as soon as AnalyzePhaseV2 completes first chapter.
 *
 * Architecture:
 * 1. Wait for Elements.md ready (manifest.elements_md_status === 'complete')
 * 2. Poll manifest for chapters with status === 'analyzed'
 * 3. Atomically claim chapter → 'illustration_inprogress'
 * 4. Generate images with Elements.md enrichment
 * 5. Update → 'illustration_complete'
 * 6. Exit when analyze_complete && no pending chapters
 */

import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { BasePhase, type PhaseContext, type SubPhaseResult } from './base-phase.js';
import { resolveModelConfig } from '../token-counter.js';
import type { ImageConcept } from '../../types/config.js';
import { createManifestManager } from '../concurrent/manifest-manager.js';
import { createElementsLookup } from '../concurrent/elements-lookup.js';
import fetch from 'node-fetch';
import {
  type VisualStyleGuide,
  CharacterRegistry,
  analyzeStyleFromImages,
  enhanceImagePrompt,
  loadStyleGuide,
  saveStyleGuide,
  createCharacterRegistry,
  extractCharacterNames,
} from '../visual-style/index.js';
import { TemplateLoader, DEFAULT_ILLUSTRATE_TEMPLATE, type TemplateVariables } from '../templates/template-loader.js';

/**
 * Sleep helper for polling
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * IllustratePhaseV2 - Concurrent-ready manifest-driven illustration
 *
 * Key differences from v1:
 * - No EventEmitter dependency (polling instead)
 * - Waits for Elements.md before starting
 * - Atomically claims chapters from manifest
 * - Recovery logic for stuck/crashed chapters
 * - Elements.md enrichment for consistent visuals
 */
export class IllustratePhaseV2 extends BasePhase {
  private manifestManager: ReturnType<typeof createManifestManager>;
  private elementsLookup: ReturnType<typeof createElementsLookup>;
  private styleGuide: string = ''; // Legacy text-based style guide (fallback)
  private visualStyleGuide: VisualStyleGuide | null = null; // New: Visual style from image analysis
  private characterRegistry: CharacterRegistry | null = null; // New: Character appearance tracking
  private bootstrapImages: string[] = []; // New: First N images for style analysis
  private templateLoader: TemplateLoader;
  private pollInterval = 10000; // Poll every 10 seconds
  private stuckTimeout = 30 * 60 * 1000; // 30 minutes

  constructor(context: PhaseContext) {
    super(context, 'illustrate');

    this.manifestManager = createManifestManager(context.outputDir);
    this.elementsLookup = createElementsLookup(context.outputDir);
    this.templateLoader = new TemplateLoader();

    // Initialize character registry if tracking enabled
    if (context.config.trackCharacterAppearances !== false) {
      this.characterRegistry = createCharacterRegistry(context.outputDir);
    }
  }

  /**
   * Sub-phase 1: Plan - Wait for Elements.md
   */
  protected async plan(): Promise<SubPhaseResult> {
    const { progressTracker } = this.context;

    await progressTracker.log('Waiting for Elements.md to be ready...', 'info');

    // Wait for Elements.md with timeout
    try {
      await this.manifestManager.waitForElementsReady(5000, 30 * 60 * 1000);
      await progressTracker.log('✅ Elements.md ready', 'success');
    } catch (error: any) {
      await progressTracker.log(
        `⚠️  Elements.md timeout - proceeding without enrichment: ${error.message}`,
        'warning'
      );
    }

    return { success: true };
  }

  /**
   * Sub-phase 2: Prepare - Load Elements.md and generate style guide
   */
  protected async prepare(): Promise<SubPhaseResult> {
    const { imageOpenai, progressTracker, chapters, stateManager, config, outputDir } = this.context;

    if (!imageOpenai) {
      await progressTracker.log(
        'Image generation not available (no endpoint configured)',
        'warning'
      );
      return { success: true, data: { skipImages: true } };
    }

    // Load Elements.md for enrichment
    const loaded = await this.elementsLookup.load();

    if (loaded) {
      await progressTracker.log(
        `Loaded ${this.elementsLookup.getCount()} entities for prompt enrichment`,
        'success'
      );
    } else {
      await progressTracker.log(
        'Elements.md not found - proceeding without entity enrichment',
        'warning'
      );
    }

    // Try loading existing visual style guide (from previous run or bootstrap)
    if (config.enableStyleConsistency !== false) {
      try {
        this.visualStyleGuide = await loadStyleGuide(outputDir);
        if (this.visualStyleGuide) {
          await progressTracker.log(
            `Loaded existing visual style guide (consistency: ${(this.visualStyleGuide.consistencyScore * 100).toFixed(0)}%)`,
            'success'
          );
        }
      } catch {
        // No existing style guide - will be created during bootstrap phase
      }
    }

    // Generate text-based style guide (legacy fallback)
    await progressTracker.log('Generating book-wide visual style guide...', 'info');
    this.styleGuide = await this.generateStyleGuide(chapters, stateManager);
    await progressTracker.log(`Style guide created: "${this.styleGuide}"`, 'success');

    return { success: true };
  }

  /**
   * Generate visual style guide (same as v1)
   */
  private async generateStyleGuide(chapters: any[], stateManager: any): Promise<string> {
    const { openai } = this.context;

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
   * Sub-phase 3: Not used
   */
  protected async estimate(): Promise<SubPhaseResult> {
    return { success: true };
  }

  /**
   * Sub-phase 4: Execute - Manifest polling loop
   */
  protected async executePhase(): Promise<SubPhaseResult> {
    const { progressTracker, imageOpenai, config } = this.context;

    if (!imageOpenai) {
      await progressTracker.log('No image generation endpoint configured', 'warning');
      return { success: true };
    }

    await progressTracker.log('Starting manifest-driven illustration polling...', 'info');

    // Recovery: Reset stuck chapters
    await this.recoverStuckChapters();

    // Main polling loop
    let processedCount = 0;

    while (true) {
      // Load manifest
      const manifest = await this.manifestManager.load();

      // Find chapters ready to illustrate (status === 'analyzed')
      const readyChapters = Object.entries(manifest.chapters)
        .filter(([_, ch]) => ch.status === 'analyzed')
        .map(([num, _]) => parseInt(num))
        .sort((a, b) => a - b);

      if (readyChapters.length === 0) {
        // No chapters ready - check if we're done
        if (manifest.analyze_complete) {
          await progressTracker.log(
            `✅ All chapters processed. Generated images for ${processedCount} chapters.`,
            'success'
          );
          break;
        }

        // Analyze still running - wait and retry
        await progressTracker.log(
          `No chapters ready. Waiting ${this.pollInterval / 1000}s...`,
          'info'
        );
        await sleep(this.pollInterval);
        continue;
      }

      // Process first ready chapter
      const chapterNum = readyChapters[0];

      await progressTracker.log(
        `Found ${readyChapters.length} ready chapters. Processing chapter ${chapterNum}...`,
        'info'
      );

      try {
        await this.processChapter(chapterNum);
        processedCount++;
      } catch (error: any) {
        await progressTracker.log(
          `Error processing chapter ${chapterNum}: ${error.message}`,
          'error'
        );

        // Mark chapter as error
        await this.manifestManager.updateChapter(chapterNum, 'error', {
          error: error.message,
        });
      }
    }

    // Mark illustrate complete
    await this.manifestManager.markIllustrateComplete();

    return { success: true };
  }

  /**
   * Process single chapter atomically
   */
  private async processChapter(chapterNum: number): Promise<void> {
    const { chapters, imageOpenai, config, outputDir, stateManager, progressTracker } = this.context;

    // Atomically claim chapter
    await this.manifestManager.updateChapter(chapterNum, 'illustration_inprogress');

    await progressTracker.log(`🎨 Starting illustration for chapter ${chapterNum}`, 'info');

    // Find chapter data
    const chapter = chapters.find(c => c.chapterNumber === chapterNum);
    if (!chapter) {
      throw new Error(`Chapter ${chapterNum} not found in chapter list`);
    }

    // Load concepts from Chapters.md (generated by AnalyzePhaseV2)
    await progressTracker.log(
      `Looking for concepts in chapter ${chapterNum}: "${chapter.chapterTitle}"`,
      'info'
    );
    const concepts = await this.loadConceptsForChapter(chapterNum, chapter.chapterTitle);

    if (concepts.length === 0) {
      await progressTracker.log(
        `No concepts found for chapter ${chapterNum}: "${chapter.chapterTitle}" - skipping`,
        'warning'
      );

      // Mark as complete even though no images (front matter, etc.)
      await this.manifestManager.updateChapter(chapterNum, 'illustration_complete', {
        illustrated_at: new Date().toISOString(),
      });
      return;
    }

    // Generate images for all concepts in this chapter
    // Use model string directly for image generation (don't resolve it)
    const imageModelValue = config.imageEndpoint?.model || 'dall-e-3';
    const imageModel = typeof imageModelValue === 'string' ? imageModelValue : imageModelValue.name;

    for (let sceneNum = 0; sceneNum < concepts.length; sceneNum++) {
      const concept = concepts[sceneNum];

      await progressTracker.log(
        `Generating image ${sceneNum + 1}/${concepts.length} for chapter ${chapterNum}`,
        'info'
      );

      // Build enriched prompt
      const prompt = await this.buildEnrichedPrompt(concept);

      // Generate image
      const imageUrl = await this.executeWithRetry(
        async () => await this.generateImage(imageOpenai, prompt, imageModel, config),
        `generate image for chapter ${chapterNum} scene ${sceneNum + 1}`
      );

      if (!imageUrl) {
        throw new Error('Image generation returned no URL');
      }

      // Download and save
      // Sanitize chapter title for filename (lowercase, replace spaces with underscores, remove special chars)
      const sanitizedTitle = chapter.chapterTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50); // Limit length
      const filename = `chapter_${chapterNum}_${sanitizedTitle}_scene_${sceneNum + 1}.png`;
      const filepath = join(outputDir, filename);

      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const imageBuffer = await response.arrayBuffer();
      await writeFile(filepath, Buffer.from(imageBuffer));

      await progressTracker.log(`✅ Saved: ${filename}`, 'success');

      // Add to bootstrap collection (if still collecting)
      if (this.bootstrapImages.length < (config.styleBootstrapCount || 3)) {
        this.bootstrapImages.push(filepath);
        await this.checkBootstrapPhase();
      }

      // Register character appearances
      if (config.trackCharacterAppearances !== false && this.characterRegistry) {
        await this.registerCharacterAppearances(concept, filepath);
      }

      // Update state manager (old system)
      stateManager.updateChapter('illustrate', chapterNum, 'completed', {
        imageUrl: `./${filename}`,
      });
      await stateManager.save();
    }

    // Mark chapter as illustrated in manifest
    await this.manifestManager.updateChapter(chapterNum, 'illustration_complete', {
      illustrated_at: new Date().toISOString(),
    });

    await progressTracker.log(
      `✅ Chapter ${chapterNum} complete - ${concepts.length} images generated`,
      'success'
    );
  }

  /**
   * Load concepts for specific chapter from Chapters.md
   */
  private async loadConceptsForChapter(chapterNum: number, chapterTitle: string): Promise<ImageConcept[]> {
    const { outputDir } = this.context;
    const chaptersPath = join(outputDir, 'Chapters.md');

    if (!existsSync(chaptersPath)) {
      return [];
    }

    // Parse Chapters.md to find concepts for this chapter
    // Format: ### Title
    //         #### Scene 1
    //         **Visual Elements:** ...
    const content = await readFile(chaptersPath, 'utf-8');
    const lines = content.split('\n');

    const concepts: ImageConcept[] = [];
    let inTargetChapter = false;
    let currentDescription = '';

    for (const line of lines) {
      // Check for chapter header (h3)
      if (line.startsWith('### ')) {
        // Reset state
        inTargetChapter = false;
        currentDescription = '';

        // Check if this is our target chapter by matching title
        const headerTitle = line.replace('### ', '').trim();
        if (headerTitle === chapterTitle) {
          inTargetChapter = true;
        }
      } else if (inTargetChapter) {
        // Inside target chapter - look for visual elements
        if (line.startsWith('**Visual Elements:**')) {
          currentDescription = line.replace('**Visual Elements:**', '').trim();
          if (currentDescription) {
            concepts.push({
              description: currentDescription,
              quote: '', // Not needed for image generation
              reasoning: '',
              chapter: chapterTitle,
              chapterNumber: chapterNum,
              pageRange: '',
            });
          }
        }
      }
    }

    return concepts;
  }

  /**
   * Build enriched prompt with Elements.md, style guide, and custom templates
   */
  private async buildEnrichedPrompt(concept: ImageConcept): Promise<string> {
    const { config } = this.context;

    // Use new visual style system if available
    if (this.visualStyleGuide || this.characterRegistry) {
      const enhanced = enhanceImagePrompt(
        concept,
        this.visualStyleGuide,
        this.characterRegistry
      );

      let prompt = enhanced.fullPrompt;

      // Enrich with Elements.md if available
      if (this.elementsLookup.isLoaded()) {
        prompt = this.elementsLookup.enrichPrompt(prompt);
      }

      return prompt;
    }

    // Load illustrate template (custom or preset or default)
    let illustrateTemplate = DEFAULT_ILLUSTRATE_TEMPLATE;

    if (config.customTemplates?.enabled) {
      if (config.customTemplates.preset) {
        // Use preset template
        try {
          const preset = this.templateLoader.loadPreset(config.customTemplates.preset);
          illustrateTemplate = preset.illustrate;
        } catch (error) {
          // Fall back to default on error
        }
      } else if (config.customTemplates.illustrateTemplate) {
        // Use custom template file
        const templatePath = config.customTemplates.templatesDir
          ? join(config.customTemplates.templatesDir, config.customTemplates.illustrateTemplate)
          : config.customTemplates.illustrateTemplate;

        illustrateTemplate = await this.templateLoader.loadTemplate(
          templatePath,
          DEFAULT_ILLUSTRATE_TEMPLATE
        );
      }
    }

    // Build template variables
    const templateVars: TemplateVariables = {
      description: concept.description,
      style: (config as any).style || this.styleGuide,
    };

    // Add character enrichment from Elements.md if available
    if (this.elementsLookup.isLoaded()) {
      const mentions = this.elementsLookup.findMentions(concept.description);
      if (mentions.length > 0) {
        const charactersList = mentions
          .map(entity => `${entity.name} (${entity.type}): ${entity.description}`)
          .join('\n');
        templateVars.characters = charactersList;
      }
    }

    // Render template with variables
    let prompt = this.templateLoader.renderTemplate(illustrateTemplate, templateVars);

    // Additional enrichment with Elements.md
    if (this.elementsLookup.isLoaded()) {
      prompt = this.elementsLookup.enrichPrompt(prompt);
    }

    return prompt;
  }

  /**
   * Generate image using OpenAI API (same as v1)
   */
  private async generateImage(
    imageOpenai: any,
    prompt: string,
    model: string,
    config: any
  ): Promise<string> {
    // Check if using Gemini image generation (only models with "gemini" in the name)
    const isGemini = model.toLowerCase().includes('gemini');

    // Debug: log the model being used
    await this.context.progressTracker.log(`Image model: "${model}" (isGemini: ${isGemini})`, 'info');

    if (isGemini) {
      // Gemini 2.5 Flash Image via OpenRouter
      const response = await imageOpenai.chat.completions.create({
        model,
        messages: [{
          role: 'user',
          content: prompt
        }],
        modalities: ['image', 'text'],
        temperature: config.imageEndpoint?.temperature || 1.5,
        max_tokens: config.imageEndpoint?.maxTokens || 8000,
        ...(config.imageEndpoint?.aspectRatio && {
          image_config: {
            aspect_ratio: config.imageEndpoint.aspectRatio
          }
        })
      });

      // Check multiple possible response formats
      const imageUrl = response.choices[0]?.message?.images?.[0]?.image_url?.url ||
                      response.choices[0]?.message?.image_url ||
                      response.data?.[0]?.url;

      if (!imageUrl) {
        // Log the actual response for debugging
        await this.context.progressTracker.log(
          `Gemini response format: ${JSON.stringify(response.choices[0]?.message).substring(0, 200)}`,
          'info'
        );
        throw new Error('Gemini image generation returned no image URL');
      }

      return imageUrl;
    } else {
      // DALL-E 3
      const response = await imageOpenai.images.generate({
        model,
        prompt,
        n: 1,
        size: config.imageEndpoint?.size || '1024x1024',
        quality: config.imageEndpoint?.quality || 'standard',
      });

      return response.data[0].url!;
    }
  }

  /**
   * Check if we should run bootstrap phase (after first N images)
   */
  private async checkBootstrapPhase(): Promise<void> {
    const { config } = this.context;
    const bootstrapCount = config.styleBootstrapCount || 3;

    // Check if we have enough images for bootstrap
    if (this.bootstrapImages.length === bootstrapCount && !this.visualStyleGuide) {
      await this.performBootstrap();
    }
  }

  /**
   * Perform bootstrap: Analyze first N images to extract visual style
   */
  private async performBootstrap(): Promise<void> {
    const { openai, progressTracker, outputDir, config } = this.context;

    if (config.enableStyleConsistency === false) {
      return;
    }

    await progressTracker.log(
      `Bootstrap phase: Analyzing first ${this.bootstrapImages.length} images for style guide...`,
      'info'
    );

    try {
      this.visualStyleGuide = await analyzeStyleFromImages(
        this.bootstrapImages,
        openai,
        async (msg) => await progressTracker.log(msg, 'info')
      );

      await saveStyleGuide(outputDir, this.visualStyleGuide);
      await progressTracker.log(
        `✅ Style guide created (consistency: ${(this.visualStyleGuide.consistencyScore * 100).toFixed(0)}%)`,
        'success'
      );
    } catch (error: any) {
      await progressTracker.log(
        `⚠️  Style analysis failed: ${error.message} - continuing with text-based style guide`,
        'warning'
      );
    }
  }

  /**
   * Register character appearances after image generation
   */
  private async registerCharacterAppearances(
    concept: ImageConcept,
    imagePath: string
  ): Promise<void> {
    if (!this.characterRegistry) {
      return;
    }

    const { progressTracker } = this.context;

    // Extract character names from description
    const charactersInScene = extractCharacterNames(concept.description);

    if (charactersInScene.length === 0) {
      return;
    }

    for (const charName of charactersInScene) {
      try {
        if (!this.characterRegistry.hasCharacter(charName)) {
          // First appearance - register with description from Elements.md
          const description = this.getCharacterDescriptionFromElements(charName);
          if (description) {
            await this.characterRegistry.registerFirstAppearance(
              charName,
              concept.chapterNumber || 1,
              1, // scene number (simplified)
              imagePath,
              description
            );

            await progressTracker.log(
              `Registered first appearance: ${charName}`,
              'info'
            );
          }
        } else {
          // Subsequent appearance - record
          await this.characterRegistry.recordAppearance(
            charName,
            concept.chapterNumber || 1,
            1, // scene number (simplified)
            imagePath
          );
        }
      } catch (error: any) {
        // Non-fatal - continue with image generation
        await progressTracker.log(
          `Character registration failed for ${charName}: ${error.message}`,
          'warning'
        );
      }
    }

    // Save registry after updates
    await this.characterRegistry.save();
  }

  /**
   * Get character description from Elements.md
   */
  private getCharacterDescriptionFromElements(characterName: string): string | null {
    if (!this.elementsLookup.isLoaded()) {
      return null;
    }

    // Try exact lookup first (case-insensitive)
    const exactMatch = this.elementsLookup.lookup(characterName);
    if (exactMatch) {
      return exactMatch.description || null;
    }

    // Look for partial match in character entities
    const allCharacters = this.elementsLookup.getElementsByType('character');
    for (const character of allCharacters) {
      // Check if character name contains our search term
      // e.g., "Christopher" matches "Christopher Chant"
      if (character.name.toLowerCase().includes(characterName.toLowerCase())) {
        return character.description || null;
      }
    }

    return null;
  }

  /**
   * Recover stuck chapters (in progress > 30 min)
   */
  private async recoverStuckChapters(): Promise<void> {
    const { progressTracker } = this.context;
    const manifest = await this.manifestManager.load();

    const now = Date.now();
    let recoveredCount = 0;

    for (const [chapterNum, chapterState] of Object.entries(manifest.chapters)) {
      if (chapterState.status === 'illustration_inprogress') {
        // Check timestamp
        const analyzedAt = chapterState.analyzed_at ? new Date(chapterState.analyzed_at).getTime() : 0;
        const elapsed = now - analyzedAt;

        if (elapsed > this.stuckTimeout) {
          await progressTracker.log(
            `Recovering stuck chapter ${chapterNum} (in progress for ${Math.round(elapsed / 60000)}min)`,
            'warning'
          );

          // Reset to analyzed state
          await this.manifestManager.updateChapter(parseInt(chapterNum), 'analyzed');
          recoveredCount++;
        }
      }
    }

    if (recoveredCount > 0) {
      await progressTracker.log(
        `Recovered ${recoveredCount} stuck chapters`,
        'success'
      );
    }
  }

  /**
   * Sub-phase 5: Save - Not needed (incremental updates)
   */
  protected async save(): Promise<SubPhaseResult> {
    return { success: true };
  }
}
