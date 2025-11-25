/**
 * Analyze phase - Generate Chapters.md with visual scenes
 * Corresponds to --text flag
 */

import { BasePhase, type PhaseContext, type SubPhaseResult } from './base-phase.js';
import type { ImageConcept, ChapterContent, BookElement } from '../../types/config.js';
import {
  estimateTokens,
  createTokenEstimate,
  calculateSplits,
  resolveModelConfig,
} from '../token-counter.js';
import { generateChaptersFile } from '../output-generator.js';
import { isStoryContent } from '../provider-utils.js';
import { analyzeChapterUnified, type UnifiedAnalysisResult } from '../ai-analyzer.js';

interface AnalyzePlanData {
  chaptersToProcess: number[];
  totalEstimatedTokens: number;
  estimatedCost: number;
  requiresSplitting: boolean;
}

export class AnalyzePhase extends BasePhase {
  private planData?: AnalyzePlanData;
  private conceptsByChapter: Map<string, ImageConcept[]> = new Map();
  private elementsByChapter: Map<number, BookElement[]> = new Map();

  constructor(context: PhaseContext) {
    super(context, 'analyze');
  }

  /**
   * Sub-phase 1: Plan which chapters to process and estimate token usage
   */
  protected async plan(): Promise<SubPhaseResult> {
    const { stateManager, chapters, config, progressTracker } = this.context;

    await progressTracker.log('Planning text analysis...', 'info');

    // Determine which chapters need processing
    const chaptersToProcess = chapters
      .map((c) => c.chapterNumber)
      .filter((num) => this.shouldProcessChapter(num));

    if (chaptersToProcess.length === 0) {
      await progressTracker.log('All chapters already analyzed', 'info');
      return { success: true, data: { chaptersToProcess: [] } };
    }

    // Estimate total tokens needed
    let totalEstimatedTokens = 0;
    let estimatedCost = 0;

    const modelConfig = resolveModelConfig(config.model, config);

    for (const chapterNum of chaptersToProcess) {
      const chapter = chapters.find((c) => c.chapterNumber === chapterNum)!;
      const estimate = createTokenEstimate(
        chapter.content,
        1000, // Expected output tokens per chapter
        modelConfig,
        config.tokenSafetyMargin
      );

      totalEstimatedTokens += estimate.totalTokens;
      estimatedCost += estimate.estimatedCost;

      // Store token count in chapter
      chapter.tokenCount = estimate.inputTokens;
    }

    this.planData = {
      chaptersToProcess,
      totalEstimatedTokens,
      estimatedCost,
      requiresSplitting: chaptersToProcess.some((num) => {
        const chapter = chapters.find((c) => c.chapterNumber === num)!;
        const estimate = createTokenEstimate(
          chapter.content,
          1000,
          modelConfig,
          config.tokenSafetyMargin
        );
        return estimate.willExceedLimit;
      }),
    };

    await progressTracker.log(
      `Plan: ${chaptersToProcess.length} chapters, ~${totalEstimatedTokens.toLocaleString()} tokens, $${estimatedCost.toFixed(4)}`,
      'info'
    );

    return { success: true, data: this.planData };
  }

  /**
   * Sub-phase 2: Estimate costs and confirm model selection
   */
  protected async estimate(): Promise<SubPhaseResult> {
    const { config, progressTracker } = this.context;

    if (!this.planData || this.planData.chaptersToProcess.length === 0) {
      return { success: true };
    }

    const modelConfig = resolveModelConfig(config.model, config);

    await progressTracker.log(
      `Using model: ${modelConfig.name} (${modelConfig.contextLength?.toLocaleString()} tokens context)`,
      'info'
    );

    if (this.planData.requiresSplitting) {
      await progressTracker.log(
        'Some chapters will be split due to token limits',
        'warning'
      );
    }

    return {
      success: true,
      data: {
        modelSelected: modelConfig.name,
        estimatedCost: this.planData.estimatedCost,
      },
    };
  }

  /**
   * Sub-phase 3: Prepare context and prompts
   */
  protected async prepare(): Promise<SubPhaseResult> {
    const { config, outputDir, progressTracker } = this.context;

    if (!this.planData || this.planData.chaptersToProcess.length === 0) {
      return { success: true };
    }

    // If series mode is enabled, import existing entities from series
    if (config.series?.enabled && config.series.seriesRoot && config.series.bookId) {
      try {
        const { createSeriesElementsManager } = await import('../series/series-elements.js');
        const elementsManager = createSeriesElementsManager(config.series.seriesRoot);

        await progressTracker.log('Importing series elements...', 'info');
        const result = await elementsManager.importToBook(config.series.bookId, outputDir);

        if (result.count > 0) {
          await progressTracker.log(
            `Imported ${result.count} entities from series: ${result.entities.join(', ')}`,
            'success'
          );
        } else {
          await progressTracker.log('No existing series entities to import', 'info');
        }
      } catch (error: any) {
        await progressTracker.log(`Series import warning: ${error.message}`, 'warning');
        // Don't fail the phase, just continue without series import
      }
    }

    return { success: true };
  }

