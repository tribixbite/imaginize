/**
 * Analyze phase - Generate Chapters.md with visual scenes
 * Corresponds to --text flag
 */

import { BasePhase, type PhaseContext, type SubPhaseResult } from './base-phase.js';
import type { ImageConcept, ChapterContent } from '../../types/config.js';
import { estimateTokens, createTokenEstimate, calculateSplits, resolveModelConfig } from '../token-counter.js';
import { generateChaptersFile } from '../output-generator.js';

interface AnalyzePlanData {
  chaptersToProcess: number[];
  totalEstimatedTokens: number;
  estimatedCost: number;
  requiresSplitting: boolean;
}

export class AnalyzePhase extends BasePhase {
  private planData?: AnalyzePlanData;
  private conceptsByChapter: Map<string, ImageConcept[]> = new Map();

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
      requiresSplitting: chaptersToProcess.some(num => {
        const chapter = chapters.find(c => c.chapterNumber === num)!;
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
    if (!this.planData || this.planData.chaptersToProcess.length === 0) {
      return { success: true };
    }

    // Nothing specific to prepare for analyze phase
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
      const chapter = chapters.find(c => c.chapterNumber === chapterNum)!;

      await progressTracker.startChapter(chapter.chapterNumber, chapter.chapterTitle);

      // Mark chapter as in progress
      stateManager.updateChapter('analyze', chapterNum, 'in_progress');
      await stateManager.save();

      try {
        // Analyze chapter with retry
        const concepts = await this.executeWithRetry(
          async () => await this.analyzeChapter(chapter, modelConfig),
          `analyze chapter ${chapterNum}`
        );

        this.conceptsByChapter.set(chapter.chapterTitle, concepts);

        // Estimate tokens used (rough approximation)
        const tokensUsed = estimateTokens(chapter.content) + concepts.length * 200;
        totalTokensUsed += tokensUsed;

        // Update state
        stateManager.updateChapter('analyze', chapterNum, 'completed', {
          concepts: concepts.length,
          tokensUsed,
        });
        stateManager.updateTokenStats(tokensUsed);
        await stateManager.save();

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
        throw error;
      }
    }

    return { success: true, tokensUsed: totalTokensUsed };
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

  /**
   * Analyze a single chapter to extract visual concepts
   */
  private async analyzeChapter(
    chapter: ChapterContent,
    modelConfig: any
  ): Promise<ImageConcept[]> {
    const { config, openai } = this.context;

    // Calculate number of images based on actual page count
    // Parse page range (e.g., "8-8" or "9-11")
    const pageRange = chapter.pageRange.split('-').map(p => parseInt(p.trim()));
    const pageCount = pageRange.length === 2
      ? (pageRange[1] - pageRange[0] + 1)
      : 1;

    // Generate 1 image per pagesPerImage (default: 10)
    const numImages = Math.max(1, Math.ceil(pageCount / config.pagesPerImage));

    const prompt = `You are analyzing a book chapter to identify visually rich scenes for illustration.

Chapter: ${chapter.chapterTitle}
Page Range: ${chapter.pageRange}

Content:
${chapter.content}

Identify ${numImages} visually compelling scenes from this chapter. For each scene:
1. Extract a COMPLETE passage of 3-8 consecutive sentences that contains rich visual description
2. The quote MUST be verbatim from the source text - copy it exactly as written
3. For the description field, extract ONLY the visual details from those sentences (what can be drawn)

CRITICAL REQUIREMENTS:
- Quote length: MINIMUM 3 sentences, MAXIMUM 8 sentences - select the full passage that describes the scene
- EXACT quotes: Copy the text word-for-word, preserving all punctuation and capitalization
- Multi-sentence context: Include surrounding sentences that add visual detail to the scene
- Description: List only physical visual elements (characters, creatures, settings, objects, actions, lighting, weather)
- NO single-sentence quotes - always include contextual sentences before/after
- Focus on narrative scenes with action, not glossary/appendix entries

GOOD EXAMPLE:
{
  "quote": "The sky was darkening to purple, and the first stars were beginning to show. The griffin landed on a rocky outcrop, its wings spread wide against the sunset. Its feathers caught the last rays of light, turning gold and amber. Christopher could see every detail of its eagle face - the sharp curve of its beak, the fierce intelligence in its eyes.",
  "description": "A griffin landing on a rocky outcrop at sunset with wings spread wide. Purple darkening sky with first stars appearing. Griffin's feathers are gold and amber in the sunset light. Close view showing eagle face details, curved beak, and intelligent eyes."
}

BAD EXAMPLE (too short):
{
  "quote": "The griffin landed.",
  "description": "A griffin landing."
}

Return JSON format:
{
  "concepts": [
    {
      "quote": "3-8 consecutive sentences verbatim from source",
      "description": "visual elements only: who, what, where, appearance, actions, lighting, atmosphere"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: typeof modelConfig === 'string' ? modelConfig : modelConfig.name,
      messages: [
        {
          role: 'system',
          content: 'You are a literary analyst specializing in visual storytelling. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    const concepts = parsed.concepts || [];

    return concepts.map((c: any) => ({
      chapter: chapter.chapterTitle,
      chapterNumber: chapter.chapterNumber, // Add actual chapter number
      pageRange: chapter.pageRange,
      quote: c.quote || '',
      description: c.description || '',
      lineNumbers: chapter.lineNumbers,
    }));
  }
}
