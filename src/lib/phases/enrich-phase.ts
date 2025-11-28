/**
 * Enrich phase - Inject element visual details into scene descriptions
 * Corresponds to --enrich flag
 *
 * This phase runs AFTER analyze and extract phases to enrich scene descriptions
 * with detailed visual information from extracted elements (characters, places, items).
 *
 * The enrichment ensures consistency across scenes by:
 * 1. Matching elements mentioned in each scene (via elements_present or regex)
 * 2. Using AI to intelligently blend element visual details into scene descriptions
 * 3. Maintaining narrative flow while adding visual specificity
 *
 * Can be run independently: npx imaginize --enrich
 * Prerequisites: Chapters.md and Elements.md must exist (analyze + extract completed)
 */

import { BasePhase, type PhaseContext, type SubPhaseResult } from './base-phase.js';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import type { ImageConcept, BookElement, IllustrateState } from '../../types/config.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { generateChaptersFile } from '../output-generator.js';
import { resolveModelConfig } from '../token-counter.js';

// Extended ImageConcept with enriched description
interface EnrichedConcept extends ImageConcept {
  enrichedDescription?: string; // AI-enhanced description with element details
  elementsInjected?: string[]; // Which elements were injected
}

export class EnrichPhase extends BasePhase {
  private concepts: EnrichedConcept[] = [];
  private elements: BookElement[] = [];
  private enrichedCount: number = 0;

  constructor(context: PhaseContext) {
    // Use 'enrich' as phase name - will need to extend PhaseStatus type
    super(context, 'enrich' as any);
  }

  /**
   * Sub-phase 1: Plan enrichment
   */
  protected async plan(): Promise<SubPhaseResult> {
    const { progressTracker, stateManager } = this.context;

    await progressTracker.log('Planning enrichment...', 'info');

    // Check prerequisites - need both analyze and extract completed
    const state = stateManager.getState();

    if (state.phases.analyze.status !== 'completed') {
      throw new Error(
        'Cannot enrich: Analyze phase not completed. Run: npx imaginize --text'
      );
    }

    if (state.phases.extract.status !== 'completed') {
      throw new Error(
        'Cannot enrich: Extract phase not completed. Run: npx imaginize --elements'
      );
    }

    // Load concepts from state
    this.concepts = this.loadConceptsFromState(state);

    // Load elements from state
    this.elements = this.loadElementsFromState(state);

    if (this.concepts.length === 0) {
      throw new Error('No scene concepts found. Run analyze phase first.');
    }

    if (this.elements.length === 0) {
      throw new Error('No elements found. Run extract phase first.');
    }

    await progressTracker.log(
      `Plan: Enrich ${this.concepts.length} scenes using ${this.elements.length} elements`,
      'info'
    );

    return {
      success: true,
      data: {
        totalConcepts: this.concepts.length,
        totalElements: this.elements.length,
      },
    };
  }

  /**
   * Load concepts from analyze phase state
   */
  private loadConceptsFromState(state: Readonly<IllustrateState>): EnrichedConcept[] {
    const concepts: EnrichedConcept[] = [];
    const analyzeChapters = state.phases.analyze.chapters || {};

    for (const [chapterKey, chapterState] of Object.entries(analyzeChapters)) {
      if (chapterState.sceneConcepts && Array.isArray(chapterState.sceneConcepts)) {
        for (const concept of chapterState.sceneConcepts) {
          concepts.push({ ...concept });
        }
      }
    }

    return concepts;
  }