  /**
   * Sub-phase 4: Execute the analysis
   */
  protected async executePhase(): Promise<SubPhaseResult> {
    const { chapters, config, openai, stateManager, progressTracker } = this.context;

    if (!this.planData || this.planData.chaptersToProcess.length === 0) {
      return { success: true };
    }

    const modelConfig = resolveModelConfig(config.model, config);
    let totalTokensUsed = 0;

    for (const chapterNum of this.planData.chaptersToProcess) {
      const chapter = chapters.find((c) => c.chapterNumber === chapterNum)!;

      await progressTracker.startChapter(chapter.chapterNumber, chapter.chapterTitle);

      // Mark chapter as in progress
      stateManager.updateChapter('analyze', chapterNum, 'in_progress');
      await stateManager.save();

      try {
        // Analyze chapter with unified function (extracts scenes AND elements)
        const result = await this.executeWithRetry(
          async () => await this.analyzeChapter(chapter, modelConfig),
          `analyze chapter ${chapterNum}`
        );

        // Store scenes for Chapters.md generation
        this.conceptsByChapter.set(chapter.chapterTitle, result.scenes);

        // Store elements for later use by extract phase
        if (result.elements && result.elements.length > 0) {
          this.elementsByChapter.set(chapterNum, result.elements);
        }

        // Estimate tokens used (rough approximation)
        const tokensUsed = estimateTokens(chapter.content) +
                          result.scenes.length * 200 +
                          result.elements.length * 150;
        totalTokensUsed += tokensUsed;

        // Update state with BOTH scenes and elements
        stateManager.updateChapter('analyze', chapterNum, 'completed', {
          concepts: result.scenes.length, // DEPRECATED: For backward compatibility
          sceneConcepts: result.scenes,   // NEW: Full scene data
          elements: result.elements,      // NEW: Full element data
          tokensUsed,
        });
        stateManager.updateTokenStats(tokensUsed);
        await stateManager.save();

        await progressTracker.completeChapter(
          chapter.chapterNumber,
          chapter.chapterTitle,
          result.scenes.length
        );
      } catch (error: any) {
        stateManager.updateChapter('analyze', chapterNum, 'failed', {
          error: error.message,
        });
        await stateManager.save();
        throw error;
      }
    }

    return { success: true, tokensUsed: totalTokensUsed };
  }

  /**
   * Sub-phase 5: Save results to Chapters.md
   */
  protected async save(): Promise<SubPhaseResult> {
    const { config, outputDir, stateManager, progressTracker } = this.context;

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

    // If series mode is enabled, export discovered entities to series
    if (config.series?.enabled && config.series.seriesRoot && config.series.bookId) {
      try {
        const { createSeriesElementsManager } = await import('../series/series-elements.js');
        const elementsManager = createSeriesElementsManager(config.series.seriesRoot);

        await progressTracker.log('Exporting entities to series...', 'info');
        const result = await elementsManager.exportFromBook(
          config.series.bookId,
          config.series.bookTitle || state.bookTitle,
          outputDir
        );

        if (result.count > 0) {
          await progressTracker.log(
            `Exported ${result.count} entities to series`,
            'success'
          );
        } else {
          await progressTracker.log('No new entities to export', 'info');
        }
      } catch (error: any) {
        await progressTracker.log(`Series export warning: ${error.message}`, 'warning');
        // Don't fail the phase, just continue without series export
      }
    }

    return { success: true };
  }

  /**
   * Analyze a single chapter using unified function (extracts scenes AND elements)
   */
  private async analyzeChapter(
    chapter: ChapterContent,
    modelConfig: any
  ): Promise<UnifiedAnalysisResult> {
    const { config, openai, progressTracker } = this.context;

    // Filter non-story content
    if (!isStoryContent(chapter.chapterTitle)) {
      await progressTracker.log(
        `Skipping non-story chapter: ${chapter.chapterTitle}`,
        'info'
      );
      return { scenes: [], elements: [] }; // Return empty result for non-story chapters
    }

    // Use unified analysis function to extract BOTH scenes and elements in one API call
    // This reduces API calls by 50% compared to separate analyze + extract phases
    const result = await analyzeChapterUnified(chapter, config, openai);

    // Add chapter metadata to scenes for backward compatibility with Chapters.md
    const scenesWithMetadata = result.scenes.map((scene) => ({
      ...scene,
      chapter: chapter.chapterTitle,
      chapterNumber: chapter.chapterNumber,
      pageRange: chapter.pageRange,
      lineNumbers: chapter.lineNumbers,
      // Ensure mood and lighting have defaults
      mood: scene.reasoning || 'neutral', // Use reasoning as mood if available
      lighting: 'natural daylight', // Default lighting
    }));

    return {
      scenes: scenesWithMetadata,
      elements: result.elements,
    };
  }
}
