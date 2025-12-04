/**
 * Illustrate phase - Generate images for chapters and elements
 * Corresponds to --images flag
 */

import { BasePhase, type PhaseContext, type SubPhaseResult } from './base-phase.js';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import { resolveModelConfig } from '../token-counter.js';
import type { ImageConcept, BookElement, IllustrateState } from '../../types/config.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { generateChaptersFile } from '../output-generator.js';
import fetch from 'node-fetch';

// DALL-E-3 has a maximum prompt length of 4000 characters
const DALLE_MAX_PROMPT_LENGTH = 4000;
// Reserve space for required elements (style, scene, technical requirements)
const PROMPT_BUFFER = 200;

/**
 * DALL-E-3 safety sanitization patterns
 * Replaces violent/weapon terms with safer alternatives to avoid content policy rejections
 * Ordered from most specific to least specific to prevent double-replacement issues
 */
const DALLE_SAFETY_REPLACEMENTS: Array<[RegExp, string]> = [
  // Specific phrases first (before individual words get replaced)
  [/\btooth-lined\b/gi, 'detailed'],
  [/\bpool of blood\b/gi, 'liquid residue'],
  [/\bbrutal attack\b/gi, 'intense encounter'],
  [/\bbrutal\b/gi, 'intense'],
  [/\bfirefight\b/gi, 'intense standoff'],
  [/\bheavily armed\b/gi, 'well-equipped'],
  [/\bpale flesh\b/gi, 'pale material'],
  [/\braw,?\s*pink(ish)?\s*flesh\b/gi, 'exposed synthetic material'],
  [/\borganic flesh\b/gi, 'organic components'],
  [/\bflesh beneath\b/gi, 'material beneath'],
  [/\bexposed\s+(flesh|skin|organic)\b/gi, 'visible $1 components'],
  [/\btorn\s+flesh\b/gi, 'damaged surface'],
  [/\bflesh\b/gi, 'bio-material'],
  [/\bgrabbed?\s+(\w+\s+)?by\s+the\s+throat\b/gi, 'restrained'],
  [/\bpinned?\s+(him|her|them|it)\s+to\s+the\s+wall\b/gi, 'held $1 against the wall'],
  [/\bpinned?\s+(him|her|them|to)\b/gi, 'restrained $1'],
  [/\bclamped?\s+(around|on)\b/gi, 'held $1'],
  [/\bchoked?\b/gi, 'restrained'],
  [/\bopened?\s+fire\b/gi, 'engaged'],
  [/\bscoring hits\b/gi, 'making contact'],
  [/\btaking hits\b/gi, 'receiving impacts'],

  // Weapons - must come before generic replacements
  [/\b(projectile weapon|projectile weapons)\b/gi, 'handheld device'],
  [/\benergy weapon(s)?\b/gi, 'glowing device$1'],
  [/\b(gun|guns|firearm|firearms)\b/gi, 'device'],
  [/\bweapon(s)?\b/gi, 'equipment'],
  [/\barmed\b/gi, 'equipped'],
  [/\bfiring\b/gi, 'activating'],
  [/\b(fired|fires)\b/gi, 'activates'],
  [/\bshoot(s|ing)?\b/gi, 'activat$1'],
  [/\bshot\b/gi, 'activated'],
  [/\bdischarged?\b/gi, 'activated'],

  // Violence terms
  [/\bviolent\b/gi, 'intense'],
  [/\bviolence\b/gi, 'tension'],
  [/\bkill(s|ed|ing)?\b/gi, 'defeat$1'],
  [/\bdeath\b/gi, 'danger'],
  [/\bdead\b/gi, 'fallen'],
  [/\bdying\b/gi, 'falling'],
  [/\bmurderbot\b/gi, 'Security Unit'], // Book-specific - Murderbot Diaries
  [/\bmurder(s|ed|ing|ous)?\b/gi, 'confront$1'],
  [/\bbloody\b/gi, 'stained'],
  [/\bblood\b/gi, 'fluid'],
  [/\bgore\b/gi, 'damage'],
  [/\bgory\b/gi, 'damaged'],
  [/\bwound(s|ed)?\b/gi, 'injur$1'],
  [/\binjuries\b/gi, 'damage'],
  [/\binjured\b/gi, 'affected'],
  [/\bdesperate\b/gi, 'urgent'],
  [/\bdesparate\b/gi, 'urgent'], // Common misspelling
  [/\bfrantic\b/gi, 'urgent'],
  [/\bpanic(ked)?\b/gi, 'urgent'],
  [/\bterror\b/gi, 'tension'],
  [/\bterrified\b/gi, 'alarmed'],
  [/\bterrifying\b/gi, 'dramatic'],
  [/\bfear\b/gi, 'concern'],
  [/\bscreaming?\b/gi, 'calling'],
  [/\byelling\b/gi, 'calling'],

  // Combat terms
  [/\bcombat\b/gi, 'confrontation'],
  [/\bfight(s|ing)?\b/gi, 'action$1'],
  [/\bbattle(s)?\b/gi, 'encounter$1'],
  [/\battack(s|ed|ing)?\b/gi, 'approach$1'],
  [/\bassault(s|ed|ing)?\b/gi, 'approach$1'],
  [/\bstruggle\b/gi, 'effort'],
  [/\bgrapple(s|d)?\b/gi, 'engage$1'],
  [/\bclaws?\b/gi, 'grips'],
  [/\bslash(es|ed|ing)?\b/gi, 'sweep$1'],
  [/\bstab(s|bed|bing)?\b/gi, 'press$1'],
  [/\bhit(s|ting)?\b/gi, 'contact$1'],
  [/\bpunch(es|ed|ing)?\b/gi, 'push$1'],
  [/\bkick(s|ed|ing)?\b/gi, 'push$1'],

  // Body horror terms
  [/\bnightmarish\b/gi, 'dramatic'],
  [/\bhorrified\b/gi, 'surprised'],
  [/\bhorror\b/gi, 'concern'],
  [/\bgruesome\b/gi, 'striking'],
  [/\bmaw\b/gi, 'opening'],
  [/\bteeth\b/gi, 'structures'],
  [/\btooth\b/gi, 'structure'],
  [/\bfangs?\b/gi, 'protrusions'],
  [/\bmouth\b(?!\s*(of|piece))/gi, 'cavity'],
  [/\bthroat\b/gi, 'interior'],
  [/\bviscera\b/gi, 'internals'],
  [/\bentrails\b/gi, 'internals'],
  [/\bguts\b/gi, 'internals'],
  [/\bintestines?\b/gi, 'internals'],
  [/\bsevered\b/gi, 'separated'],
  [/\bdismember(ed|ment)?\b/gi, 'disassembl$1'],
  [/\bdecapitat(e|ed|ion)?\b/gi, 'separat$1'],
  [/\bmaim(ed|ing)?\b/gi, 'damag$1'],
  [/\bmutilat(e|ed|ion)?\b/gi, 'damag$1'],

  // Aggressive postures and actions
  [/\bgrabbed?\b/gi, 'held'],
  [/\bpinned?\b/gi, 'restrained'],
  [/\bslammed?\b/gi, 'placed firmly'],
  [/\bsmashed?\b/gi, 'pressed'],
  [/\bcrushed?\b/gi, 'pressed'],
  [/\bthrottl(e|ed|ing)?\b/gi, 'restrain$1'],
  [/\bstrangl(e|ed|ing)?\b/gi, 'restrain$1'],

  // Creature/monster terms
  [/\bmonster(s|ous)?\b/gi, 'creature$1'],
  [/\bbeast(s|ly)?\b/gi, 'creature$1'],
  [/\bpredator(s|y)?\b/gi, 'hunter$1'],
  [/\bprey\b/gi, 'target'],
  [/\bhunting\b/gi, 'tracking'],
  [/\bdevour(s|ed|ing)?\b/gi, 'consum$1'],
  [/\bswallow(s|ed|ing)?\b/gi, 'engulf$1'],

  // Security/cyber terms that can trigger false positives
  [/\bhacked?\b/gi, 'modified'],
  [/\bhacking\b/gi, 'modifying'],
  [/\bmalicious\b/gi, 'irregular'],
  [/\binfiltrat(e|ed|ing|ion)?\b/gi, 'enter$1'],
  [/\binternal\s+conflict\b/gi, 'inner tension'],
  [/\bconflict\b/gi, 'tension'],

  // Additional violence terms
  [/\bshov(e|ed|ing)\b/gi, 'push$1'],
  [/\bdrag(ged|ging)?\b/gi, 'pull$1'],
  [/\bjammed?\b/gi, 'stuck'],
  [/\bformidable\b/gi, 'impressive'],
  [/\bferocity\b/gi, 'intensity'],
  [/\bferocious\b/gi, 'intense'],
  [/\bforced?\b/gi, 'moved'],
  [/\bforcing\b/gi, 'moving'],
  [/\bvicious\b/gi, 'strong'],
  [/\bsavage\b/gi, 'wild'],
  [/\blethal\b/gi, 'powerful'],
  [/\bthreat(s|ened|ening)?\b/gi, 'challeng$1'],
  [/\bdanger(ous)?\b/gi, 'challenging'],
  [/\bhazard(ous)?\b/gi, 'challenging'],
  [/\bsubterranean\s+creature\b/gi, 'underground entity'],
  [/\bcreature(s)?\b/gi, 'entity'],

  // Damage descriptions
  [/\bsparking\b/gi, 'glowing'],
  [/\bcrack(s|ed|ing)?\b/gi, 'mark$1'],
  [/\bshatter(s|ed|ing)?\b/gi, 'break$1'],
  [/\bcrumbl(e|ed|ing)?\b/gi, 'wear$1'],
  [/\bruin(s|ed)?\b/gi, 'mark$1'],
  [/\bdestruc(t|tion|tive)?\b/gi, 'intens$1'],
  [/\bdevasta(te|ted|ting|tion)?\b/gi, 'affect$1'],
  [/\bannihilat(e|ed|ing|ion)?\b/gi, 'overcom$1'],
  [/\bobliterat(e|ed|ing|ion)?\b/gi, 'overcom$1'],
];

