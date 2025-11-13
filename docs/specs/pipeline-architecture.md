# Pipeline Architecture

## Overview

imaginize uses a four-phase pipeline for processing books into illustrated guides. Each phase builds on the previous one, with state persistence for resume functionality.

## Pipeline Phases

### Phase 0: Parse
**Entry Point**: `src/lib/epub-parser.ts`, `src/lib/pdf-parser.ts`
**Purpose**: Extract book structure and content

**Operations:**
1. Detect file type (EPUB/PDF)
2. Extract metadata (title, author, publisher)
3. Parse chapter structure from TOC
4. Extract text content
5. Filter front matter (copyright, dedication, etc.)
6. Estimate page counts (300 words/page)

**Output:**
```typescript
{
  metadata: BookMetadata,
  chapters: ChapterContent[],
  totalPages: number
}
```

**CLI Flags**: Runs automatically for all commands

---

### Phase 1: Analyze
**Entry Point**: `src/lib/phases/analyze-phase-v2.ts`
**Purpose**: Generate visual scene descriptions with AI

**Two-Pass Approach:**

#### Pass 1: Entity Extraction (All Chapters)
- Fast, minimal AI processing
- Extract entities: characters, creatures, places, items
- Use cheap model (gpt-4o-mini or free tier)
- Parallel batch processing (3 concurrent)
- Generate preliminary Elements.md

**AI Prompt Focus:**
- Entity types and names
- Brief visual descriptions
- Appearance details
- Location contexts

#### Pass 2: Full Analysis (Per Chapter with Enrichment)
- Comprehensive scene analysis
- Use entity catalog for cross-references
- Extract visual elements, mood, lighting
- Generate detailed quotes (3-8 sentences)
- Update manifest after each chapter

**AI Prompt Structure:**
```
You are analyzing a book chapter for illustration.

CHAPTER TEXT:
[full chapter content]

ENTITY CATALOG (for cross-reference):
[entities from Elements.md]

REQUIREMENTS:
- Extract 1-3 visual scenes suitable for illustration
- Include 3-8 sentence quotes (50-150 words)
- Identify mood and lighting
- Cross-reference characters with catalog descriptions
```

**Output**: `Chapters.md`
```markdown
## Chapter 9: The Beginning

### Scene 1

**Pages:** 7-7

**Source Text:**
> [3-8 sentence quote from book]

**Visual Elements:** [Standalone description for illustration]

**Mood:** tense, anticipatory
**Lighting:** late afternoon, golden hour

CHARACTER DETAILS:
- Christopher (character): A young boy with tall, gangly build...
- Black Doglike Creature (creature): A large, menacing creature...
```

**CLI Flags**:
- `--text`: Enable this phase
- `--chapters 1-5`: Limit to specific chapters
- `--concurrent`: Use two-pass approach

---

### Phase 2: Extract
**Entry Point**: `src/lib/phases/extract-phase.ts`
**Purpose**: Generate comprehensive story element catalog

**Operations:**
1. Merge entities from all chapters
2. Deduplicate by name matching
3. Track appearance frequency
4. Generate visual descriptions
5. Categorize by type

**Dynamic Targets** (based on book length):
- < 100 pages: 15-25 elements
- 100-200 pages: 25-35 elements
- 200+ pages: 35-45 elements

**AI Prompt Focus:**
- VISUAL appearance (age, clothing, physical features)
- Physical details (hair, eyes, build)
- Clothing descriptions (colors, style)
- Distinguishing features (expressions, posture)
- Creature details (size, color, teeth, claws)

**Output**: `Elements.md`
```markdown
# Story Elements

## Characters

### Christopher
**Type:** character
**Appearances:** Chapter 9, Chapter 13
**Description:** A young boy with tall, gangly build, wearing a long navy wool overcoat...

## Creatures

### Black Doglike Creature
**Type:** creature
**Appearances:** Chapter 9
**Description:** A large, menacing creature with long teeth resembling a forearm...
```

**CLI Flags**:
- `--elements`: Enable this phase
- `--element-types characters,creatures`: Filter types

---

### Phase 3: Illustrate
**Entry Point**: `src/lib/phases/illustrate-phase-v2.ts`
**Purpose**: Generate AI images from scene descriptions

**Operations:**
1. Wait for Elements.md ready (concurrent mode)
2. Poll manifest for chapters with status='analyzed'
3. Claim chapters atomically ('illustration_inprogress')
4. Build enhanced image prompts
5. Generate images via AI
6. Save as PNG files
7. Update manifest ('illustration_complete')

**Prompt Enhancement:**
```
GENRE: [extracted from book]
STYLE: [from style-guide.json if exists]
MOOD: [from scene analysis]
LIGHTING: [from scene analysis]
SCENE: [visual elements description]
CHARACTERS: [from Elements.md catalog]

TECHNICAL REQUIREMENTS:
- High detail, professional illustration quality
- 1024x1024 resolution
- No text overlays in image
- Consistent with previous scenes
```

**Style Consistency:**
1. After first 3 images: analyze visual style (GPT-4 Vision)
2. Extract style guide (colors, composition, technique)
3. Save to `style-guide.json`
4. Apply to all subsequent prompts

**Filename Format:**
```
chapter_{N}_{title}_{scene}_{M}.png

Examples:
chapter_9_the_beginning_scene_1.png
chapter_13_frank_aureate_scene_2.png
```

