# Referential Context System

**Status:** Implemented (Phase 3 Complete)
**Priority:** Critical
**Last Updated:** 2025-11-20
**Implementation Review:** Gemini 2.5 Pro (Phase 3)

## Overview

The Referential Context System provides cross-scene consistency by maintaining a centralized catalog of story elements (characters, places, items) that can be retrieved and injected into scene analysis prompts. This document details the **actual implementation** of element retrieval, storage, and cross-referencing mechanisms.

## Core Principles

### 1. Extract-First Architecture

**Critical Order:** Extract Phase → Analyze Phase

```
Extract Phase (Chapter 1-N)
  ↓ Element Catalog
Analyze Phase (Chapter 1-N) + Element Context
  ↓ Scene Descriptions with Consistency
Illustrate Phase
```

**Why This Matters:**
- Extract phase builds complete element catalog BEFORE scene analysis
- Analyze phase receives pre-extracted element descriptions for consistency
- Each scene references the same canonical element descriptions
- Characters, places, and items appear consistently across all scenes

### 2. Progressive Enrichment

Elements accumulate details as the story progresses:

```
Chapter 1: "John has dark hair"
  ↓ Extract & Merge
Chapter 5: "John wears a leather jacket"
  ↓ Extract & Merge
Final Catalog: "John has dark hair. Additional details: wears a leather jacket."
```

### 3. Entity Resolution

Multiple references to the same entity are normalized:

```
"Dr. Jekyll" (Chapter 1)
"Mr. Hyde" (Chapter 10)
  ↓ LLM Entity Resolution
Single Entry: "Dr. Jekyll" with alias "Mr. Hyde"
```

## Data Structures

### BookElement Type

**File:** `src/types/config.ts:226-236`

```typescript
export interface BookElement {
  type: 'character' | 'creature' | 'place' | 'item' | 'object';
  name: string;  // Canonical name
  quotes: Array<{
    text: string;  // Source text quote
    page: string;  // Page reference
  }>;
  description?: string;  // Progressive visual description
  imageUrl?: string;     // Generated image (if any)
  aliases?: string[];    // Tracked alternative names
}
```

**Key Features:**
- `name`: Canonical identifier (case-insensitive matching)
- `description`: Enriched progressively across chapters
- `aliases`: Alternative names detected by entity resolution
- `quotes`: Source evidence for accurate illustration

### State Storage

**File:** `src/types/config.ts:301`

```typescript
export interface IllustrateState {
  version: string;
  bookFile: string;
  bookTitle: string;
  totalPages: number;
  phases: { /* ... */ };
  toc: { /* ... */ };
  tokenStats: { /* ... */ };

  /** Full element catalog for regeneration (Phase 3+) */
  elements?: BookElement[];

  lastUpdated: string;
}
```

**Critical Change (Phase 3):**
- **BEFORE:** Stored element summaries (type, name, status only)
- **AFTER:** Stores complete `BookElement[]` objects
- **Impact:** Enables proper file regeneration without re-extraction

## Implementation Components

### 1. Element Extraction

#### Iterative Extraction (Default)

**File:** `src/lib/ai-analyzer.ts:43-150`

**Function:** `extractElementsIterative()`

```typescript
/**
 * Extract elements chapter-by-chapter with progressive enrichment
 *
 * Benefits:
 * - No context window limitations
 * - Progressive description enrichment
 * - Lower memory footprint
 * - Better element accuracy
 */
export async function extractElementsIterative(
  chapters: ChapterContent[],
  config: IllustrateConfig,
  openai: OpenAI,
  progressCallback?: (current: number, total: number, title: string) => void
): Promise<BookElement[]>
```

**Process Flow:**

1. **Initialize empty catalog** (Map for O(1) lookups)
2. **For each chapter:**
   - Extract raw elements from chapter text
   - Normalize each element against catalog
   - Merge with LLM-based entity resolution
   - Accumulate quotes and enrich descriptions
3. **Return final catalog** as BookElement[]

**Token Efficiency:**
- Per-chapter extraction: ~1,000-2,000 tokens
- Total for 20-chapter book: ~30,000 tokens
- No single massive API call
- Unlimited book size support

