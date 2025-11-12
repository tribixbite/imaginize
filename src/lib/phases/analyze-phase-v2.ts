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

  constructor(context: PhaseContext) {
    super(context, 'analyze');

    // Initialize manifest manager for concurrent coordination
    this.manifestManager = createManifestManager(context.outputDir);

    // Initialize elements lookup for Pass 2 enrichment
    this.elementsLookup = createElementsLookup(context.outputDir);
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
   */
  private async executePass1(): Promise<void> {
    const { chapters, openai, progressTracker } = this.context;

    const startTime = Date.now();
    await progressTracker.log('PASS 1: Extracting entities from all chapters...', 'info');

    // Update manifest status
    await this.manifestManager.updateElementsStatus('inprogress');

    const entityResults: EntityExtractionResult[] = [];

    for (const chapterNum of this.planData!.chaptersToProcess) {
      const chapter = chapters.find(c => c.chapterNumber === chapterNum)!;

      // Skip non-story chapters
      if (!isStoryContent(chapter.chapterTitle)) {
        await progressTracker.log(
          `Pass 1: Skipping non-story chapter ${chapterNum}`,
          'info'
        );
        continue;
      }

      await progressTracker.log(
        `Pass 1: Extracting entities from Chapter ${chapterNum}: ${chapter.chapterTitle}`,
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
          `extract entities from chapter ${chapterNum}`
        );

        entityResults.push(result);

        await progressTracker.log(
          `Pass 1: Found ${result.entities.length} entities in Chapter ${chapterNum}`,
          'success'
        );
      } catch (error: any) {
        await progressTracker.log(
          `Pass 1: Failed to extract entities from Chapter ${chapterNum}: ${error.message}`,
          'warning'
        );
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

    const modelConfig = resolveModelConfig(config.model, config);
    const chaptersToProcess = this.planData!.chaptersToProcess;

    // Determine batch size based on rate limits
    // For OpenRouter free tier (1 req/min), use batch size 1
    // For paid tiers or OpenAI, use batch size 3
    const modelStr = typeof config.model === 'string' ? config.model : config.model?.name || '';
    const batchSize = modelStr.includes('free') ? 1 : 3;

    await progressTracker.log(
      `Processing ${chaptersToProcess.length} chapters in batches of ${batchSize}`,
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

      // Add delay between batches to respect rate limits (if batch size > 1)
      if (batchSize > 1 && i + batchSize < chaptersToProcess.length) {
        const delayMs = 2000; // 2 second delay between batches
        await progressTracker.log(`Waiting ${delayMs / 1000}s before next batch...`, 'info');
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
   * Analyze single chapter with Elements.md enrichment
   */
  private async analyzeChapterFull(
    chapter: ChapterContent,
    modelConfig: any
  ): Promise<ImageConcept[]> {
    const { config, openai, progressTracker } = this.context;

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

    // Base prompt with explicit quote length requirements
    let basePrompt = `You are analyzing a book chapter to identify visually rich scenes for illustration.

**Task:** Identify the ${numImages} most visually compelling and narratively important scenes in this chapter.

For each scene, provide:
1. A vivid visual description (2-3 sentences) suitable for image generation
2. A substantial quote from the text (MINIMUM 3-8 sentences, 50-150 words) that captures the scene's atmosphere and key details
3. Your reasoning for why this scene is visually and narratively significant

**IMPORTANT:** The quote must be substantial enough to serve as a standalone reference for illustration. Include enough context to understand character actions, setting details, and mood.

**Chapter:** ${chapter.chapterTitle}

**Chapter Content:**
${chapter.content}

Return your response as a JSON array with this structure:
[
  {
    "description": "Detailed visual description of the scene",
    "quote": "Substantial quote from the text (3-8 sentences minimum)",
    "reasoning": "Why this scene is visually and narratively important"
  }
]`;

    // Enrich prompt with Elements.md context if available
    if (this.elementsLookup.isLoaded()) {
      // Find entities mentioned in this chapter
      const mentions = this.elementsLookup.findMentions(chapter.content);

      if (mentions.length > 0) {
        basePrompt += '\n\n**Entity Reference (for visual consistency):**';
        for (const entity of mentions.slice(0, 10)) { // Limit to 10 most relevant
          basePrompt += `\n- ${entity.name} (${entity.type}): ${entity.description}`;
        }

        await progressTracker.log(
          `Enriched prompt with ${mentions.length} entity references`,
          'info'
        );
      }
    }

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
