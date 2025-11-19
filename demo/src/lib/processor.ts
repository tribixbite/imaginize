/**
 * Main processing pipeline orchestrator
 * Coordinates parsing, analysis, and image generation
 */

import type OpenAI from 'openai';
import { parseBook, type BookParseResult } from './book-parser';
import { analyzeChapter, generateSceneImage, type AnalysisResult, type ImageGenerationResult } from './api-client';
import type { BookFile, ProcessingState, ProcessingResult, ActivityLog, GeneratedImage } from '../types';
import type { ProcessingOptions } from './pipeline-config';
import { DEFAULT_OPTIONS, getModelInfo } from './pipeline-config';

export interface ProcessorCallbacks {
  onStateChange: (state: ProcessingState) => void;
  onActivity: (log: ActivityLog) => void;
  onChapterComplete: (chapterNumber: number, analysis: AnalysisResult) => void;
  onImageComplete: (image: ImageGenerationResult) => void;
  onError: (error: Error) => void;
}

export class BookProcessor {
  private bookFile: BookFile;
  private openai: OpenAI;
  private callbacks: ProcessorCallbacks;
  private options: ProcessingOptions;
  private cancelled: boolean = false;
  private startTime: number = 0;

  constructor(
    bookFile: BookFile,
    openai: OpenAI,
    callbacks: ProcessorCallbacks,
    options?: Partial<ProcessingOptions>
  ) {
    this.bookFile = bookFile;
    this.openai = openai;
    this.callbacks = callbacks;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Get current processing options
   */
  getOptions(): ProcessingOptions {
    return this.options;
  }

  /**
   * Main processing pipeline
   */
  async process(): Promise<ProcessingResult> {
    this.startTime = Date.now();
    this.cancelled = false;

    try {
      // Phase 1: Parse book
      this.updateState('parsing', 0, 'Parsing book file...');
      const bookData = await this.parseBookFile();

      if (this.cancelled) {
        throw new Error('Processing cancelled');
      }

      // Phase 2: Analyze chapters (if enabled)
      let analyses: AnalysisResult[] = [];
      if (this.options.enableAnalysis) {
        this.updateState('analyzing', 0, 'Analyzing chapters...');
        analyses = await this.analyzeChapters(bookData);

        if (this.cancelled) {
          throw new Error('Processing cancelled');
        }
      }

      // Phase 3: Generate images (if enabled)
      let images: GeneratedImage[] = [];
      if (this.options.enableIllustration && analyses.length > 0) {
        this.updateState('illustrating', 0, 'Generating images...');
        images = await this.generateImages(analyses);
      } else if (!this.options.enableIllustration) {
        this.logActivity('Image generation disabled', 'info');
      }

      if (this.cancelled) {
        throw new Error('Processing cancelled');
      }

      // Phase 4: Complete
      this.updateState('complete', 100, 'Processing complete!');

      const processingTime = Math.round((Date.now() - this.startTime) / 1000);

      return {
        chapters: this.buildChapters(bookData, analyses),
        elements: this.extractElements(analyses),
        images,
        statistics: {
          processingTime,
          apiCalls: analyses.length + images.length,
          estimatedCost: this.estimateCost(analyses.length, images.length),
          imagesGenerated: images.length,
          chaptersProcessed: analyses.length,
        },
      };
    } catch (error) {
      this.updateState('error', 0, 'Processing failed');
      this.callbacks.onError(error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  /**
   * Cancel processing
   */
  cancel(): void {
    this.cancelled = true;
    this.logActivity('Processing cancelled by user', 'warning');
  }

  /**
   * Parse book file (EPUB or PDF)
   */
  private async parseBookFile(): Promise<BookParseResult> {
    return parseBook(this.bookFile, (progress, message) => {
      this.updateState('parsing', progress, message);
      this.logActivity(message, 'info');
    });
  }

  /**
   * Analyze all chapters to extract scenes
   */
  private async analyzeChapters(bookData: BookParseResult): Promise<AnalysisResult[]> {
    const analyses: AnalysisResult[] = [];
    const totalChapters = bookData.chapters.length;

    for (let i = 0; i < totalChapters; i++) {
      if (this.cancelled) break;

      const chapter = bookData.chapters[i];
      const progress = Math.round(((i + 1) / totalChapters) * 100);

      this.updateState('analyzing', progress, `Analyzing Chapter ${chapter.number}...`);
      this.logActivity(`Analyzing Chapter ${chapter.number}: ${chapter.title}`, 'info');

      try {
        const analysis = await analyzeChapter(this.openai, chapter, bookData.metadata.title, this.options);
        analyses.push(analysis);

        this.callbacks.onChapterComplete(chapter.number, analysis);
        this.logActivity(`✓ Chapter ${chapter.number} analyzed (${analysis.scenes.length} scenes)`, 'success');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logActivity(`✗ Failed to analyze Chapter ${chapter.number}: ${errorMessage}`, 'error');
        console.error(`Chapter ${chapter.number} analysis failed:`, error);

        // Continue with next chapter if skipFailed is enabled
        if (!this.options.skipFailed) {
          throw error;
        }
      }
    }

    return analyses;
  }

  /**
   * Generate images for all scenes
   */
  private async generateImages(
    analyses: AnalysisResult[]
  ): Promise<GeneratedImage[]> {
    const images: GeneratedImage[] = [];

    // Count total scenes
    const totalScenes = analyses.reduce((sum, a) => sum + a.scenes.length, 0);
    let completedScenes = 0;

    for (const analysis of analyses) {
      if (this.cancelled) break;

      for (const scene of analysis.scenes) {
        if (this.cancelled) break;

        const progress = Math.round((completedScenes / totalScenes) * 100);
        this.updateState(
          'illustrating',
          progress,
          `Generating image ${completedScenes + 1}/${totalScenes}...`
        );
        this.logActivity(`Generating Chapter ${analysis.chapterNumber}, Scene ${scene.sceneNumber}`, 'info');

        try {
          const imgResult = await generateSceneImage(
            this.openai,
            scene,
            analysis.chapterNumber,
            this.options.styleGuide,
            this.options
          );

          // Convert ImageGenerationResult to GeneratedImage
          const image: GeneratedImage = {
            chapterNumber: imgResult.chapterNumber,
            sceneNumber: imgResult.sceneNumber,
            filename: `ch${imgResult.chapterNumber}_sc${imgResult.sceneNumber}.png`,
            url: imgResult.imageUrl,
            prompt: imgResult.prompt,
            timestamp: imgResult.timestamp,
          };

          images.push(image);

          this.callbacks.onImageComplete(imgResult);
          this.logActivity(`✓ Image generated for Chapter ${analysis.chapterNumber}, Scene ${scene.sceneNumber}`, 'success');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logActivity(
            `✗ Failed to generate image for Chapter ${analysis.chapterNumber}, Scene ${scene.sceneNumber}: ${errorMessage}`,
            'error'
          );
          console.error('Image generation failed:', error);

          // Continue with next scene if skipFailed is enabled
          if (!this.options.skipFailed) {
            throw error;
          }
        }

        completedScenes++;
      }
    }

    return images;
  }

  /**
   * Build chapter data with analyses
   */
  private buildChapters(bookData: BookParseResult, analyses: AnalysisResult[]) {
    return bookData.chapters.map((chapter) => {
      const analysis = analyses.find((a) => a.chapterNumber === chapter.number);

      return {
        number: chapter.number,
        title: chapter.title,
        scenes: analysis?.scenes.map((scene) => ({
          number: scene.sceneNumber,
          description: scene.description,
          mood: scene.mood,
          lighting: scene.lighting,
        })) || [],
      };
    });
  }

  /**
   * Extract unique elements from analyses
   */
  private extractElements(analyses: AnalysisResult[]) {
    const elementsMap = new Map<string, { type: 'character' | 'place' | 'object'; name: string; description: string; appearances: number[] }>();

    analyses.forEach((analysis) => {
      analysis.scenes.forEach((scene) => {
        scene.elements.forEach((element) => {
          if (!elementsMap.has(element)) {
            elementsMap.set(element, {
              type: 'character', // Simplified - would need better detection
              name: element,
              description: '',
              appearances: [analysis.chapterNumber],
            });
          } else {
            const existing = elementsMap.get(element)!;
            if (!existing.appearances.includes(analysis.chapterNumber)) {
              existing.appearances.push(analysis.chapterNumber);
            }
          }
        });
      });
    });

    return Array.from(elementsMap.values());
  }

  /**
   * Estimate total cost based on configured models
   */
  private estimateCost(chaptersAnalyzed: number, imagesGenerated: number): number {
    // Get model costs from configuration
    const textModel = getModelInfo(this.options.provider, this.options.textModel);
    const imageModel = getModelInfo(this.options.provider, this.options.imageModel);

    const analysisTokensPerChapter = 5000; // Input + output estimate
    const costPerToken = (textModel?.costPer1kTokens || 0.01) / 1000;
    const costPerImage = imageModel?.costPerImage || 0.04;

    const analysisCost = chaptersAnalyzed * analysisTokensPerChapter * costPerToken;
    const imageCost = imagesGenerated * costPerImage;

    return Math.round((analysisCost + imageCost) * 100) / 100;
  }

  /**
   * Update processing state
   */
  private updateState(phase: ProcessingState['phase'], progress: number, message: string): void {
    const estimatedTimeRemaining = this.estimateTimeRemaining(progress);

    this.callbacks.onStateChange({
      phase,
      progress,
      currentStep: message,
      estimatedTimeRemaining,
    });
  }

  /**
   * Estimate time remaining
   */
  private estimateTimeRemaining(progress: number): number {
    if (progress === 0) return 0;

    const elapsed = Date.now() - this.startTime;
    const total = (elapsed / progress) * 100;
    const remaining = total - elapsed;

    return Math.round(remaining / 1000); // Convert to seconds
  }

  /**
   * Log activity
   */
  private logActivity(message: string, type: ActivityLog['type']): void {
    this.callbacks.onActivity({
      timestamp: new Date(),
      message,
      type,
    });
  }
}
