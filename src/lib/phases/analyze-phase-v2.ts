/**
 * AnalyzePhaseV2 - Two-pass analyze with Elements.md coordination
 *
 * Pass 1: Fast entity extraction from all chapters
 * Pass 2: Full chapter analysis with Elements.md enrichment
 *
 * This enables concurrent processing - illustrate can start as soon as
 * first chapter completes Pass 2.
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { BasePhase, type PhaseContext, type SubPhaseResult } from './base-phase.js';
import type { ImageConcept, ChapterContent } from '../../types/config.js';
import { estimateTokens, createTokenEstimate, resolveModelConfig } from '../token-counter.js';
import { generateChaptersFile } from '../output-generator.js';
import { isStoryContent } from '../provider-utils.js';
import {
  extractEntitiesFast,
  mergeEntityResults,
  generateElementsMarkdown,
  type EntityExtractionResult,
} from '../concurrent/entity-extractor.js';
import { createManifestManager } from '../concurrent/manifest-manager.js';
import { createElementsLookup } from '../concurrent/elements-lookup.js';
import { createElementsMemory } from '../concurrent/elements-memory.js';
import { TemplateLoader, DEFAULT_ANALYZE_TEMPLATE, type TemplateVariables } from '../templates/template-loader.js';

interface AnalyzePlanData {
  chaptersToProcess: number[];
  totalEstimatedTokens: number;
  estimatedCost: number;
  requiresSplitting: boolean;
}

/**
 * AnalyzePhaseV2 - Concurrent-ready two-pass analysis
 *
 * Architecture:
 * 1. Plan: Determine chapters to process
 * 2. Pass 1: Fast entity extraction → Elements.md
 * 3. Pass 2: Full analysis with enrichment
 * 4. Save: Generate Chapters.md
 *
 * Manifest coordination:
 * - Updates elements_md_status to 'complete' after Pass 1
 * - Updates per-chapter status after each chapter in Pass 2
 * - Enables IllustratePhaseV2 to start as soon as first chapter analyzed
 */
export class AnalyzePhaseV2 extends BasePhase {
  private planData?: AnalyzePlanData;
  private conceptsByChapter: Map<string, ImageConcept[]> = new Map();
  private manifestManager: ReturnType<typeof createManifestManager>;
  private elementsLookup: ReturnType<typeof createElementsLookup>;
  private elementsMemory: ReturnType<typeof createElementsMemory>;
  private templateLoader: TemplateLoader;

  constructor(context: PhaseContext) {
    super(context, 'analyze');

    // Initialize manifest manager for concurrent coordination
    this.manifestManager = createManifestManager(context.outputDir);

    // Initialize elements lookup for Pass 2 enrichment
    this.elementsLookup = createElementsLookup(context.outputDir);

    // Initialize elements memory for progressive enrichment
    this.elementsMemory = createElementsMemory(context.outputDir);

    // Initialize template loader
    this.templateLoader = new TemplateLoader();
  }

  /**
   * Sub-phase 1: Plan which chapters to process
   */
  protected async plan(): Promise<SubPhaseResult> {
    const { stateManager, chapters, config, progressTracker } = this.context;

    await progressTracker.log('Planning two-pass analysis...', 'info');

    // Initialize manifest with all chapters
    const chapterNumbers = chapters.map(c => c.chapterNumber);
    await this.manifestManager.initialize(
      stateManager.getState().bookTitle,
      chapterNumbers
    );

    // Determine which chapters need processing
    const chaptersToProcess = chapters
      .map(c => c.chapterNumber)
      .filter(num => this.shouldProcessChapter(num));

    if (chaptersToProcess.length === 0) {
      await progressTracker.log('All chapters already analyzed', 'info');
      return { success: true, data: { chaptersToProcess: [] } };
    }

    // Estimate total tokens needed
    let totalEstimatedTokens = 0;
    let estimatedCost = 0;

    const modelConfig = resolveModelConfig(config.model, config);

    for (const chapterNum of chaptersToProcess) {
      const chapter = chapters.find(c => c.chapterNumber === chapterNum)!;
      const estimate = createTokenEstimate(
        chapter.content,
        1000,
        modelConfig,
        config.tokenSafetyMargin
      );

      totalEstimatedTokens += estimate.totalTokens;
      estimatedCost += estimate.estimatedCost;
      chapter.tokenCount = estimate.inputTokens;
    }

    this.planData = {
      chaptersToProcess,
      totalEstimatedTokens,
      estimatedCost,
      requiresSplitting: false, // V2 uses splitting in base phase
    };

    await progressTracker.log(
      `Two-pass plan: ${chaptersToProcess.length} chapters, ~${totalEstimatedTokens.toLocaleString()} tokens, $${estimatedCost.toFixed(4)}`,
      'info'
    );

    return { success: true, data: this.planData };
  }