  /**
   * Load elements from extract phase state or state.elements
   */
  private loadElementsFromState(state: Readonly<IllustrateState>): BookElement[] {
    // First try state.elements (global element catalog)
    if (state.elements && Array.isArray(state.elements) && state.elements.length > 0) {
      return state.elements;
    }

    // Fallback: collect from extract phase chapters
    const elements: BookElement[] = [];
    const extractChapters = state.phases.extract?.chapters || {};

    for (const chapterState of Object.values(extractChapters)) {
      if (chapterState.elements && Array.isArray(chapterState.elements)) {
        elements.push(...chapterState.elements);
      }
    }

    // Also check analyze phase for unified extraction results
    const analyzeChapters = state.phases.analyze.chapters || {};
    for (const chapterState of Object.values(analyzeChapters)) {
      if (chapterState.elements && Array.isArray(chapterState.elements)) {
        elements.push(...chapterState.elements);
      }
    }

    // Deduplicate by name (case-insensitive)
    const seen = new Set<string>();
    return elements.filter(el => {
      const key = el.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Sub-phase 2: Estimate costs
   */
  protected async estimate(): Promise<SubPhaseResult> {
    const { progressTracker } = this.context;

    // Estimate tokens: ~500 per enrichment call (input scene + elements + output)
    const estimatedTokens = this.concepts.length * 500;
    const estimatedCost = (estimatedTokens / 1000) * 0.0001; // Rough estimate

    await progressTracker.log(
      `Estimate: ~${estimatedTokens.toLocaleString()} tokens, ~$${estimatedCost.toFixed(4)}`,
      'info'
    );

    return { success: true, data: { estimatedTokens, estimatedCost } };
  }

  /**
   * Sub-phase 3: Prepare - build element lookup maps
   */
  protected async prepare(): Promise<SubPhaseResult> {
    const { progressTracker } = this.context;

    await progressTracker.log('Building element lookup tables...', 'info');

    // Log element summary
    const characterCount = this.elements.filter(e => e.type === 'character').length;
    const placeCount = this.elements.filter(e => e.type === 'place').length;
    const itemCount = this.elements.filter(e => e.type === 'item').length;
    const creatureCount = this.elements.filter(e => e.type === 'creature').length;

    await progressTracker.log(
      `Elements: ${characterCount} characters, ${placeCount} places, ${itemCount} items, ${creatureCount} creatures`,
      'info'
    );

    return { success: true };
  }

  /**
   * Sub-phase 4: Execute - enrich each scene description
   */
  protected async executePhase(): Promise<SubPhaseResult> {
    const { openai, progressTracker, config } = this.context;

    await progressTracker.log(
      `Enriching ${this.concepts.length} scene descriptions...`,
      'info'
    );

    // Get model name for logging
    const modelConfig = resolveModelConfig(config.model, config);
    const modelName = typeof modelConfig === 'string' ? modelConfig : modelConfig.name;

    await progressTracker.log(`Using model: ${modelName}`, 'info');

    let enrichedCount = 0;
    let skippedCount = 0;
    let tokensUsed = 0;

    for (let i = 0; i < this.concepts.length; i++) {
      const concept = this.concepts[i];

      // Find elements relevant to this scene
      const relevantElements = this.findRelevantElements(concept);

      if (relevantElements.length === 0) {
        skippedCount++;
        continue; // No elements to inject
      }

      try {
        // Use AI to enrich the description
        const enrichedDescription = await this.enrichSceneWithAI(
          concept,
          relevantElements,
          openai,
          modelName
        );

        if (enrichedDescription && enrichedDescription !== concept.description) {
          concept.enrichedDescription = enrichedDescription;
          concept.elementsInjected = relevantElements.map(e => e.name);
          enrichedCount++;

          // Update progress periodically
          if (enrichedCount % 5 === 0) {
            await progressTracker.log(
              `Progress: ${enrichedCount}/${this.concepts.length} scenes enriched`,
              'info'
            );
          }
        }
      } catch (error: any) {
        await progressTracker.log(
          `Warning: Failed to enrich scene ${i + 1}: ${error.message}`,
          'warning'
        );
      }
    }

    this.enrichedCount = enrichedCount;

    await progressTracker.log(
      `Enrichment complete: ${enrichedCount} scenes enriched, ${skippedCount} skipped (no elements)`,
      'success'
    );

    return {
      success: true,
      data: { enrichedCount, skippedCount, tokensUsed },
    };
  }

  /**
   * Find elements relevant to a scene
   */
  private findRelevantElements(concept: EnrichedConcept): BookElement[] {
    const relevant: BookElement[] = [];
    const seen = new Set<string>();

    // Method 1: Use structured elements_present array (most reliable)
    if (concept.elements_present && Array.isArray(concept.elements_present)) {
      for (const entityName of concept.elements_present) {
        const element = this.findElementByName(entityName);
        if (element && !seen.has(element.name.toLowerCase())) {
          // Only include if element has visual description
          if (element.description && element.description.length > 20) {
            relevant.push(element);
            seen.add(element.name.toLowerCase());
          }
        }
      }
    }

    // Method 2: Regex extraction from description and quote
    const mentionedNames = this.extractMentionedNames(
      `${concept.description} ${concept.quote}`
    );

    for (const name of mentionedNames) {
      const element = this.findElementByName(name);
      if (element && !seen.has(element.name.toLowerCase())) {
        if (element.description && element.description.length > 20) {
          relevant.push(element);
          seen.add(element.name.toLowerCase());
        }
      }
    }

    return relevant;
  }

  /**
   * Find element by name (case-insensitive, handles partial matches)
   */
  private findElementByName(name: string): BookElement | undefined {
    const normalizedName = name.toLowerCase().trim();

    // Exact match first
    let element = this.elements.find(
      e => e.name.toLowerCase() === normalizedName
    );
    if (element) return element;

    // Try without "Dr.", "Mr.", "Mrs." etc.
    const withoutTitle = normalizedName.replace(/^(dr\.|mr\.|mrs\.|ms\.|sir|lord|lady)\s*/i, '');
    element = this.elements.find(
      e => e.name.toLowerCase().includes(withoutTitle) ||
           withoutTitle.includes(e.name.toLowerCase())
    );
    if (element) return element;

    // Try aliases
    element = this.elements.find(e =>
      e.aliases?.some(alias => alias.toLowerCase() === normalizedName)
    );

    return element;
  }

  /**
   * Extract potential element names from text using common patterns
   */
  private extractMentionedNames(text: string): string[] {
    const names: string[] = [];

    // Pattern 1: Capitalized names (FirstName, FirstName LastName)
    const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    let match;
    while ((match = capitalizedPattern.exec(text)) !== null) {
      names.push(match[1]);
    }

    // Pattern 2: Titles followed by names
    const titledPattern = /\b(Dr\.|Mr\.|Mrs\.|Ms\.|Sir|Lord|Lady)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;
    while ((match = titledPattern.exec(text)) !== null) {
      names.push(match[0]); // Include title
      names.push(match[2]); // Also try just the name
    }

    // Pattern 3: "the [Name]" for titled entities
    const thePattern = /the\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
    while ((match = thePattern.exec(text)) !== null) {
      names.push(match[1]);
    }

    // Deduplicate
    return [...new Set(names)];
  }

  /**
   * Filter element description to extract only permanent visual traits
   * Removes scene-specific states like "unconscious", "bleeding", "injured"
   */
  private extractPermanentTraits(element: BookElement): string {
    if (!element.description) return '';

    const description = element.description;

    // Scene-specific state patterns to filter out
    const sceneSpecificPatterns = [
      // Injury/medical states
      /\b(gravely |severely |critically )?(injured|wounded|hurt|bleeding|unconscious|dead|dying|killed)\b/gi,
      /\b(massive |severe |deep )?(wounds?|injuries|cuts?|gashes?|bruises?)\b/gi,
      /\bpulled from (its|the|a) mouth\b/gi,
      /\b(rough|desperate|labored|shallow) breathing\b/gi,
      /\bbleeding (through|from|heavily)\b/gi,
      /\b(visible through|torn|damaged|ripped) (suit|armor|clothing)\b/gi,
      // Emotional states (temporary)
      /\b(currently |now )?(terrified|scared|frightened|panicked|shocked)\b/gi,
      /\b(huddled|cowering|trembling|shaking) (in fear|with fear|on the ground)\b/gi,
      /\bpale (with|from) (fear|terror|shock)\b/gi,
      // Positional states
      /\b(lying|sitting|standing|crouching) (on|in|at)\b/gi,
      /\bfound (unconscious|injured|dead)\b/gi,
    ];

    let filtered = description;

    // Apply filters
    for (const pattern of sceneSpecificPatterns) {
      filtered = filtered.replace(pattern, '');
    }

    // Clean up multiple spaces and punctuation artifacts
    filtered = filtered
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*,/g, ',')
      .replace(/\s*\.\s*\./g, '.')
      .replace(/,\s*\./g, '.')
      .replace(/^\s*[,.]?\s*/, '')
      .replace(/\s*[,.]?\s*$/, '')
      .trim();

    // If we filtered out too much, return a minimal description
    if (filtered.length < 20) {
      // Try to extract just the core identity
      const typeMatch = description.match(/^(A |An )?(human |alien )?(client|scientist|doctor|soldier|guard|construct|creature|robot)/i);
      if (typeMatch) {
        return typeMatch[0];
      }
      return element.type === 'character' ? 'A character' : element.description;
    }

    return filtered;
  }

  /**
   * Get scene-appropriate description for an element
   * Uses the source quote to determine what states are relevant for THIS scene
   */
  private getSceneAppropriateDescription(
    element: BookElement,
    sceneQuote: string,
    sceneDescription: string
  ): string {
    const permanentTraits = this.extractPermanentTraits(element);
    const fullDescription = element.description || '';

    // Check if this scene mentions injury/unconsciousness for this character
    const namePattern = new RegExp(element.name.replace(/^(Dr\.|Mr\.|Mrs\.)\s*/i, ''), 'i');
    const sceneContext = `${sceneQuote} ${sceneDescription}`.toLowerCase();
    const elementNameLower = element.name.toLowerCase().replace(/^(dr\.|mr\.|mrs\.)\s*/i, '');

    // Scene-specific states to check
    const stateChecks = [
      { pattern: /unconscious|limp|unresponsive/i, state: 'unconscious' },
      { pattern: /bleeding|blood|wounded|injured/i, state: 'injured' },
      { pattern: /dead|dying|lifeless/i, state: 'dead' },
      { pattern: /terrified|scared|frightened|panic/i, state: 'frightened' },
      { pattern: /huddled|cowering|trembling/i, state: 'cowering' },
    ];

    // Check if character is mentioned near these states in THIS scene
    const activeStates: string[] = [];
    for (const check of stateChecks) {
      // Look for the state near the character's name in the scene
      const combinedPattern = new RegExp(
        `(${elementNameLower}[^.]*${check.pattern.source}|${check.pattern.source}[^.]*${elementNameLower})`,
        'i'
      );
      if (combinedPattern.test(sceneContext)) {
        activeStates.push(check.state);
      }
    }

    // Build description: permanent traits + scene-relevant states
    let result = permanentTraits;

    if (activeStates.length > 0) {
      // Add back scene-specific details that ARE relevant
      const stateAdditions: string[] = [];

      if (activeStates.includes('unconscious')) {
        stateAdditions.push('currently unconscious');
      }
      if (activeStates.includes('injured')) {
        // Extract injury details from original if present in scene
        const injuryMatch = fullDescription.match(/((massive |severe )?(wounds?|injuries|bleeding)[^,.]*)/i);
        if (injuryMatch) {
          stateAdditions.push(injuryMatch[1].trim());
        } else {
          stateAdditions.push('visibly injured');
        }
      }
      if (activeStates.includes('frightened') || activeStates.includes('cowering')) {
        stateAdditions.push('showing fear');
      }

      if (stateAdditions.length > 0) {
        result += `. In this scene: ${stateAdditions.join(', ')}`;
      }
    }

    return result;
  }

  /**
   * Use AI to intelligently enrich scene description with element details
   */
  private async enrichSceneWithAI(
    concept: EnrichedConcept,
    elements: BookElement[],
    openai: any,
    modelName: string
  ): Promise<string> {
    // Build element context with scene-appropriate filtering
    const elementDescriptions = elements
      .map(e => {
        const appropriateDesc = this.getSceneAppropriateDescription(
          e,
          concept.quote,
          concept.description
        );
        return `- ${e.name} (${e.type}): ${appropriateDesc}`;
      })
      .join('\n');

    const prompt = `You are enriching a scene description for book illustration. Your task is to seamlessly integrate specific visual details about characters and elements into the existing scene description.

ORIGINAL SCENE DESCRIPTION:
${concept.description}

SOURCE TEXT FROM BOOK (use this to understand the scene context):
"${concept.quote}"

ELEMENT VISUAL DETAILS TO INTEGRATE:
${elementDescriptions}

CRITICAL INSTRUCTIONS:
1. Rewrite the scene description to include specific visual details from the elements above
2. For each character mentioned, add their PERMANENT physical appearance details (face, build, clothing, etc.)
3. ONLY include temporary states (injured, frightened, etc.) if they are EXPLICITLY mentioned in the SOURCE TEXT above
4. If a character is described as injured in the element details but NOT in the source text, show them as healthy
5. Maintain the same narrative flow, mood, and composition of the original
6. Keep approximately the same length (can be slightly longer to accommodate details)
7. Do NOT change the core action or setting
8. Do NOT add elements or characters that weren't in the original
9. Use descriptive language that works for illustration prompts

EXAMPLE:
- If source text says "Bharadwaj was taking samples" → show her healthy, working
- If source text says "Bharadwaj was bleeding" → show her injured

CRITICAL: Return ONLY the enriched scene description, no explanations or preamble.

ENRICHED SCENE DESCRIPTION:`;

    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: 'You are a visual description enrichment specialist. You integrate character and element visual details into scene descriptions for book illustration.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3, // Low temperature for consistency
      max_tokens: 800,
    }) as ChatCompletion;

    return response.choices[0]?.message?.content?.trim() || concept.description;
  }

