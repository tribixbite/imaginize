/**
 * Base class for all processing phases
 * Provides common functionality for state management, progress tracking, and error handling
 */

import type OpenAI from 'openai';
import type {
  IllustrateConfig,
  ChapterContent,
  PhaseStatus,
  SubPhase,
  ModelConfig,
} from '../../types/config.js';
import type { StateManager } from '../state-manager.js';
import type { ProgressTracker } from '../progress-tracker.js';
import { retryWithBackoff, formatRetryError } from '../retry-utils.js';
import { estimateTokens, createTokenEstimate } from '../token-counter.js';

export interface PhaseContext {
  config: Required<IllustrateConfig>;
  openai: OpenAI;
  imageOpenai?: OpenAI;
  stateManager: StateManager;
  progressTracker: ProgressTracker;
  chapters: ChapterContent[];
  outputDir: string;
}

export interface SubPhaseResult {
  success: boolean;
  data?: any;
  error?: Error;
  tokensUsed?: number;
}

/**
 * Abstract base class for all phases
 */
export abstract class BasePhase {
  protected context: PhaseContext;
  protected phaseName: keyof IllustrateConfig['phases'] extends never
    ? string
    : 'parse' | 'analyze' | 'extract' | 'illustrate';

  constructor(context: PhaseContext, phaseName: any) {
    this.context = context;
    this.phaseName = phaseName;
  }

  /**
   * Execute the phase
   */
  async execute(): Promise<void> {
    const { stateManager, progressTracker } = this.context;

    try {
      // Mark phase as in progress
      stateManager.updatePhase(this.phaseName, 'in_progress');
      await stateManager.save();

      await progressTracker.log(`Starting phase: ${this.phaseName}`, 'info');

      // Run sub-phases
      await this.runSubPhase('plan');
      await this.runSubPhase('estimate');
      await this.runSubPhase('prepare');
      await this.runSubPhase('execute');
      await this.runSubPhase('save');

      // Mark phase as completed
      stateManager.updatePhase(this.phaseName, 'completed');
      await stateManager.save();

      await progressTracker.log(`Completed phase: ${this.phaseName}`, 'success');
    } catch (error: any) {
      stateManager.updatePhase(this.phaseName, 'failed', { error: error.message });
      await stateManager.save();

      await progressTracker.log(`Failed phase: ${this.phaseName} - ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Run a sub-phase with state tracking
   */
  private async runSubPhase(subPhase: SubPhase): Promise<void> {
    const { stateManager } = this.context;
    const state = stateManager.getState();

    // Update current sub-phase
    stateManager.updatePhase(this.phaseName, 'in_progress', {
      currentSubPhase: subPhase,
      subPhases: {
        ...state.phases[this.phaseName].subPhases,
        [subPhase]: { status: 'in_progress' as PhaseStatus },
      },
    });
    await stateManager.save();

    try {
      // Execute sub-phase
      let result: SubPhaseResult;

      switch (subPhase) {
        case 'plan':
          result = await this.plan();
          break;
        case 'estimate':
          result = await this.estimate();
          break;
        case 'prepare':
          result = await this.prepare();
          break;
        case 'execute':
          result = await this.executePhase();
          break;
        case 'save':
          result = await this.save();
          break;
        default:
          throw new Error(`Unknown sub-phase: ${subPhase}`);
      }

      // Mark sub-phase as completed
      const currentState = stateManager.getState();
      stateManager.updatePhase(this.phaseName, 'in_progress', {
        currentSubPhase: subPhase,
        subPhases: {
          ...currentState.phases[this.phaseName].subPhases,
          [subPhase]: {
            status: 'completed' as PhaseStatus,
            ...result.data,
          },
        },
      });
      await stateManager.save();
    } catch (error: any) {
      const currentState = stateManager.getState();
      stateManager.updatePhase(this.phaseName, 'in_progress', {
        currentSubPhase: subPhase,
        subPhases: {
          ...currentState.phases[this.phaseName].subPhases,
          [subPhase]: {
            status: 'failed' as PhaseStatus,
            error: error.message,
          },
        },
      });
      await stateManager.save();
      throw error;
    }
  }

  /**
   * Execute API call with retry logic
   */
  protected async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<T> {
    const { config, progressTracker } = this.context;

    return retryWithBackoff(fn, {
      maxRetries: config.maxRetries,
      initialTimeout: config.retryTimeout,
      onRetry: async (attempt, error) => {
        const message = `Retry ${attempt}/${config.maxRetries} for ${context}: ${error.message}`;
        await progressTracker.log(message, 'warning');
      },
    }).catch((error) => {
      const errorMessage = formatRetryError(
        error,
        context,
        config.maxRetries + 1
      );
      throw new Error(errorMessage);
    });
  }

  /**
   * Check if chapter should be processed (not already completed)
   */
  protected shouldProcessChapter(chapterNumber: number): boolean {
    const { stateManager } = this.context;
    return !stateManager.isChapterCompleted(this.phaseName, chapterNumber);
  }

  /**
   * Abstract methods to be implemented by concrete phases
   */
  protected abstract plan(): Promise<SubPhaseResult>;
  protected abstract estimate(): Promise<SubPhaseResult>;
  protected abstract prepare(): Promise<SubPhaseResult>;
  protected abstract executePhase(): Promise<SubPhaseResult>;
  protected abstract save(): Promise<SubPhaseResult>;
}
