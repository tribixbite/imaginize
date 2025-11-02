/**
 * Illustrate phase - Generate images for chapters and elements
 * Corresponds to --images flag
 */

import { BasePhase, type PhaseContext, type SubPhaseResult } from './base-phase.js';
import { resolveModelConfig } from '../token-counter.js';

export class IllustratePhase extends BasePhase {
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
    const { progressTracker } = this.context;

    // TODO: Implement actual image generation
    // For now, this is a placeholder

    await progressTracker.log(
      '🎨 Image generation not yet implemented in v2.0',
      'info'
    );

    await progressTracker.log(
      'This feature will be added in a future update',
      'info'
    );

    return { success: true };
  }

  /**
   * Sub-phase 5: Save image URLs
   */
  protected async save(): Promise<SubPhaseResult> {
    // TODO: Update Contents.md and Elements.md with image URLs
    return { success: true };
  }
}