#### Legacy Extraction (Fallback)

**File:** `src/lib/phases/extract-phase.ts:152-171`

**Activated when:** `config.iterativeExtraction = false`

- Processes truncated full text (max 50k chars)
- Single API call
- No progressive enrichment
- Simpler but less accurate

**Configuration:**

```typescript
export interface IllustrateConfig {
  /**
   * Enable iterative chapter-by-chapter extraction
   * @default true
   */
  iterativeExtraction?: boolean;

  /**
   * Maximum characters for legacy extraction
   * @default 50000
   */
  maxExtractionChars?: number;
}
```

### 2. Entity Resolution & Normalization

#### LLM-Based Matching

**File:** `src/lib/ai-analyzer.ts:177-296`

**Function:** `mergeElementIntoCatalog()`

**Purpose:** Prevent duplicate elements by detecting aliases and variants

**Algorithm:**

1. **Check for existing elements** of same type
2. **If catalog is empty:** Add new element directly
3. **If catalog has similar elements:**
   - Query LLM: "Is this the same entity?"
   - LLM returns: `{is_match, matched_index, confidence, reasoning}`
   - If confidence > threshold (default 0.7): **Merge**
   - Else: **Add as new element**

**Merge Logic:**

```typescript
if (result.is_match && result.confidence > config.entityMatchConfidence) {
  // 1. Track alias
  if (!merged.aliases) merged.aliases = [];
  if (!merged.aliases.includes(newElement.name)) {
    merged.aliases.push(newElement.name);
  }

  // 2. Enrich description
  merged.description = await enrichDescription(
    merged.description,
    newElement.description,
    merged.name,
    openai,
    modelName,
    config.aiDescriptionEnrichment
  );

  // 3. Accumulate quotes
  merged.quotes.push(...newElement.quotes);
}
```

**Configuration:**

```typescript
export interface IllustrateConfig {
  /**
   * Enable LLM-based element normalization
   * @default true
   */
  smartElementMerging?: boolean;

  /**
   * Confidence threshold for entity matching (0-1)
   * Lower = more aggressive merging
   * Higher = more conservative
   * @default 0.7
   */
  entityMatchConfidence?: number;
}
```

**Entity Resolution Prompt:**

```
Does the new element refer to an existing element?

New Element:
- Type: character
- Name: "Mr. Hyde"
- Description: "A sinister figure with a twisted appearance"

Existing Elements:
1. "Dr. Jekyll" - A respectable doctor with a kind face

Question: Is the new element the same as any existing element
(accounting for aliases, nicknames, titles)?

Return JSON:
{
  "is_match": true/false,
  "matched_index": 0,
  "confidence": 0.85,
  "reasoning": "Mr. Hyde is the alter ego of Dr. Jekyll"
}
```

### 3. Description Enrichment

#### AI-Powered Consolidation

**File:** `src/lib/ai-analyzer.ts:436-475`

**Function:** `enrichDescriptionWithAI()`

**Purpose:** Merge descriptions intelligently without redundancy

**When Used:** `config.aiDescriptionEnrichment = true` (default: false)

**Process:**

1. **Check for redundancy:** If new description is substring of existing, skip
2. **If AI enabled:**
   - Send both descriptions to LLM
   - Request consolidated single-paragraph description
   - LLM eliminates redundancy while preserving unique details
3. **If AI disabled (default):** Simple concatenation with separator

**AI Enrichment Prompt:**

```
Consolidate and refine the description for the story element "John Snow".
Combine the existing description with the new details into a single,
coherent paragraph. Eliminate redundancy but preserve all unique visual information.

Existing Description: "John has dark hair and gray eyes."
New Details: "John wears a black cloak and carries a sword."

Return only the new, consolidated description as a single string.
```

**Example Output:**

```
"John has dark hair, gray eyes, wears a black cloak, and carries a sword."
```

**Configuration:**

```typescript
export interface IllustrateConfig {
  /**
   * Enable AI-powered description enrichment
   * Uses LLM to consolidate descriptions for better readability
   * @default false (uses simple concatenation)
   */
  aiDescriptionEnrichment?: boolean;
}
```