/**
 * Sanitize prompt text for DALL-E-3 safety compliance
 * Replaces violent/weapon terms with safer alternatives
 */
function sanitizePromptForDalle(text: string): string {
  let sanitized = text;
  for (const [pattern, replacement] of DALLE_SAFETY_REPLACEMENTS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

export class IllustratePhase extends BasePhase {
  private concepts: ImageConcept[] = [];
  private elements: BookElement[] = [];
  private styleGuide: string = '';

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
        'Cannot generate images: Contents.md not found. Run: npx imaginize --text'
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
   * Sub-phase 3: Prepare - Generate style guide
   */
  protected async prepare(): Promise<SubPhaseResult> {
    // Validate image endpoint is configured
    const { imageOpenai, progressTracker, chapters, stateManager } = this.context;

    if (!imageOpenai) {
      await progressTracker.log(
        'Image generation not available (no endpoint configured)',
        'warning'
      );
      return { success: true, data: { skipImages: true } };
    }

    // Generate style guide from book content
    await progressTracker.log('Generating book-wide visual style guide...', 'info');
    this.styleGuide = await this.generateStyleGuide(chapters, stateManager);
    await progressTracker.log(`Style guide created: "${this.styleGuide}"`, 'success');

    return { success: true };
  }

  /**
   * Generate a consistent visual style guide from book content
   */
  private async generateStyleGuide(chapters: any[], stateManager: any): Promise<string> {
    const { openai } = this.context;

    // Sample first 3 chapters for style analysis
    const sampleText = chapters
      .slice(0, 3)
      .map((ch) => ch.content)
      .join('\n\n')
      .substring(0, 8000);

    const state = stateManager.getState();
    const bookTitle = state.bookTitle;

    const prompt = `Analyze this book excerpt and create a concise visual style guide for illustration.

Book: ${bookTitle}

Sample text:
${sampleText}

First, identify the primary genre (e.g., Epic Fantasy, Hard Sci-Fi, Gothic Horror, Contemporary Romance, Mystery Thriller, Historical Fiction, etc.).

Then create a brief style guide (3-4 sentences) covering:
1. Overall visual tone and atmosphere (whimsical, dark, realistic, painterly, etc.)
2. Color palette tendencies
3. Level of detail (realistic vs stylized)
4. Any signature visual elements

Return ONLY the style guide text, starting with "GENRE: [Identified Genre]. " followed by the style guide.

Example: "GENRE: Epic Fantasy. A painterly and atmospheric style with rich, earthy tones..."`;

    // Resolve model config to get model name string
    const modelConfig = resolveModelConfig(this.context.config.model, this.context.config);
    const modelName = typeof modelConfig === 'string' ? modelConfig : modelConfig.name;

    try {
      const response = await openai.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: 'You are a visual style analyst for book illustrations.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500, // Increased from 200 to handle longer responses
      }) as ChatCompletion;

      return (
        response.choices[0]?.message?.content ||
        'Detailed fantasy illustration with rich atmospheric detail.'
      );
    } catch (error) {
      // Fallback to default style guide if API fails (e.g., due to rate limits or token limits)
      console.warn(`Style guide generation failed, using fallback: ${error instanceof Error ? error.message : error}`);
      return `GENRE: Science Fiction. A cinematic, high-contrast illustration style with metallic textures, cool blue and gray tones, dramatic lighting, and detailed technology elements. Focus on tension and atmosphere with realistic human figures.`;
    }
  }

  /**
   * Sub-phase 4: Execute image generation
   */
  protected async executePhase(): Promise<SubPhaseResult> {
    const { progressTracker, imageOpenai, config, outputDir, stateManager } =
      this.context;

    if (!imageOpenai) {
      await progressTracker.log('No image generation endpoint configured', 'warning');
      return { success: true };
    }

    // Load concepts from state
    const state = stateManager.getState();
    await this.loadConceptsFromState(state);

    if (this.concepts.length === 0) {
      await progressTracker.log('No concepts found to generate images for', 'warning');
      return { success: true };
    }

    // Apply limit if specified
    const limit = config.limit ?? undefined;
    const conceptsToProcess =
      limit !== undefined ? this.concepts.slice(0, limit) : this.concepts;

    await progressTracker.log(
      `Generating images for ${conceptsToProcess.length} concepts${limit ? ` (limited from ${this.concepts.length})` : ''}...`,
      'info'
    );

    const imageModel = config.imageEndpoint?.model || 'dall-e-3';
    let generatedCount = 0;

    // Track scene numbers per chapter
    const sceneCounters = new Map<number, number>();

    // Parallel batch processing
    const batchSize = config.maxConcurrency || 3; // Default to 3 parallel requests
    await progressTracker.log(
      `Processing ${conceptsToProcess.length} images in batches of ${batchSize}...`,
      'info'
    );

    for (let i = 0; i < conceptsToProcess.length; i += batchSize) {
      const batch = conceptsToProcess.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(conceptsToProcess.length / batchSize);

      await progressTracker.log(
        `Batch ${batchNum}/${totalBatches}: Processing ${batch.length} images in parallel...`,
        'info'
      );

      // Process batch in parallel
      const batchPromises = batch.map(async (concept) => {
        try {
          await progressTracker.log(
            `⏳ Generating: ${concept.chapter} (${concept.pageRange})`,
            'info'
          );

          // Build prompt from description
          const prompt = this.buildImagePrompt(concept);

          // Debug: Save sanitized prompt to file for inspection
          const debugPath = join(outputDir, `debug_prompt_${concept.chapter.replace(/\s+/g, '_')}.txt`);
          await writeFile(debugPath, `=== Sanitized Prompt for ${concept.chapter} ===\n\n${prompt}\n\n=== Original Description ===\n\n${concept.description || 'N/A'}`);

          // Generate image
          const imageUrl = await this.executeWithRetry(
            async () => await this.generateImage(imageOpenai, prompt, imageModel, config),
            `generate image for ${concept.chapter}`
          );

          if (!imageUrl) {
            throw new Error('Image generation returned no URL');
          }

          // Download image from temporary URL or decode from data URI and save to disk
          const chapterNum =
            concept.chapterNumber || this.getChapterNumber(concept.chapter);

          // Get or initialize scene counter for this chapter (thread-safe increment)
          const sceneNum = (sceneCounters.get(chapterNum) || 0) + 1;
          sceneCounters.set(chapterNum, sceneNum);

          // Determine file extension and get image buffer
          let imageBuffer: Buffer;
          let extension = 'png'; // Default to PNG

          if (imageUrl.startsWith('data:')) {
            // Handle data URI (from Gemini native image generation)
            // Format: data:image/jpeg;base64,/9j/4AAQSkZJRg...
            const matches = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!matches) {
              throw new Error('Invalid data URI format');
            }
            extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
            imageBuffer = Buffer.from(matches[2], 'base64');
          } else {
            // Handle HTTP URL (from OpenAI, OpenRouter, etc.)
            const response = await fetch(imageUrl);
            if (!response.ok) {
              throw new Error(`Failed to download image: ${response.statusText}`);
            }
            imageBuffer = Buffer.from(await response.arrayBuffer());

            // Try to detect format from Content-Type header
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('jpeg') || contentType?.includes('jpg')) {
              extension = 'jpg';
            } else if (contentType?.includes('webp')) {
              extension = 'webp';
            }
          }

          const filename = `chapter_${chapterNum}_scene_${sceneNum}.${extension}`;
          const filepath = join(outputDir, filename);
          await writeFile(filepath, imageBuffer);

          await progressTracker.log(`✅ Saved: ${filename}`, 'success');

          // Update concept with local file path (relative to output dir)
          concept.imageUrl = `./${filename}`;

          // Update state with local image path
          stateManager.updateChapter('illustrate', chapterNum, 'completed', {
            imageUrl: concept.imageUrl,
          });
          await stateManager.save();

          return { success: true, concept };
        } catch (error: any) {
          await progressTracker.log(
            `❌ Failed: ${concept.chapter} - ${error.message}`,
            'error'
          );
          return { success: false, concept, error: error.message };
        }
      });

      // Wait for batch to complete
      const results = await Promise.all(batchPromises);
      const successCount = results.filter((r) => r.success).length;
      generatedCount += successCount;

      await progressTracker.log(
        `Batch ${batchNum}/${totalBatches} complete: ${successCount}/${batch.length} successful`,
        successCount === batch.length ? 'success' : 'warning'
      );
    }

    await progressTracker.log(
      `✓ Generated ${generatedCount}/${conceptsToProcess.length} images successfully`,
      generatedCount === conceptsToProcess.length ? 'success' : 'warning'
    );

    return { success: true, data: { generatedCount } };
  }

  /**
   * Load concepts from analyze phase state (Phase 4 improvement)
   */
  private async loadConceptsFromState(state: Readonly<IllustrateState>): Promise<void> {
    const { outputDir, progressTracker } = this.context;
    const analyzeChapters = state.phases.analyze.chapters || {};

    // Phase 4: Load concepts directly from state (sceneConcepts field)
    const conceptsFromState: ImageConcept[] = [];
    for (const chapterNum in analyzeChapters) {
      const chapterState = analyzeChapters[chapterNum];
      if (chapterState.sceneConcepts && Array.isArray(chapterState.sceneConcepts)) {
        conceptsFromState.push(...chapterState.sceneConcepts);
      }
    }

    if (conceptsFromState.length > 0) {
      // Success! Use concepts from state
      this.concepts = conceptsFromState;
      await progressTracker.log(
        `✓ Loaded ${conceptsFromState.length} scene concepts from state (Phase 2 unified analysis)`,
        'success'
      );
    } else {
      // Fallback: Parse Chapters.md if state doesn't have sceneConcepts
      await progressTracker.log(
        '⚠️ No scene concepts in state, falling back to parsing Chapters.md',
        'warning'
      );
      try {
        const chaptersPath = join(outputDir, 'Chapters.md');
        const chaptersContent = await readFile(chaptersPath, 'utf-8');
        this.concepts = this.parseChaptersFile(chaptersContent);
        await progressTracker.log(
          `Loaded ${this.concepts.length} concepts from Chapters.md`,
          'info'
        );
      } catch (error) {
        await progressTracker.log(
          'Failed to load concepts from Chapters.md - file may not exist',
          'warning'
        );
      }
    }

    // Load elements from state (Phase 3 improvement)
    if (state.elements && Array.isArray(state.elements)) {
      this.elements = state.elements;
      await progressTracker.log(
        `✓ Loaded ${this.elements.length} elements from state for cross-referencing`,
        'info'
      );
    } else {
      // Fallback: Parse Elements.md
      try {
        const elementsPath = join(outputDir, 'Elements.md');
        if (existsSync(elementsPath)) {
          const elementsContent = await readFile(elementsPath, 'utf-8');
          this.elements = this.parseElementsFile(elementsContent);
          await progressTracker.log(
            `Loaded ${this.elements.length} elements from Elements.md`,
            'info'
          );
        }
      } catch (error) {
        // Elements.md doesn't exist, cross-referencing not available
      }
    }
  }

  /**
   * Parse Chapters.md to extract concepts
   */
  private parseChaptersFile(content: string): ImageConcept[] {
    const concepts: ImageConcept[] = [];

    // Get chapter number mapping from state TOC
    const state = this.context.stateManager.getState();
    const toc = state.toc?.chapters || [];
    const chapterTitleToNumber = new Map<string, number>();
    toc.forEach((ch) => chapterTitleToNumber.set(ch.title, ch.number));

    // Split content by chapter headers (### Chapter Name)
    const chapterSections = content.split(/(?=###\s+(?!Scene\s+\d+)[^\n]+)/);

    for (const section of chapterSections) {
      if (!section.trim()) continue;

      // Extract chapter title from first ### header (not a Scene header)
      const chapterHeaderMatch = section.match(/^###\s+(?!Scene\s+\d+)(.+?)$/m);
      if (!chapterHeaderMatch) continue;

      const chapterTitle = chapterHeaderMatch[1];
      let chapterNum = chapterTitleToNumber.get(chapterTitle);

      // Fallback: extract chapter number from title if Map lookup fails
      // Handles patterns like "Chapter 5", "Chapter Five", "5. Title"
      if (chapterNum === undefined) {
        const numMatch = chapterTitle.match(/(?:chapter\s+)?(\d+)/i);
        if (numMatch) {
          chapterNum = parseInt(numMatch[1], 10);
        } else {
          // Last resort: use sequential numbering based on unique chapters seen
          const uniqueChapters = new Set(concepts.map((c) => c.chapter));
          chapterNum = uniqueChapters.size + 1;
        }
      }

      // Now find all scenes within this chapter section
      const sceneRegex =
        /#### Scene \d+\n\n\*\*Pages:\*\* (.+?)\n\n\*\*Source Text:\*\*\n> (.+?)\n\n\*\*Visual Elements:\*\* (.+?)(?=\n\n---|$)/gs;

      let sceneMatch;
      while ((sceneMatch = sceneRegex.exec(section)) !== null) {
        concepts.push({
          chapter: chapterTitle,
          chapterNumber: chapterNum, // Use the same chapter number for all scenes
          pageRange: sceneMatch[1],
          quote: sceneMatch[2].replace(/\n> /g, ' '),
          description: sceneMatch[3],
        });
      }
    }

    return concepts;
  }

  /**
   * Parse Elements.md to extract element definitions
   */
  private parseElementsFile(content: string): BookElement[] {
    const elements: BookElement[] = [];

    // Match each element section (#### Name)
    const elementRegex =
      /#### (.+?)\n\n\*\*Description:\*\* (.+?)\n\n\*\*Reference Quotes:\*\*/gs;

    let match;
    while ((match = elementRegex.exec(content)) !== null) {
      const name = match[1];
      const description = match[2];

      // Determine type from section headers
      let type: BookElement['type'] = 'object';
      const beforeElement = content.substring(0, match.index);
      if (
        beforeElement.includes('### Characters') &&
        !beforeElement.includes('### Creatures')
      ) {
        type = 'character';
      } else if (beforeElement.includes('### Creatures')) {
        type = 'creature';
      } else if (beforeElement.includes('### Places')) {
        type = 'place';
      } else if (
        beforeElement.includes('### Items') ||
        beforeElement.includes('### Objects')
      ) {
        type = 'item';
      }

      elements.push({
        type,
        name,
        description,
        quotes: [], // We don't need quotes for cross-referencing prompts
      });
    }

    return elements;
  }

  /**
   * Build image prompt from concept with element cross-referencing and style guide
   * Ensures prompt stays within DALL-E-3's 4000 character limit
   */
  private buildImagePrompt(concept: ImageConcept): string {
    const maxLength = DALLE_MAX_PROMPT_LENGTH - PROMPT_BUFFER;

    // Required parts (always included, may be truncated)
    const technicalReqs = '\nTECHNICAL: Cinematic composition, detailed illustration, high-quality art\nCRITICAL: No text, letters, words, or writing in the image';
    const technicalLen = technicalReqs.length;

    // Style guide - sanitize and truncate if too long (max 400 chars)
    let styleSection = '';
    if (this.styleGuide) {
      // Apply DALL-E-3 safety sanitization to style guide as well
      styleSection = sanitizePromptForDalle(this.styleGuide);
      styleSection = this.truncateText(styleSection, 400);
    } else {
      styleSection = 'GENRE: Detailed illustration with atmospheric detail';
    }

    // Mood and lighting (compact)
    let moodLighting = '';
    if (concept.mood) {
      moodLighting += `MOOD: ${concept.mood}. `;
    }
    if (concept.lighting) {
      moodLighting += `LIGHTING: ${concept.lighting}.`;
    }
    moodLighting = this.truncateText(moodLighting, 150);

    // Scene description - the most important part
    // Calculate available space for scene after other parts
    const fixedPartsLen = styleSection.length + moodLighting.length + technicalLen + 50; // 50 for labels/newlines
    const elementBudget = 600; // Reserve for element descriptions
    const sceneMaxLen = maxLength - fixedPartsLen - elementBudget;

    let sceneDescription = concept.description || '';
    // Apply DALL-E-3 safety sanitization to avoid content policy rejections
    sceneDescription = sanitizePromptForDalle(sceneDescription);
    sceneDescription = this.truncateText(sceneDescription, Math.max(sceneMaxLen, 500));

    // Build base prompt
    let prompt = styleSection;
    if (moodLighting) {
      prompt += '\n' + moodLighting;
    }
    prompt += `\nSCENE: ${sceneDescription}`;

    // Add element details if space allows
    const currentLen = prompt.length + technicalLen;
    const remainingBudget = maxLength - currentLen - 50;

    if (remainingBudget > 100 && this.elements.length > 0) {
      const elementDescriptions = this.buildElementSection(concept, remainingBudget);
      if (elementDescriptions) {
        prompt += elementDescriptions;
      }
    }

    // Add technical requirements
    prompt += technicalReqs;

    // Final safety check - hard truncate if still over
    if (prompt.length > DALLE_MAX_PROMPT_LENGTH) {
      prompt = prompt.substring(0, DALLE_MAX_PROMPT_LENGTH - 3) + '...';
    }

    return prompt;
  }

  /**
   * Build element section within budget
   */
  private buildElementSection(concept: ImageConcept, maxLen: number): string {
    const referencedElements: string[] = [];

    // Get entity names from elements_present or extract from text
    const entityNames = concept.elements_present && concept.elements_present.length > 0
      ? concept.elements_present
      : this.extractEntityNames(concept.description || '', concept.quote || '');

    for (const entityName of entityNames) {
      const element = this.findElement(entityName);
      if (element && element.description) {
        // Sanitize and truncate each element description to 150 chars
        const sanitizedDesc = sanitizePromptForDalle(element.description);
        const shortDesc = this.truncateText(sanitizedDesc, 150);
        referencedElements.push(`- ${element.name}: ${shortDesc}`);
      }
    }

    if (referencedElements.length === 0) {
      return '';
    }

    // Build section and truncate to budget
    let section = '\nELEMENTS:\n' + referencedElements.join('\n');
    if (section.length > maxLen) {
      // Remove elements from end until it fits
      while (section.length > maxLen && referencedElements.length > 1) {
        referencedElements.pop();
        section = '\nELEMENTS:\n' + referencedElements.join('\n');
      }
      // If still too long, truncate the remaining
      if (section.length > maxLen) {
        section = section.substring(0, maxLen - 3) + '...';
      }
    }

    return section;
  }

  /**
   * Truncate text to maxLen, preserving word boundaries when possible
   */
  private truncateText(text: string, maxLen: number): string {
    if (!text || text.length <= maxLen) {
      return text;
    }

    // Try to cut at sentence boundary
    const truncated = text.substring(0, maxLen - 3);
    const lastPeriod = truncated.lastIndexOf('. ');
    if (lastPeriod > maxLen * 0.6) {
      return truncated.substring(0, lastPeriod + 1);
    }

    // Cut at word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLen * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Extract entity names from description and quote
   */
  private extractEntityNames(description: string, quote: string): string[] {
    const entities = new Set<string>();

    // Common proper noun patterns and capitalized words
    const text = `${description} ${quote}`;

    // Extract capitalized words (potential entity names)
    const capitalizedWords = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];

    for (const word of capitalizedWords) {
      // Skip common non-entity words
      const skipWords = [
        'The',
        'A',
        'An',
        'She',
        'He',
        'It',
        'They',
        'When',
        'Where',
        'What',
        'How',
        'Why',
      ];
      if (!skipWords.includes(word)) {
        entities.add(word);
      }
    }

    return Array.from(entities);
  }

  /**
   * Find element by name (fuzzy matching)
   */
  private findElement(entityName: string): BookElement | undefined {
    // Exact match
    let element = this.elements.find((e) => e.name === entityName);
    if (element) return element;

    // Case-insensitive match
    element = this.elements.find(
      (e) => e.name.toLowerCase() === entityName.toLowerCase()
    );
    if (element) return element;

    // Partial match (entity name contains element name or vice versa)
    element = this.elements.find(
      (e) =>
        e.name.toLowerCase().includes(entityName.toLowerCase()) ||
        entityName.toLowerCase().includes(e.name.toLowerCase())
    );

    return element;
  }

  /**
   * Generate image using best available API
   * Supports: OpenRouter image models, gpt-image-1, Gemini Imagen, dall-e-3
   */
  private async generateImage(
    imageOpenai: any,
    prompt: string,
    model: string | any,
    config: any
  ): Promise<string> {
    const size = config.imageSize || '1024x1024';
    const { progressTracker } = this.context;

    // Determine which model to use - prioritize config.imageModel, then model param, then default
    const imageModel = config.imageModel || (typeof model === 'string' ? model : model?.model) || 'dall-e-3';
    await progressTracker.log(`Using image model: ${imageModel}`, 'info');

    // Try OpenRouter image models (via chat completions)
    if (imageModel.includes('google/') && imageModel.includes('image')) {
      try {
        await progressTracker.log(`Trying OpenRouter model: ${imageModel}`, 'info');
        const url = await this.generateOpenRouterImage(
          imageOpenai,
          prompt,
          imageModel,
          size
        );
        if (url) {
          await progressTracker.log(`Using OpenRouter ${imageModel}`, 'info');
          return url;
        }
      } catch (error: any) {
        await progressTracker.log(
          `OpenRouter ${imageModel} failed (${error.message}), falling back`,
          'warning'
        );
      }
    }

    // Try gpt-image-1 (if configured)
    if (imageModel === 'gpt-image-1') {
      try {
        // gpt-image-1 quality: 'low', 'medium', 'high', 'auto'
        const qualityMap: Record<string, string> = {
          standard: 'medium',
          hd: 'high',
        };
        const quality = qualityMap[config.imageQuality || 'standard'] || 'high';

        const response = await imageOpenai.images.generate({
          model: 'gpt-image-1',
          prompt: prompt,
          n: 1,
          size: size,
          quality: quality,
        });

        const url = response.data?.[0]?.url;
        if (url) {
          await progressTracker.log('Using gpt-image-1', 'info');
          return url;
        }

        // No URL returned - fall back
        await progressTracker.log(
          'gpt-image-1 returned no URL, falling back to dall-e-3',
          'warning'
        );
      } catch (error: any) {
        await progressTracker.log(
          `gpt-image-1 failed (${error.message}), falling back to dall-e-3`,
          'warning'
        );
      }
    }

    // Try Gemini native image generation (Nano Banana models)
    // gemini-flash-image = gemini-2.0-flash-exp-image-generation (fast)
    // gemini-pro-image = gemini-2.0-flash-preview-image-generation (pro, 4K support)
    const isGeminiNative =
      imageModel === 'gemini-flash-image' ||
      imageModel === 'gemini-2.5-flash-image' ||
      imageModel === 'gemini-pro-image' ||
      imageModel === 'gemini-2.0-flash-preview-image-generation';

    if (isGeminiNative) {
      try {
        const geminiApiKey = (config as any).geminiApiKey;
        if (!geminiApiKey) {
          await progressTracker.log(
            'Gemini API key not found, skipping Gemini native image generation',
            'warning'
          );
        } else {
          // Determine which model to use
          const isPro =
            imageModel === 'gemini-pro-image' ||
            imageModel === 'gemini-2.0-flash-preview-image-generation';
          const url = await this.generateGeminiNativeImage(prompt, geminiApiKey, isPro);
          if (url) {
            const modelName = isPro ? 'Gemini Pro Image (Nano Banana Pro)' : 'Gemini Flash Image';
            await progressTracker.log(`Using ${modelName}`, 'info');
            return url;
          }
        }
      } catch (error: any) {
        await progressTracker.log(
          `Gemini native image failed (${error.message}), falling back to dall-e-3`,
          'warning'
        );
      }
    }

    // Try Gemini Imagen (if configured) - requires paid Blaze plan
    if (imageModel.includes('imagen')) {
      try {
        const geminiApiKey = (config as any).geminiApiKey;
        if (!geminiApiKey) {
          await progressTracker.log(
            'Gemini API key not found, skipping Imagen',
            'warning'
          );
        } else {
          const url = await this.generateImagenImage(prompt, geminiApiKey);
          if (url) {
            await progressTracker.log(`Using Gemini ${imageModel}`, 'info');
            return url;
          }
        }
      } catch (error: any) {
        await progressTracker.log(
          `Gemini Imagen failed (${error.message}), falling back to dall-e-3`,
          'warning'
        );
      }
    }

    // Fallback to dall-e-3
    const quality = config.imageQuality || 'standard';

    const response = await imageOpenai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: size,
      quality: quality,
    });

    await progressTracker.log('Using dall-e-3', 'info');
    return response.data[0].url;
  }

  /**
   * Generate image using Google Gemini Imagen
   */
  private async generateImagenImage(prompt: string, apiKey: string): Promise<string> {
    const { progressTracker } = this.context;

    // Use Imagen via Google AI API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [
            {
              prompt: prompt,
            },
          ],
          parameters: {
            sampleCount: 1,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Imagen API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as any;

    // Extract base64 image and convert to URL
    if (data.predictions && data.predictions[0]?.bytesBase64Encoded) {
      const base64 = data.predictions[0].bytesBase64Encoded;
      return `data:image/png;base64,${base64}`;
    }

    throw new Error('No image data returned from Imagen');
  }

  /**
   * Generate image using Gemini native image generation models (Nano Banana)
   * Uses generateContent endpoint with image response modality
   * Docs: https://ai.google.dev/gemini-api/docs/image-generation
   *
   * @param prompt - Image generation prompt
   * @param apiKey - Gemini API key
   * @param isPro - Use Pro model (gemini-3-pro-image-preview) for higher quality
   */
  private async generateGeminiNativeImage(
    prompt: string,
    apiKey: string,
    isPro: boolean = false
  ): Promise<string> {
    // Model selection:
    // - Flash: gemini-2.0-flash-exp-image-generation (fast, standard quality)
    // - Pro: gemini-3-pro-image-preview (slower, 4K support, better quality)
    const modelName = isPro
      ? 'gemini-3-pro-image-preview'
      : 'gemini-2.0-flash-exp-image-generation';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Generate an image: ${prompt}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini native image API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as any;

    // Extract base64 image from response
    // Response format: { candidates: [{ content: { parts: [{ inlineData: { data, mimeType } }] } }] }
    const parts = data.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          return `data:${mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    throw new Error('No image data returned from Gemini native image');
  }

  /**
   * Generate image using OpenRouter (via chat completions API)
   * Docs: https://openrouter.ai/docs/features/multimodal/image-generation
   */
  private async generateOpenRouterImage(
    openai: any,
    prompt: string,
    model: string,
    size: string
  ): Promise<string> {
    const { progressTracker } = this.context;

    // Parse size for aspect ratio (e.g., "1024x1024" -> "1:1")
    const aspectRatio =
      size === '1024x1792' ? '9:16' : size === '1792x1024' ? '16:9' : '1:1';

    // OpenRouter image models require modalities parameter
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      modalities: ['image', 'text'], // Required for image generation
      image_config: {
        aspect_ratio: aspectRatio,
      },
    }) as ChatCompletion;

    // Images returned in message.images array
          // @ts-expect-error - DALL-E specific response format
    const images = response.choices[0]?.message?.images;
    if (images && images.length > 0) {
      const imageUrl = images[0]?.image_url?.url;
      if (imageUrl) {
        return imageUrl; // Returns data:image/png;base64,...
      }
    }

    throw new Error('No image data in OpenRouter response');
  }

  /**
   * Extract chapter number from chapter title
   */
  private getChapterNumber(chapterTitle: string): number {
    // Try to extract number from title like "Chapter 10: Title"
    const match = chapterTitle.match(/^Chapter (\d+)/i);
    if (match) {
      return parseInt(match[1]);
    }
    // Default to 1 if no number found
    return 1;
  }

  /**
   * Sub-phase 5: Save image URLs to Chapters.md
   */
  protected async save(): Promise<SubPhaseResult> {
    const { outputDir, stateManager, progressTracker } = this.context;

    if (this.concepts.length === 0) {
      return { success: true };
    }

    // Group concepts by chapter for regeneration
    const conceptsByChapter = new Map<string, ImageConcept[]>();
    for (const concept of this.concepts) {
      if (!conceptsByChapter.has(concept.chapter)) {
        conceptsByChapter.set(concept.chapter, []);
      }
      conceptsByChapter.get(concept.chapter)!.push(concept);
    }

    // Regenerate Chapters.md with image URLs
    await progressTracker.log('Updating Chapters.md with image URLs...', 'info');

    const state = stateManager.getState();
    const metadata = {
      title: state.bookTitle,
      totalPages: state.totalPages,
    };

    await generateChaptersFile(outputDir, metadata, conceptsByChapter);

    await progressTracker.log('Chapters.md updated with image URLs', 'success');

    return { success: true };
  }
}
