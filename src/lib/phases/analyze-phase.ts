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

    const numImages = Math.ceil(
      chapter.content.split(/\s+/).length / (config.pagesPerImage * 300)
    );

    const prompt = `You are analyzing a book chapter to identify visually rich scenes for illustration.

Chapter: ${chapter.chapterTitle}
Page Range: ${chapter.pageRange}

Content:
${chapter.content}

Identify ${numImages} visually compelling scenes from this chapter. For each scene:
1. Extract the COMPLETE original description from the text (2-5 consecutive sentences that describe the visual scene)
2. Provide ONLY a factual description of what is shown (no interpretation, no "why it matters")

IMPORTANT:
- Use EXACT quotes from the source text (not paraphrased)
- Include the FULL descriptive passage (multiple sentences if the description spans them)
- Stay true to the author's words - do not add interpretation
- Focus on moments with strong visual descriptions

Return JSON format:
{
  "concepts": [
    {
      "quote": "full multi-sentence quote from source text",
      "description": "factual description of visual elements only"
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
      pageRange: chapter.pageRange,
      quote: c.quote || '',
      description: c.description || '',
    }));
  }
}
