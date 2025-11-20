# Context Management & Scene Cross-Reference System

**Status:** In Implementation
**Priority:** Critical
**Last Updated:** 2025-11-20
**Code Review Date:** 2025-11-20 (Gemini 2.5 Pro)

## Overview

The Context Management System ensures visual consistency across all generated scenes by maintaining a centralized catalog of story elements (characters, places, items) and injecting relevant context into each scene analysis prompt. This system is fundamental to producing a coherent illustrated book where characters appear consistently across all scenes.

## System Architecture

### Phase Flow (Corrected)

```
┌─────────────────────────────────────────────────────────────┐
│                        Parse Phase                           │
│  Extract chapters, page numbers, structure from book file   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      Extract Phase                           │
│  • Process each chapter iteratively                          │
│  • Extract characters, places, items with descriptions       │
│  • Normalize and merge with existing catalog                 │
│  • Accumulate enriched descriptions progressively            │
│  • Output: Elements.md (comprehensive catalog)               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      Analyze Phase                           │
│  • Load element catalog from StateManager                    │
│  • For each chapter:                                         │
│    - Inject relevant element context into prompt             │
│    - Identify visual scenes with element consistency         │
│    - Generate scene descriptions referencing known elements  │
│  • Output: Chapters.md (scene descriptions with context)     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Illustrate Phase                          │
│  • Generate images using scene descriptions                  │
│  • Element descriptions ensure visual consistency            │
└─────────────────────────────────────────────────────────────┘
```

**CRITICAL:** Extract phase MUST execute before Analyze phase to ensure element context is available.

## Core Components

### 1. Element Extraction System

**File:** `src/lib/ai-analyzer.ts:97`
**Current Status:** ❌ Broken - Single full-text extraction
**Target Status:** ✅ Iterative chapter-by-chapter extraction

#### Current Issues

- Processes entire book in single API call (expensive, limited by context window)
- Truncates at 50,000 characters (loses end of book)
- No mechanism to enrich descriptions as story progresses
- Cannot handle books longer than model context windows

#### Redesign: Iterative Element Extraction

```typescript
/**
 * Extract and enrich story elements chapter-by-chapter
 *
 * Benefits:
 * - Dramatically reduced token costs (process in chunks)
 * - No context window limitations
 * - Progressive description enrichment
 * - More accurate element catalog
 */
async function extractElementsIterative(
  chapters: ChapterContent[],
  config: Required<IllustrateConfig>,
  openai: OpenAI,
  stateManager: StateManager
): Promise<StoryElement[]> {
  const elementCatalog: Map<string, StoryElement> = new Map();

  // Load existing elements from state
  const existingElements = stateManager.getState().elements || [];
  for (const element of existingElements) {
    elementCatalog.set(element.name.toLowerCase(), element);
  }

  for (const chapter of chapters) {
    console.log(`Extracting elements from Chapter ${chapter.number}...`);

    // Extract elements from this chapter
    const chapterElements = await extractElementsFromChapter(
      chapter,
      config,
      openai
    );

    // Normalize and merge with catalog
    for (const newElement of chapterElements) {
      await mergeElementIntoCatalog(
        newElement,
        elementCatalog,
        config,
        openai
      );
    }

    // Update state after each chapter
    stateManager.updateElements(Array.from(elementCatalog.values()));
  }

  return Array.from(elementCatalog.values());
}

/**
 * Extract elements from a single chapter
 */
async function extractElementsFromChapter(
  chapter: ChapterContent,
  config: Required<IllustrateConfig>,
  openai: OpenAI
): Promise<StoryElement[]> {
  const prompt = `Analyze this chapter and extract all important story elements.

Chapter ${chapter.number}: ${chapter.title}

${chapter.content}

Extract:
- Characters: Name, physical description, distinctive features
- Places: Name, visual description, atmosphere
- Items: Name, appearance, significance

Return as JSON array with format:
{
  "elements": [
    {"type": "character", "name": "...", "description": "...", "quotes": ["..."]},
    {"type": "place", "name": "...", "description": "...", "quotes": ["..."]},
    {"type": "item", "name": "...", "description": "...", "quotes": ["..."]}
  ]
}`;

  const response = await openai.chat.completions.create({
    model: config.textModel,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response from API');

  const data = JSON.parse(content);
  return data.elements || [];
}
```

