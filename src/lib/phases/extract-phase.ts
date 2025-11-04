/**
 * Extract phase - Generate Elements.md with characters, places, items
 * Corresponds to --elements flag
 */

import { BasePhase, type PhaseContext, type SubPhaseResult } from './base-phase.js';
import type { BookElement } from '../../types/config.js';
import { estimateTokens, createTokenEstimate, resolveModelConfig } from '../token-counter.js';
import { generateElementsFile } from '../output-generator.js';

export class ExtractPhase extends BasePhase {
  private elements: BookElement[] = [];
  private estimatedTokens: number = 0;
  private estimatedCost: number = 0;

  constructor(context: PhaseContext) {
    super(context, 'extract');
  }

  /**
   * Sub-phase 1: Plan the extraction
   */
  protected async plan(): Promise<SubPhaseResult> {
    const { stateManager, chapters, config, progressTracker } = this.context;

    const state = stateManager.getState();
    if (state.phases.extract.status === 'completed') {
      await progressTracker.log('Elements already extracted', 'info');
      return { success: true, data: { skipExtraction: true } };
    }

    await progressTracker.log('Planning element extraction...', 'info');

    // Combine all chapter content
    const fullText = chapters.map(c => c.content).join('\n\n');

    // Estimate tokens (limit to 50k chars for initial extraction)
    const textToAnalyze = fullText.substring(0, 50000);
    const modelConfig = resolveModelConfig(config.model, config);

    const estimate = createTokenEstimate(
      textToAnalyze,
      2000, // Expected output tokens for element list
      modelConfig,
      config.tokenSafetyMargin
    );

    this.estimatedTokens = estimate.totalTokens;
    this.estimatedCost = estimate.estimatedCost;

    await progressTracker.log(
      `Plan: Extract from ${textToAnalyze.length} chars, ~${estimate.totalTokens.toLocaleString()} tokens, $${estimate.estimatedCost.toFixed(4)}`,
      'info'
    );

    return {
      success: true,
      data: {
        textLength: textToAnalyze.length,
        estimatedTokens: this.estimatedTokens,
        estimatedCost: this.estimatedCost,
      },
    };
  }

  /**
   * Sub-phase 2: Estimate
   */
  protected async estimate(): Promise<SubPhaseResult> {
    const { config, progressTracker, stateManager } = this.context;

    const state = stateManager.getState();
    if (state.phases.extract.status === 'completed') {
      return { success: true };
    }

    const modelConfig = resolveModelConfig(config.model, config);

    await progressTracker.log(
      `Using model: ${modelConfig.name} for element extraction`,
      'info'
    );

    return {
      success: true,
      data: {
        modelSelected: modelConfig.name,
        estimatedCost: this.estimatedCost,
      },
    };
  }

  /**
   * Sub-phase 3: Prepare
   */
  protected async prepare(): Promise<SubPhaseResult> {
    return { success: true };
  }

  /**
   * Sub-phase 4: Execute extraction
   */
  protected async executePhase(): Promise<SubPhaseResult> {
    const { chapters, config, openai, stateManager, progressTracker } = this.context;

    const state = stateManager.getState();
    if (state.phases.extract.status === 'completed') {
      return { success: true };
    }

    await progressTracker.startElementExtraction();

    const fullText = chapters.map(c => c.content).join('\n\n').substring(0, 50000);
    const modelConfig = resolveModelConfig(config.model, config);

    try {
      this.elements = await this.executeWithRetry(
        async () => await this.extractElements(fullText, modelConfig),
        'extract story elements'
      );

      // Update state with elements
      for (const element of this.elements) {
        stateManager.updateElement(element.type, element.name, 'completed');
      }

      const tokensUsed = estimateTokens(fullText) + 2000;
      stateManager.updateTokenStats(tokensUsed);
      await stateManager.save();

      await progressTracker.completeElementExtraction(this.elements.length);

      return { success: true, tokensUsed };
    } catch (error: any) {
      await progressTracker.logError(`Element extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sub-phase 5: Save to Elements.md
   */
  protected async save(): Promise<SubPhaseResult> {
    const { outputDir, stateManager, progressTracker } = this.context;

    if (this.elements.length === 0) {
      // Try to load from state if we didn't extract this time
      const state = stateManager.getState();
      if (state.elements && state.elements.length > 0) {
        // Elements already exist in state, just regenerate the file
        // This would need actual element data, not just metadata
        // For now, skip if we don't have the full data
        return { success: true };
      }
      return { success: true };
    }

    await progressTracker.log('Generating Elements.md...', 'info');

    const state = stateManager.getState();
    const metadata = {
      title: state.bookTitle,
      totalPages: state.totalPages,
    };

    await generateElementsFile(outputDir, metadata, this.elements);

    await progressTracker.log('Elements.md generated', 'success');

    return { success: true };
  }

  /**
   * Extract story elements from text
   */
  private async extractElements(
    fullText: string,
    modelConfig: any
  ): Promise<BookElement[]> {
    const { openai, progressTracker } = this.context;

    // Estimate expected element count based on text length
    const estimatedPages = Math.ceil(fullText.split(/\s+/).length / 300);
    const minExpected = Math.max(15, Math.floor(estimatedPages * 0.08)); // ~8% of pages
    const maxExpected = Math.max(25, Math.floor(estimatedPages * 0.15)); // ~15% of pages

    await progressTracker.log(
      `Expecting ${minExpected}-${maxExpected} story elements based on ${estimatedPages} pages`,
      'info'
    );

    const prompt = `Analyze this book text and extract ALL significant story elements comprehensively.

EXTRACTION TARGETS (for ~${estimatedPages} pages):
- Main characters: 5-10 expected
- Secondary characters (named, with dialogue/actions): 3-8 expected
- Creature types (monsters, magical beings, animals): 5-15 expected
- Key locations (cities, buildings, geographical features): 5-10 expected
- Important items/objects (magical items, weapons, artifacts): 2-5 expected

TOTAL TARGET: ${minExpected}-${maxExpected} elements minimum

REQUIREMENTS:
1. Be comprehensive - extract ALL named entities that appear multiple times
2. Include secondary characters if they have dialogue or significant actions
3. List each distinct creature type (not individual creatures)
4. Include all named locations, even if mentioned briefly
5. Catalog magical/significant items separately from ordinary objects

For each element provide:
1. Type: character/creature/place/item/object
2. Name: The actual name from the text
3. Quotes: 2-3 direct quotes describing this element (verbatim from text)
4. Description: Consolidated 1-2 sentence summary

Text excerpt (${fullText.length} chars):
${fullText}

Return as JSON with an "elements" array. IMPORTANT: Aim for ${minExpected}-${maxExpected} total elements.
{
  "elements": [
    {
      "type": "character",
      "name": "Character Name",
      "quotes": [
        {"text": "direct quote describing them", "page": "estimated page"}
      ],
      "description": "consolidated description"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: typeof modelConfig === 'string' ? modelConfig : modelConfig.name,
      messages: [
        {
          role: 'system',
          content: 'You are a comprehensive literary analyst expert at identifying and cataloging ALL significant story elements. Be thorough and extract all named entities, characters, creatures, places, and items. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    const elements = parsed.elements || [];

    // Log warning if extraction is insufficient
    if (elements.length < minExpected) {
      await progressTracker.log(
        `⚠️ Only ${elements.length} elements extracted (expected ${minExpected}-${maxExpected}). Consider re-running with --force.`,
        'warning'
      );
    } else {
      await progressTracker.log(
        `✓ Extracted ${elements.length} story elements`,
        'success'
      );
    }

    return elements;
  }
}