  /**
   * Sub-phase 2: Not used in V2
   */
  protected async estimate(): Promise<SubPhaseResult> {
    return { success: true };
  }

  /**
   * Sub-phase 3: Not used in V2
   */
  protected async prepare(): Promise<SubPhaseResult> {
    return { success: true };
  }

  /**
   * Sub-phase 4: Execute two-pass analysis
   */
  protected async executePhase(): Promise<SubPhaseResult> {
    if (!this.planData || this.planData.chaptersToProcess.length === 0) {
      return { success: true };
    }

    // PASS 1: Fast entity extraction
    await this.executePass1();

    // PASS 2: Full analysis with enrichment
    await this.executePass2();

    return { success: true };
  }

  /**
   * PASS 1: Fast entity extraction from all chapters
   *
   * Goal: Build Elements.md as quickly as possible
   * Strategy: Use fast model (gpt-4o-mini) with minimal prompts
   * Performance: Process chapters in parallel batches (respecting rate limits)
   */
  private async executePass1(): Promise<void> {
    const { chapters, openai, progressTracker, config } = this.context;

    const startTime = Date.now();
    await progressTracker.log('PASS 1: Extracting entities from all chapters...', 'info');

    // Update manifest status
    await this.manifestManager.updateElementsStatus('inprogress');

    // Determine batch size based on rate limits
    // gpt-4o-mini is fast and cheap, can handle higher concurrency
    // For OpenRouter free tier (1 req/min), use batch size 1
    // For paid tiers or OpenAI, use configured maxConcurrency (default: 3)
    const modelStr = typeof config.model === 'string' ? config.model : config.model?.name || '';
    const isFreeModel = modelStr.includes('free');
    const batchSize = isFreeModel ? 1 : (config.maxConcurrency || 3);

    const chaptersToProcess = this.planData!.chaptersToProcess.filter(num => {
      const chapter = chapters.find(c => c.chapterNumber === num)!;
      return isStoryContent(chapter.chapterTitle);
    });

    await progressTracker.log(
      `Processing ${chaptersToProcess.length} chapters in batches of ${batchSize}`,
      'info'
    );

    const entityResults: EntityExtractionResult[] = [];

    // Process chapters in parallel batches
    for (let i = 0; i < chaptersToProcess.length; i += batchSize) {
      const batchNums = chaptersToProcess.slice(i, Math.min(i + batchSize, chaptersToProcess.length));
      const batchChapters = batchNums.map(num => chapters.find(c => c.chapterNumber === num)!);

      await progressTracker.log(
        `Pass 1: Processing batch ${Math.floor(i / batchSize) + 1}: chapters ${batchNums.join(', ')}`,
        'info'
      );

      // Process batch in parallel
      const batchResults = await Promise.all(
        batchChapters.map(async chapter => {
          await progressTracker.log(
            `Pass 1: Extracting entities from Chapter ${chapter.chapterNumber}: ${chapter.chapterTitle}`,
            'info'
          );

          try {
            const result = await this.executeWithRetry(
              async () =>
                await extractEntitiesFast(
                  chapter.content,
                  chapter.chapterNumber,
                  chapter.chapterTitle,
                  openai,
                  'gpt-4o-mini' // Fast, cheap model for entity extraction
                ),
              `extract entities from chapter ${chapter.chapterNumber}`
            );

            await progressTracker.log(
              `Pass 1: Found ${result.entities.length} entities in Chapter ${chapter.chapterNumber}`,
              'success'
            );

            return result;
          } catch (error: any) {
            await progressTracker.log(
              `Pass 1: Failed to extract entities from Chapter ${chapter.chapterNumber}: ${error.message}`,
              'warning'
            );
            return null;
          }
        })
      );

      // Collect successful results
      entityResults.push(...batchResults.filter(r => r !== null) as EntityExtractionResult[]);

      // Add delay between batches to respect rate limits (if not last batch)
      if (i + batchSize < chaptersToProcess.length) {
        const delayMs = isFreeModel ? 60000 : 2000; // 1 min for free tier, 2s for paid
        await progressTracker.log(`Waiting ${delayMs / 1000}s before next batch...`, 'info');
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Merge and deduplicate entities
    const mergedEntities = mergeEntityResults(entityResults);

    await progressTracker.log(
      `Pass 1: Total ${mergedEntities.length} unique entities extracted`,
      'success'
    );

    // Generate Elements.md
    const markdown = generateElementsMarkdown(
      mergedEntities,
      this.context.stateManager.getState().bookTitle
    );

    const elementsPath = join(this.context.outputDir, 'Elements.md');
    await writeFile(elementsPath, markdown);

    await progressTracker.log('Pass 1: Elements.md generated', 'success');

    // Update manifest: Elements.md is now complete
    await this.manifestManager.updateElementsStatus('complete');

    // Calculate and log performance metrics
    const endTime = Date.now();
    const totalSeconds = (endTime - startTime) / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);

    await progressTracker.log(
      `✅ Pass 1 complete - Elements.md ready (${mergedEntities.length} entities extracted in ${minutes}m ${seconds}s)`,
      'success'
    );
  }

  /**
   * PASS 2: Full chapter analysis with Elements.md enrichment
   *
   * Goal: Analyze each chapter fully with entity context
   * Strategy: Load Elements.md, enrich prompts with entity details
   * Performance: Process chapters in parallel batches (respecting rate limits)
   */
  private async executePass2(): Promise<void> {
    const { chapters, config, progressTracker } = this.context;

    const startTime = Date.now();
    await progressTracker.log('PASS 2: Full analysis with Elements.md enrichment...', 'info');

    // Load Elements.md for enrichment
    await this.elementsLookup.load();

    if (!this.elementsLookup.isLoaded()) {
      await progressTracker.log(
        'Warning: Elements.md not loaded - proceeding without enrichment',
        'warning'
      );
    } else {
      await progressTracker.log(
        `Loaded ${this.elementsLookup.getCount()} entities for prompt enrichment`,
        'success'
      );
    }

    // Initialize memory system for progressive enrichment
    await this.elementsMemory.load();
    const memoryStats = this.elementsMemory.getStats();
    await progressTracker.log(
      `🧠 Memory: Initialized with ${memoryStats.totalEntities} entities (${memoryStats.totalEnrichments} enrichments)`,
      'info'
    );

    const modelConfig = resolveModelConfig(config.model, config);
    const chaptersToProcess = this.planData!.chaptersToProcess;

    // Determine batch size based on rate limits
    // For OpenRouter free tier (1 req/min), use batch size 1
    // For paid tiers or OpenAI, use configured maxConcurrency (default: 3)
    const modelStr = typeof config.model === 'string' ? config.model : config.model?.name || '';
    const isFreeModel = modelStr.includes('free');
    const batchSize = isFreeModel ? 1 : (config.maxConcurrency || 3);

    await progressTracker.log(
      `Pass 2: Processing ${chaptersToProcess.length} chapters in batches of ${batchSize}`,
      'info'
    );

    // Process chapters in parallel batches
    for (let i = 0; i < chaptersToProcess.length; i += batchSize) {
      const batchNums = chaptersToProcess.slice(i, Math.min(i + batchSize, chaptersToProcess.length));
      const batchChapters = batchNums.map(num => chapters.find(c => c.chapterNumber === num)!);

      await progressTracker.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}: chapters ${batchNums.join(', ')}`,
        'info'
      );

      // Process batch in parallel
      await Promise.all(
        batchChapters.map(chapter => this.analyzeChapterWithTracking(chapter, modelConfig))
      );

      // Add delay between batches to respect rate limits (if not last batch)
      if (i + batchSize < chaptersToProcess.length) {
        const delayMs = isFreeModel ? 60000 : 2000; // 1 min for free tier, 2s for paid
        await progressTracker.log(`Pass 2: Waiting ${delayMs / 1000}s before next batch...`, 'info');
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Mark analyze phase as complete
    await this.manifestManager.markAnalyzeComplete();

    // Calculate and log performance metrics
    const endTime = Date.now();
    const totalSeconds = (endTime - startTime) / 1000;
    const avgSecondsPerChapter = totalSeconds / chaptersToProcess.length;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);

    // Log memory enrichment summary
    const finalMemoryStats = this.elementsMemory.getStats();
    if (finalMemoryStats.totalEnrichments > 0) {
      await progressTracker.log(
        `🧠 Memory: Enriched ${finalMemoryStats.entitiesWithEnrichments}/${finalMemoryStats.totalEntities} entities with ${finalMemoryStats.totalEnrichments} new detail(s)`,
        'success'
      );
    }

    await progressTracker.log(
      `✅ Pass 2 complete - ${chaptersToProcess.length} chapters analyzed in ${minutes}m ${seconds}s (avg ${avgSecondsPerChapter.toFixed(1)}s/chapter, batch size: ${batchSize})`,
      'success'
    );
  }

  /**
   * Analyze single chapter with full progress tracking and error handling
   */
  private async analyzeChapterWithTracking(
    chapter: ChapterContent,
    modelConfig: any
  ): Promise<void> {
    const { stateManager, progressTracker } = this.context;
    const chapterNum = chapter.chapterNumber;

    await progressTracker.startChapter(chapter.chapterNumber, chapter.chapterTitle);

    // Mark chapter as in progress (old state manager)
    stateManager.updateChapter('analyze', chapterNum, 'in_progress');
    await stateManager.save();

    try {
      // Analyze chapter with retry
      const concepts = await this.executeWithRetry(
        async () => await this.analyzeChapterFull(chapter, modelConfig),
        `analyze chapter ${chapterNum}`
      );

      this.conceptsByChapter.set(chapter.chapterTitle, concepts);

      // Enrich Elements.md with new details discovered in this chapter
      try {
        const enrichment = await this.elementsMemory.enrichFromConcepts(concepts, chapterNum);

        if (enrichment.added > 0) {
          await progressTracker.log(
            `🧠 Memory: Added ${enrichment.added} new detail(s) to ${enrichment.entities.join(', ')}`,
            'success'
          );

          // Reload elements lookup so subsequent chapters get enriched descriptions
          await this.elementsLookup.load();
        }
      } catch (memoryError: any) {
        // Don't fail the chapter if memory enrichment fails
        await progressTracker.log(
          `⚠️  Memory enrichment failed: ${memoryError.message}`,
          'warning'
        );
      }

      // Estimate tokens used
      const tokensUsed = estimateTokens(chapter.content) + concepts.length * 200;

      // Update old state manager
      stateManager.updateChapter('analyze', chapterNum, 'completed', {
        concepts: concepts.length,
        tokensUsed,
      });
      stateManager.updateTokenStats(tokensUsed);
      await stateManager.save();

      // Update new manifest manager (for concurrent coordination)
      await this.manifestManager.updateChapter(chapterNum, 'analyzed', {
        analyzed_at: new Date().toISOString(),
        concepts: concepts.length,
      });

      await progressTracker.completeChapter(
        chapter.chapterNumber,
        chapter.chapterTitle,
        concepts.length
      );
    } catch (error: any) {
      stateManager.updateChapter('analyze', chapterNum, 'failed', {
        error: error.message,
      });
      await stateManager.save();

      await this.manifestManager.updateChapter(chapterNum, 'error', {
        error: error.message,
      });

      // Re-throw to be handled by caller
      throw error;
    }
  }

  /**
   * Analyze single chapter with Elements.md enrichment and custom templates
   */
  private async analyzeChapterFull(
    chapter: ChapterContent,
    modelConfig: any
  ): Promise<ImageConcept[]> {
    const { config, openai, progressTracker, stateManager } = this.context;

    // Filter non-story content
    if (!isStoryContent(chapter.chapterTitle)) {
      await progressTracker.log(
        `Pass 2: Skipping non-story chapter: ${chapter.chapterTitle}`,
        'info'
      );
      return [];
    }

    // Calculate number of images
    const pageRange = chapter.pageRange.split('-').map(p => parseInt(p.trim()));
    const pageCount = pageRange.length === 2
      ? (pageRange[1] - pageRange[0] + 1)
      : 1;
    const numImages = Math.max(1, Math.ceil(pageCount / config.pagesPerImage));

    // Load template (custom or preset or default)
    let analyzeTemplate = DEFAULT_ANALYZE_TEMPLATE;

    if (config.customTemplates?.enabled) {
      if (config.customTemplates.preset) {
        // Use preset template
        try {
          const preset = this.templateLoader.loadPreset(config.customTemplates.preset);
          analyzeTemplate = preset.analyze;
          await progressTracker.log(
            `Using ${config.customTemplates.preset} preset template`,
            'info'
          );
        } catch (error: any) {
          await progressTracker.log(
            `Failed to load preset ${config.customTemplates.preset}: ${error.message}`,
            'warning'
          );
        }
      } else if (config.customTemplates.analyzeTemplate) {
        // Use custom template file
        const templatePath = config.customTemplates.templatesDir
          ? join(config.customTemplates.templatesDir, config.customTemplates.analyzeTemplate)
          : config.customTemplates.analyzeTemplate;

        analyzeTemplate = await this.templateLoader.loadTemplate(
          templatePath,
          DEFAULT_ANALYZE_TEMPLATE
        );
        await progressTracker.log(`Using custom analyze template`, 'info');
      }
    }

    // Build template variables
    const state = stateManager.getState();
    const templateVars: TemplateVariables = {
      // Book metadata
      bookTitle: state.bookTitle,
      author: (state as any).author,
      publisher: (state as any).publisher,
      language: (state as any).language,
      totalPages: state.totalPages,
      genre: (config as any).genre,

      // Chapter data
      chapterContent: chapter.content,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.chapterTitle,
      pageRange: chapter.pageRange,
      wordCount: chapter.content.split(/\s+/).length,
      tokenCount: estimateTokens(chapter.content),

      // Configuration
      imageCount: numImages,
      pagesPerImage: config.pagesPerImage,
      imageSize: config.imageSize,
      imageQuality: config.imageQuality,
      style: (config as any).style,
    };

    // Enrich with Elements.md context if available
    if (this.elementsLookup.isLoaded()) {
      // Find entities mentioned in this chapter
      const mentions = this.elementsLookup.findMentions(chapter.content);

      if (mentions.length > 0) {
        // Format characters for template
        const charactersList = mentions
          .slice(0, 10) // Limit to 10 most relevant
          .map(entity => `- ${entity.name} (${entity.type}): ${entity.description}`)
          .join('\n');

        templateVars.characters = charactersList;

        await progressTracker.log(
          `Enriched prompt with ${mentions.length} entity references`,
          'info'
        );
      }
    }

    // Render template with variables
    const basePrompt = this.templateLoader.renderTemplate(analyzeTemplate, templateVars);

    // Call AI with enriched prompt
    const response = await openai.chat.completions.create({
      model: modelConfig.name,
      messages: [
        {
          role: 'system',
          content: 'You are a literary analysis expert specializing in identifying visually rich scenes for illustration. Return valid JSON only.',
        },
        {
          role: 'user',
          content: basePrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || '[]';

    // Parse JSON response (with fallback)
    let concepts: ImageConcept[] = [];
    try {
      concepts = JSON.parse(content);
    } catch (parseError) {
      const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (jsonMatch) {
        concepts = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error(`Failed to parse AI response as JSON: ${parseError}`);
      }
    }

    // Enrich concepts with chapter metadata (pages, chapter info)
    concepts = concepts.map((concept) => ({
      ...concept,
      chapter: chapter.chapterTitle,
      chapterNumber: chapter.chapterNumber,
      pageRange: chapter.pageRange,
    }));

    // Enrich concepts with full entity descriptions for standalone use
    if (this.elementsLookup.isLoaded()) {
      concepts = concepts.map((concept) => {
        // Find entities mentioned in the visual description
        const mentions = this.elementsLookup.findMentions(concept.description);

        if (mentions.length > 0) {
          // Append full entity descriptions to make the description standalone
          let enrichedDescription = concept.description;
          enrichedDescription += '\n\nCHARACTER DETAILS:';

          for (const entity of mentions) {
            enrichedDescription += `\n- ${entity.name} (${entity.type}): ${entity.description}`;
          }

          return {
            ...concept,
            description: enrichedDescription,
          };
        }

        return concept;
      });
    }

    return concepts;
  }

  /**
   * Sub-phase 5: Save results to Chapters.md
   */
  protected async save(): Promise<SubPhaseResult> {
    const { outputDir, stateManager, progressTracker } = this.context;

    if (this.conceptsByChapter.size === 0) {
      return { success: true };
    }

    await progressTracker.log('Generating Chapters.md...', 'info');

    const state = stateManager.getState();
    const metadata = {
      title: state.bookTitle,
      totalPages: state.totalPages,
    };

    await generateChaptersFile(outputDir, metadata, this.conceptsByChapter);

    await progressTracker.log('Chapters.md generated', 'success');

    return { success: true };
  }
}