### 2. Element Normalization & Merging

**File:** `src/lib/state-manager.ts:170`
**Current Status:** ❌ Simple case-insensitive matching
**Target Status:** ✅ LLM-based entity resolution

#### Current Issues

- Cannot handle aliases ("Dr. Jekyll" vs "Mr. Hyde")
- Cannot handle variants ("Jon Snow" vs "John Snow")
- Cannot handle titles ("The Dark Lord" vs "Voldemort")
- Creates duplicate entries
- Breaks cross-referencing

#### Redesign: LLM-Based Entity Resolution

```typescript
/**
 * Merge new element into catalog with LLM-based entity resolution
 *
 * Features:
 * - Semantic matching for aliases and variants
 * - Description enrichment (append new details)
 * - Quote accumulation across chapters
 * - Alias tracking for cross-referencing
 */
async function mergeElementIntoCatalog(
  newElement: StoryElement,
  catalog: Map<string, StoryElement>,
  config: Required<IllustrateConfig>,
  openai: OpenAI
): Promise<void> {
  const existingElements = Array.from(catalog.values())
    .filter(e => e.type === newElement.type);

  if (existingElements.length === 0) {
    // First occurrence - add to catalog
    catalog.set(newElement.name.toLowerCase(), newElement);
    return;
  }

  // Use LLM to check for entity matches
  const prompt = `Does the new element refer to an existing element?

New Element:
- Type: ${newElement.type}
- Name: "${newElement.name}"
- Description: "${newElement.description}"

Existing Elements:
${existingElements.map((e, i) => `${i + 1}. "${e.name}" - ${e.description}`).join('\n')}

Question: Is the new element the same as any existing element (accounting for aliases, nicknames, titles)?

Return JSON:
{
  "is_match": true/false,
  "matched_index": <number or null>,
  "confidence": <0-1>,
  "reasoning": "..."
}`;

  const response = await openai.chat.completions.create({
    model: config.textModel,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response from API');

  const result = JSON.parse(content);

  if (result.is_match && result.confidence > 0.7 && result.matched_index !== null) {
    // Merge with existing element
    const existingElement = existingElements[result.matched_index];
    const key = existingElement.name.toLowerCase();
    const merged = catalog.get(key)!;

    // Track alias
    if (!merged.aliases) merged.aliases = [];
    if (!merged.aliases.includes(newElement.name)) {
      merged.aliases.push(newElement.name);
    }

    // Enrich description (append new details)
    merged.description = enrichDescription(
      merged.description,
      newElement.description
    );

    // Accumulate quotes
    if (!merged.quotes) merged.quotes = [];
    if (newElement.quotes) {
      merged.quotes.push(...newElement.quotes);
    }

    catalog.set(key, merged);
  } else {
    // New unique element
    catalog.set(newElement.name.toLowerCase(), newElement);
  }
}

/**
 * Enrich existing description with new details
 * Avoid redundancy while preserving unique information
 */
function enrichDescription(existing: string, additional: string): string {
  if (!additional || additional === existing) return existing;

  // Simple enrichment - in production, could use LLM to merge intelligently
  return `${existing}. Additional details: ${additional}`;
}
```

### 3. Context Injection System

**File:** `src/lib/ai-analyzer.ts:17`
**Current Status:** ❌ No context parameter
**Target Status:** ✅ Element context injection

#### Current Issues

- `analyzeChapter()` cannot receive element descriptions
- Template system expects context but receives none
- No cross-scene consistency mechanism

#### Redesign: Context-Aware Scene Analysis