  /**
   * Sub-phase 5: Save - update state and regenerate Chapters.md
   */
  protected async save(): Promise<SubPhaseResult> {
    const { stateManager, progressTracker, outputDir } = this.context;

    await progressTracker.log('Saving enriched descriptions...', 'info');

    // Update state with enriched concepts
    const state = stateManager.getState();
    const analyzeChapters = state.phases.analyze.chapters || {};

    // Map enriched concepts back to chapters
    let conceptIndex = 0;
    for (const [chapterKey, chapterState] of Object.entries(analyzeChapters)) {
      if (chapterState.sceneConcepts && Array.isArray(chapterState.sceneConcepts)) {
        for (let i = 0; i < chapterState.sceneConcepts.length; i++) {
          const enriched = this.concepts[conceptIndex];
          if (enriched?.enrichedDescription) {
            // Update the description with enriched version
            chapterState.sceneConcepts[i] = {
              ...chapterState.sceneConcepts[i],
              description: enriched.enrichedDescription,
              // Keep track of what was injected
              elementsInjected: enriched.elementsInjected,
            } as any;
          }
          conceptIndex++;
        }
      }
    }

    // Save state
    await stateManager.save();

    // Regenerate Chapters.md with enriched descriptions
    await this.regenerateChaptersMd(outputDir);

    await progressTracker.log(
      `✓ Saved ${this.enrichedCount} enriched scene descriptions`,
      'success'
    );
    await progressTracker.log(
      `✓ Regenerated Chapters.md with enriched content`,
      'success'
    );

    return { success: true };
  }