**Trade-offs:**

- **AI Enabled:** Better quality, higher token cost
- **AI Disabled:** Fast, lower cost, but potentially redundant descriptions

#### Simple Enrichment (Default)

**File:** `src/lib/ai-analyzer.ts:481-494`

**Function:** `enrichDescription()`

**When Used:** `config.aiDescriptionEnrichment = false` (default)

**Logic:**

```typescript
function enrichDescription(existing: string, additional: string): string {
  if (!additional || existing.toLowerCase().includes(additional.toLowerCase())) {
    return existing; // Skip if redundant
  }

  return `${existing}. Additional details: ${additional}`;
}
```

**Example:**

```
Existing: "John has dark hair."
Additional: "John wears a leather jacket."
Result: "John has dark hair. Additional details: wears a leather jacket."
```

### 4. State Persistence

#### StateManager Integration

**File:** `src/lib/state-manager.ts:165-167`

**Method:** `setElements(elements: BookElement[]): void`

**Purpose:** Store complete element catalog in state for:
- File regeneration without re-extraction
- Resume/continue functionality
- Cross-phase data sharing

**Usage Pattern:**

```typescript
// Extract Phase saves elements
const elements = await extractElementsIterative(chapters, config, openai);
stateManager.setElements(elements);
await stateManager.save();

// Analyze Phase loads elements
const state = stateManager.getState();
const elements = state.elements || [];
const elementContext = prepareElementContext(elements);
await analyzeChapter(chapter, config, openai, elementContext);
```

**Phase 3 Improvement:**

```typescript
// BEFORE (Phase 1-2): Only stored summaries
stateManager.updateElement('character', 'John', 'completed', imageUrl);
// Lost: description, quotes, aliases

// AFTER (Phase 3): Store complete objects
stateManager.setElements(fullElementArray);
// Preserved: ALL data for regeneration
```

#### Deprecated Method

**File:** `src/lib/state-manager.ts:173-197`

**Method:** `updateElement()` - **@deprecated**

**Why Deprecated:**
- Only stored minimal data (type, name, imageUrl)
- Could not regenerate Elements.md from state alone
- Incompatible with progressive enrichment

**Backward Compatibility:** Method still exists for legacy code

### 5. Output Rendering

#### Elements.md Generation

**File:** `src/lib/output-generator.ts:97-174`

**Function:** `generateElementsFile()`

**Renders:**

```markdown
# Elements - Book Title

## Story Elements

### Characters

#### John Snow

**Aliases:** Jon Snow, The Bastard of Winterfell

**Description:** John has dark hair and gray eyes. Additional details:
wears a black cloak and carries a sword at his side.

**Reference Quotes:**

1. (Page 15)
   > John stood at the wall, his dark hair catching the wind.

2. (Page 89)
   > The bastard Jon clutched his sword tightly.

---
```

**Phase 3 Addition:** Alias rendering (lines 142-145)

```typescript
// Render aliases if detected by entity resolution
if (element.aliases && element.aliases.length > 0) {
  content += `**Aliases:** ${element.aliases.join(', ')}\n\n`;
}
```

**Regeneration Support:**

```typescript
// Extract Phase saves full elements
const elementsToSave = this.elements.length > 0
  ? this.elements           // Just extracted
  : state.elements || [];   // From state (regeneration)
```

## Context Injection for Scene Analysis

### Element Context Preparation

**Purpose:** Format element catalog for injection into scene analysis prompts

**Location:** Typically in Analyze Phase

**Format Function:**

```typescript
interface ElementContext {
  characters?: string;
  places?: string;
  items?: string;
}

function prepareElementContext(elements: BookElement[]): ElementContext {
  const characters = elements
    .filter(e => e.type === 'character')
    .map(e => {
      const aliases = e.aliases ? ` (aka ${e.aliases.join(', ')})` : '';
      return `- ${e.name}${aliases}: ${e.description}`;
    })
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

**Example Context String:**

```
CHARACTERS:
- John Snow (aka Jon Snow, The Bastard): dark hair, gray eyes, black cloak
- Daenerys Targaryen (aka Khaleesi, Mother of Dragons): silver hair, purple eyes