```typescript
/**
 * Analyze chapter with element context for visual consistency
 *
 * @param chapter - Chapter content to analyze
 * @param config - Configuration
 * @param openai - OpenAI client
 * @param elementContext - Previously extracted elements for context injection
 */
export async function analyzeChapter(
  chapter: ChapterContent,
  config: Required<IllustrateConfig>,
  openai: OpenAI,
  elementContext?: ElementContext
): Promise<ImageConcept[]> {
  // Calculate images needed
  const [startPage, endPage] = chapter.pageRange.split('-').map(Number);
  const pageCount = (endPage && startPage) ? (endPage - startPage + 1) : 1;
  const numImages = Math.max(1, Math.ceil(pageCount / config.pagesPerImage));

  // Format element context for prompt injection
  const contextString = formatElementContext(elementContext);

  // Load and render template with element context
  const template = config.analyzeTemplate || DEFAULT_ANALYZE_TEMPLATE;
  const prompt = template
    .replace(/{{chapterNumber}}/g, chapter.number.toString())
    .replace(/{{chapterTitle}}/g, chapter.title)
    .replace(/{{chapterContent}}/g, chapter.content)
    .replace(/{{numImages}}/g, numImages.toString())
    .replace(/{{styleGuide}}/g, config.styleGuide || 'realistic, detailed')
    .replace(/{{characters}}/g, elementContext?.characters || '')
    .replace(/{{places}}/g, elementContext?.places || '')
    .replace(/{{items}}/g, elementContext?.items || '');

  // API call with context-enriched prompt
  const response = await openai.chat.completions.create({
    model: config.textModel,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response from API');

  return parseImageConcepts(content);
}

/**
 * Format element catalog for context injection
 */
function formatElementContext(context?: ElementContext): string {
  if (!context) return '';

  const parts: string[] = [];

  if (context.characters) {
    parts.push(`CHARACTERS:\n${context.characters}`);
  }
  if (context.places) {
    parts.push(`PLACES:\n${context.places}`);
  }
  if (context.items) {
    parts.push(`ITEMS:\n${context.items}`);
  }

  return parts.join('\n\n');
}

interface ElementContext {
  characters?: string;
  places?: string;
  items?: string;
}
```

### 4. Phase Orchestration

**File:** `src/index.ts:873`
**Current Status:** ❌ Wrong order (analyze before extract)
**Target Status:** ✅ Correct order (extract before analyze)

#### Fix Implementation

```typescript
// BEFORE (WRONG ORDER):
if (needsText) {
  console.log(chalk.cyan('📝 Phase: Analyze (--text)\n'));
  progressTracker.setPhase('analyze');
  const analyzePhase = useConcurrent
    ? new AnalyzePhaseV2(context)
    : new AnalyzePhase(context);
  await analyzePhase.execute();
  console.log('');
}

if (needsElements) {
  console.log(chalk.cyan('🔍 Phase: Extract (--elements)\n'));
  progressTracker.setPhase('extract');
  const extractPhase = new ExtractPhase(context);
  await extractPhase.execute();
  console.log('');
}

// AFTER (CORRECT ORDER):
if (needsElements) {
  console.log(chalk.cyan('🔍 Phase: Extract (--elements)\n'));
  progressTracker.setPhase('extract');
  const extractPhase = new ExtractPhase(context);
  await extractPhase.execute();
  console.log('');
}

if (needsText) {
  console.log(chalk.cyan('📝 Phase: Analyze (--text)\n'));
  progressTracker.setPhase('analyze');

  // Load extracted elements for context injection
  const elements = context.stateManager.getState().elements || [];
  const elementContext = prepareElementContext(elements);

  const analyzePhase = useConcurrent
    ? new AnalyzePhaseV2(context, elementContext)
    : new AnalyzePhase(context, elementContext);
  await analyzePhase.execute();
  console.log('');
}

/**
 * Prepare element context for scene analysis
 */
function prepareElementContext(elements: StoryElement[]): ElementContext {
  const characters = elements
    .filter(e => e.type === 'character')
    .map(e => `- ${e.name}: ${e.description}`)
    .join('\n');

  const places = elements
    .filter(e => e.type === 'place')
    .map(e => `- ${e.name}: ${e.description}`)
    .join('\n');

  const items = elements
    .filter(e => e.type === 'item')
    .map(e => `- ${e.name}: ${e.description}`)
    .join('\n');

  return { characters, places, items };
}
```