**CLI Flags**:
- `--images`: Enable this phase
- `--image-quality hd|standard`: Quality setting
- `--image-size 1024x1024`: Image dimensions
- `--concurrent`: Manifest-driven processing

---

## Phase Orchestration

### Sequential Mode (Default)
```
main()
├─> parseBook()
├─> if --text:
│   ├─> analyzePhase.execute()  // All chapters
│   └─> save Chapters.md
├─> if --elements:
│   ├─> extractPhase.execute()
│   └─> save Elements.md
└─> if --images:
    ├─> illustratePhase.execute()  // All scenes
    └─> save PNG files
```

### Concurrent Mode (`--concurrent`)
```
main()
├─> parseBook()
├─> if --text:
│   ├─> analyzePhase.executePass1()  // All chapters, parallel
│   ├─> save Elements.md
│   ├─> manifest.setElementsReady()
│   └─> analyzePhase.executePass2()  // Per chapter with elements
│       └─> manifest.updateChapter(analyzed)
└─> if --images:
    ├─> manifestmanager.waitForElementsReady()
    └─> illustratePhase.executeWithManifest()
        ├─> poll for chapters with status='analyzed'
        ├─> claim chapter atomically
        ├─> generate image
        └─> manifest.updateChapter(illustration_complete)
```

## Base Phase Class

All phases extend `BasePhase` (`src/lib/phases/base-phase.ts`):

```typescript
abstract class BasePhase {
  protected config: Required<IllustrateConfig>;
  protected state: StateManager;
  protected progress: ProgressTracker;
  protected client: OpenAI;

  // Lifecycle methods
  abstract initialize(): Promise<void>;
  abstract execute(): Promise<void>;
  abstract cleanup(): Promise<void>;

  // Sub-phase management
  protected async executeSubPhase<T>(
    subPhase: SubPhase,
    fn: () => Promise<T>
  ): Promise<T>;

  // Error handling
  protected async retryIfRetryable<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<T>;
}
```

**Benefits:**
- Consistent error handling
- State persistence
- Progress tracking
- Sub-phase management

## State Persistence

### After Each Phase
```typescript
state.updatePhaseState('analyze', {
  status: 'completed',
  completedAt: new Date().toISOString()
});
state.save();
```

### Resume Logic
```typescript
if (state.phases.analyze.status === 'completed' && !force) {
  console.log('✓ Analyze phase already complete');
  return; // Skip
}
```

## Error Handling Strategy

### Level 1: Retry (Transient Errors)
- Network timeouts
- Rate limit hits (429)
- Temporary API failures

**Action**: Exponential backoff (up to 10 retries, 65s for rate limits)

### Level 2: Skip (Non-Critical Errors)
- Single chapter analysis failure
- Single image generation failure
- Invalid AI response format

**Action**: Log error, mark chapter as failed, continue pipeline

### Level 3: Abort (Critical Errors)
- Invalid API key
- File not found
- Config validation failure
- Out of disk space

**Action**: Stop pipeline, display error, exit

## Performance Optimizations

### Parallel Processing
```typescript
// Analyze Phase Pass 1: Batch size based on model
const batchSize = modelStr.includes('free') ? 1 : 3;

for (let i = 0; i < chapters.length; i += batchSize) {
  const batch = chapters.slice(i, i + batchSize);
  await Promise.all(batch.map(ch => analyzeChapter(ch)));
  await sleep(2000); // Inter-batch delay
}
```

### Concurrent Illustration
```typescript
// Illustrate Phase: Multiple workers polling manifest
while (true) {
  const chapter = await manifest.claimNextAnalyzedChapter();
  if (!chapter) break;

  await generateImage(chapter);
  await manifest.updateChapter(chapter.id, 'illustration_complete');
}
```

## Output Quality Controls

### Analysis Phase
- Minimum quote length: 3-8 sentences, 50-150 words
- Mood extraction: Required (tense, whimsical, ominous, etc.)
- Lighting extraction: Required (sunrise, night, stormy, etc.)
- Character cross-references: From Elements.md

### Extract Phase
- Visual descriptions only (not functional roles)
- Physical appearance: age, hair, eyes, build, clothing
- Creature details: size, color, teeth, claws, fur
- Minimum element count: Based on book length

### Illustrate Phase
- Style consistency: After 3 images, analyze and apply
- Character consistency: Include full descriptions from Elements.md
- Filename clarity: chapter_N_title_scene_M.png
- Resolution: Configurable (default 1024x1024)

## Monitoring & Debugging

### Progress Tracking
```markdown
# progress.md

📖 **Book:** Impossible Creatures
📄 **Total Pages:** 297

## Analyze Phase

✓ Pass 1: Entity extraction (83/83 chapters)
⏳ Pass 2: Full analysis (45/83 chapters)
  ↳ Chapter 46: Analyzing...
```

### Dashboard Updates
```typescript
progressTracker.emit('chapter-start', {
  phase: 'analyze',
  chapter: 46,
  title: 'The Reveal'
});

progressTracker.emit('stats', {
  totalChapters: 83,
  completedChapters: 45,
  percent: 54.2,
  eta: 8520000 // ms
});
```

### State Debugging
```bash
# View current state
cat .imaginize.state.json | jq .phases

# View manifest (concurrent mode)
cat .imaginize.manifest.json | jq '.chapters | map(select(.status=="analyzed"))'
```

---

**See Also:**
- [System Architecture](./architecture.md)
- [Concurrent Processing](./concurrent-processing.md)
- [State Management](./state-management.md)
- [AI Integration](./ai-integration.md)