  /**
   * Regenerate Chapters.md from state
   */
  private async regenerateChaptersMd(outputDir: string): Promise<void> {
    const { stateManager } = this.context;
    const state = stateManager.getState();

    // Build concepts array from state
    const allConcepts: ImageConcept[] = [];
    const analyzeChapters = state.phases.analyze.chapters || {};

    for (const chapterState of Object.values(analyzeChapters)) {
      if (chapterState.sceneConcepts) {
        allConcepts.push(...chapterState.sceneConcepts);
      }
    }

    // Generate markdown content
    let markdown = `# Chapters - ${state.bookTitle}\n\n`;
    markdown += `## Visual Scenes by Chapter\n\n`;
    markdown += `Each scene includes exact quotes from the source text for illustration reference.\n\n`;
    markdown += `---\n\n`;

    // Group by chapter
    const byChapter = new Map<string, ImageConcept[]>();
    for (const concept of allConcepts) {
      const chapter = concept.chapter;
      if (!byChapter.has(chapter)) {
        byChapter.set(chapter, []);
      }
      byChapter.get(chapter)!.push(concept);
    }

    // Generate markdown for each chapter
    for (const [chapter, concepts] of byChapter) {
      markdown += `### ${chapter}\n\n`;

      for (let i = 0; i < concepts.length; i++) {
        const c = concepts[i];
        markdown += `#### Scene ${i + 1}\n\n`;
        markdown += `**Pages:** ${c.pageRange}`;
        if (c.lineNumbers) {
          markdown += ` (Lines ${c.lineNumbers.start}-${c.lineNumbers.end})`;
        }
        markdown += `\n\n`;
        markdown += `**Source Text:**\n> ${c.quote}\n\n`;
        markdown += `**Visual Elements:** ${c.description}\n\n`;
        markdown += `---\n\n`;
      }
    }

    // Write to file
    const chaptersPath = join(outputDir, 'Chapters.md');
    await writeFile(chaptersPath, markdown, 'utf-8');
  }
}