PLACES:
- Winterfell: ancient castle with gray stone walls, surrounded by forest
- The Wall: massive ice barrier 700 feet tall

ITEMS:
- Longclaw: Valyrian steel bastard sword with wolf pommel
```

### Prompt Injection

**Template Variables:**

```typescript
const prompt = template
  .replace(/{{characters}}/g, elementContext.characters || '')
  .replace(/{{places}}/g, elementContext.places || '')
  .replace(/{{items}}/g, elementContext.items || '');
```

**Example Analyze Prompt with Context:**

```
Analyze this chapter and identify 3 visually striking scenes.

STORY CONTEXT:
CHARACTERS:
- John Snow (aka Jon Snow): dark hair, gray eyes, black cloak
- Arya Stark: young girl, small build, brown hair

PLACES:
- Winterfell: ancient castle with gray stone walls

CHAPTER CONTENT:
[Chapter text here...]

For each scene, describe visual elements referencing the character
descriptions above for consistency.
```

### Benefits

1. **Visual Consistency:** Characters look the same across all scenes
2. **Alias Awareness:** AI knows "Jon" and "John Snow" are the same person
3. **Detail Accuracy:** Scene descriptions use canonical element details
4. **Reduced Hallucination:** AI references established facts
5. **Style Coherence:** Consistent tone and visual style

## Configuration Reference

### Complete Config Interface

```typescript
export interface IllustrateConfig {
  // ... existing config ...

  /**
   * Maximum characters for element extraction per chunk
   * Only used in legacy extraction mode
   * @default 50000
   */
  maxExtractionChars?: number;

  /**
   * Enable iterative element extraction (chapter-by-chapter)
   * Recommended for better token efficiency and element enrichment
   * @default true
   */
  iterativeExtraction?: boolean;

  /**
   * Enable LLM-based element normalization
   * Uses AI to merge duplicate elements and handle aliases
   * @default true
   */
  smartElementMerging?: boolean;

  /**
   * Confidence threshold for entity matching (0-1)
   * Lower values merge more aggressively
   * Higher values are more conservative
   * @default 0.7
   */
  entityMatchConfidence?: number;