## Configuration Options

### New Config Parameters

```typescript
interface IllustrateConfig {
  // ... existing options ...

  /**
   * Maximum characters for element extraction per chunk
   * Default: 50000
   */
  maxExtractionChars?: number;

  /**
   * Enable iterative element extraction (recommended)
   * Default: true
   */
  iterativeExtraction?: boolean;

  /**
   * Enable LLM-based element normalization
   * Default: true
   */
  smartElementMerging?: boolean;

  /**
   * Confidence threshold for entity matching (0-1)
   * Default: 0.7
   */
  entityMatchConfidence?: number;
}
```

### .imaginize.config Example

```json
{
  "textModel": "gpt-4o",
  "imageModel": "dall-e-3",
  "maxExtractionChars": 100000,
  "iterativeExtraction": true,
  "smartElementMerging": true,
  "entityMatchConfidence": 0.7,
  "styleGuide": "Consistent character appearances across all scenes"
}
```

## Implementation Checklist

### Critical Priority (P0)

- [x] Document comprehensive specification
- [ ] Fix phase ordering in src/index.ts:873
- [ ] Add elementContext parameter to analyzeChapter()
- [ ] Implement iterative extractElementsIterative()
- [ ] Implement LLM-based mergeElementIntoCatalog()

### High Priority (P1)

- [ ] Update AnalyzePhase class to load and pass element context
- [ ] Update ExtractPhase class to use iterative extraction
- [ ] Add prepareElementContext() helper function
- [ ] Update StateManager with element enrichment methods
- [ ] Add ElementContext interface to types

### Medium Priority (P2)

- [ ] Fix template variable: chapterContent → fullText
- [ ] Improve image count calculation using pageRange
- [ ] Add maxExtractionChars config option
- [ ] Add iterativeExtraction config flag
- [ ] Add smartElementMerging config flag

### Testing & Validation

- [ ] Test with short book (3-5 chapters)
- [ ] Verify element extraction accuracy
- [ ] Verify element normalization (aliases)
- [ ] Verify cross-scene consistency
- [ ] Test with full-length novel
- [ ] Compare token usage before/after
- [ ] Verify context window limits removed

## Performance Impact

### Token Usage Comparison

**Before (Full-Text Extraction):**
- Single call: ~50,000 chars = ~12,500 tokens
- Cost per book: ~$0.13 (with gpt-4o)
- Context limit: Cannot process books > 50k chars

**After (Iterative Extraction):**
- Per chapter: ~5,000 chars = ~1,250 tokens
- 20 chapters = 25,000 tokens total
- Cost per book: ~$0.25 (with gpt-4o)
- Context limit: None (processes any book size)
- Additional normalization calls: ~500 tokens each
- Estimated total: ~$0.35 per book

**Trade-off:** ~3x higher cost, but:
- ✅ No size limitations
- ✅ Progressive enrichment
- ✅ Much higher accuracy
- ✅ Semantic entity resolution
- ✅ Cross-scene consistency

### Memory Impact

- Element catalog stored in StateManager
- Typical book: 20-50 elements
- ~5KB memory per element
- Total: ~250KB for full catalog
- Negligible impact

## Success Metrics

### Before Implementation

- ❌ Characters appear differently across scenes
- ❌ Places described inconsistently
- ❌ Cannot process books > 50k characters
- ❌ Duplicate element entries
- ❌ No alias handling

### After Implementation

- ✅ Characters appear consistently across all scenes
- ✅ Places maintain visual continuity
- ✅ Can process books of any length
- ✅ Clean element catalog with no duplicates
- ✅ Proper alias and variant handling
- ✅ Progressive description enrichment
- ✅ Cross-scene context awareness

## Related Specifications

- [Template System](./template-system.md)
- [State Management](./state-management.md)
- [AI Integration](./ai-integration.md)
- [Multi-Book Series Support](./series-support.md)

## References

- Code Review: 2025-11-20 (Gemini 2.5 Pro via zen-mcp)
- Issue: Phase ordering prevents element context injection
- Issue: Full-text extraction inefficient and limited
- Issue: No element normalization or enrichment