  /**
   * Enable AI-powered description enrichment
   * Uses LLM to consolidate descriptions for better readability
   * @default false (uses simple concatenation)
   */
  aiDescriptionEnrichment?: boolean;
}
```

### Recommended Settings

**Default (Balanced):**
```json
{
  "iterativeExtraction": true,
  "smartElementMerging": true,
  "entityMatchConfidence": 0.7,
  "aiDescriptionEnrichment": false
}
```

**High Quality (Higher Cost):**
```json
{
  "iterativeExtraction": true,
  "smartElementMerging": true,
  "entityMatchConfidence": 0.8,
  "aiDescriptionEnrichment": true
}
```

**Fast & Cheap (Lower Quality):**
```json
{
  "iterativeExtraction": false,
  "smartElementMerging": false,
  "entityMatchConfidence": 0.6,
  "aiDescriptionEnrichment": false
}
```

## Performance Characteristics

### Token Usage

**Extract Phase:**
- Iterative extraction: ~1,500 tokens per chapter
- Entity resolution: ~500 tokens per merge check
- AI enrichment: ~200 tokens per description (if enabled)
- **Total for 20-chapter book:** ~40,000-50,000 tokens

**Analyze Phase (with context):**
- Base prompt: ~1,000 tokens
- Element context: ~500-1,500 tokens (depends on catalog size)
- Chapter content: ~2,000-5,000 tokens
- **Total per chapter:** ~3,500-7,500 tokens

### Memory Usage

- Element catalog: ~5KB per element
- Typical book: 20-50 elements
- **Total memory:** ~100-250KB
- Negligible impact on system resources

### Cost Estimates (GPT-4o)

**Extract Phase:**
- Input tokens: ~30,000
- Output tokens: ~5,000
- **Cost:** ~$0.35 per book

**Analyze Phase (20 chapters with context):**
- Input tokens: ~80,000
- Output tokens: ~15,000
- **Cost:** ~$1.15 per book

**Total:** ~$1.50 per book (with context injection)

**Without context injection:** ~$1.00 per book
**Premium for consistency:** ~$0.50 (50% increase)

## Testing & Validation

### Unit Tests Required

```typescript
describe('Referential Context System', () => {
  describe('Element Extraction', () => {
    it('should extract elements from single chapter');
    it('should accumulate elements across chapters');
    it('should handle empty chapters gracefully');
  });

  describe('Entity Resolution', () => {
    it('should detect aliases (Dr. Jekyll / Mr. Hyde)');
    it('should merge variants (Jon Snow / John Snow)');
    it('should handle titles (The Dark Lord / Voldemort)');
    it('should respect confidence threshold');
  });

  describe('Description Enrichment', () => {
    it('should skip redundant descriptions');
    it('should append unique details');
    it('should use AI when enabled');
    it('should fallback to simple concat when AI disabled');
  });

  describe('State Persistence', () => {
    it('should store complete BookElement objects');
    it('should load elements for regeneration');
    it('should handle missing state gracefully');
  });

  describe('Context Injection', () => {
    it('should format character context correctly');
    it('should include aliases in context');
    it('should group by element type');
  });
});
```

### Integration Tests Required

```typescript
describe('End-to-End Element Consistency', () => {
  it('should extract elements across full book');
  it('should normalize duplicate characters');
  it('should inject context into scene analysis');
  it('should regenerate Elements.md from state');
  it('should handle series-wide element sharing');
});
```

### Validation Criteria

**Element Extraction:**
- ✅ All named characters extracted
- ✅ All significant places extracted
- ✅ All key items extracted
- ✅ No size limitations

**Entity Resolution:**
- ✅ No duplicate entries for same entity
- ✅ Aliases properly tracked
- ✅ Variants correctly merged
- ✅ Confidence threshold respected

**Description Quality:**
- ✅ Descriptions progressively enriched
- ✅ No redundancy in final descriptions
- ✅ All unique details preserved
- ✅ Readable and coherent

**Context Injection:**
- ✅ Characters appear consistently across scenes
- ✅ Places maintain visual continuity
- ✅ Items match canonical descriptions
- ✅ Aliases properly referenced

**State Persistence:**
- ✅ Elements.md can regenerate from state alone
- ✅ No data loss on save/load cycle
- ✅ Resume functionality works correctly

## Troubleshooting

### Common Issues

**Issue:** Elements not appearing in scene descriptions
- **Cause:** Extract phase ran after Analyze phase
- **Fix:** Ensure Extract phase executes first

**Issue:** Duplicate elements in catalog
- **Cause:** `smartElementMerging = false` or confidence too high
- **Fix:** Enable smart merging, lower confidence to 0.6

**Issue:** Descriptions are redundant and repetitive
- **Cause:** Simple enrichment without AI
- **Fix:** Enable `aiDescriptionEnrichment = true`

**Issue:** High token costs
- **Cause:** AI enrichment and low entity match confidence
- **Fix:** Disable AI enrichment, raise confidence to 0.8

**Issue:** Missing elements at end of book
- **Cause:** Using legacy extraction with truncation
- **Fix:** Enable `iterativeExtraction = true`

## Related Specifications

- [Context Management System](./context-management-system.md) - Architectural design and implementation plan
- [AI Integration](./ai-integration.md) - LLM interaction patterns
- [State Management](./state-management.md) - State file format and persistence
- [Multi-Book Series](./multi-book-series.md) - Series-wide element sharing
- [Visual Style System](./visual-style-system.md) - Style consistency mechanisms

## References

- **Implementation Date:** 2025-11-20
- **Code Review:** Gemini 2.5 Pro (Phase 3)
- **Test Coverage:** Unit tests pending, integration tests pending
- **Production Status:** Implemented and committed (0218b54)

---

**Next Steps:**
1. Write comprehensive test suite (unit + integration)
2. Validate with real book (test case)
3. Fine-tune confidence thresholds based on results
4. Add metrics/analytics for extraction quality
5. Implement caching for repeated entity resolutions
