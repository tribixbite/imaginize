# Concurrent Processing Architecture - Design Specification

**Version:** 1.0
**Date:** November 2025
**Status:** Design & Review Phase

---

## Executive Summary

This document proposes a concurrent processing architecture for imaginize that allows text analysis and image generation to run in parallel, reducing total processing time from ~5 hours to ~2.5 hours (50% improvement) while avoiding I/O conflicts and race conditions.

**Key Innovation:** Split-state architecture with per-chapter isolation and pipeline-specific progress tracking.

---

## Current Architecture Analysis

### Current Sequential Flow

```
┌──────────────────────────────────────────────────────────┐
│  Phase 1: ANALYZE (--text)                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │  For each chapter (sequential):                     │  │
│  │    1. Analyze text with AI                          │  │
│  │    2. Extract visual concepts                       │  │
│  │    3. Update .imaginize.state.json (shared)         │  │
│  │    4. Append to progress.md (shared)                │  │
│  │  End loop                                            │  │
│  │                                                      │  │
│  │  After ALL chapters complete:                       │  │
│  │    5. Write Chapters.md (complete file)             │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                          ⬇
┌──────────────────────────────────────────────────────────┐
│  Phase 2: ILLUSTRATE (--images)                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  1. Read complete Chapters.md                       │  │
│  │  2. Parse all concepts                              │  │
│  │  3. For each concept (sequential):                  │  │
│  │       - Generate image                              │  │
│  │       - Update .imaginize.state.json (shared)       │  │
│  │       - Append to progress.md (shared)              │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘

Total Time: ~5 hours (2.5h analyze + 2.5h illustrate)
```

### Current I/O Patterns & Conflicts

#### Shared Resources (CONFLICT POINTS)

1. **`.imaginize.state.json`** (StateManager)
   - **Read:** On startup (load existing state)
   - **Write:** After EVERY chapter completion (both phases)
   - **Conflict:** Concurrent writes cause data loss/corruption
   - **Pattern:** Full file rewrite on every save()

2. **`progress.md`** (ProgressTracker)
   - **Write:** Initialize once (writeFile)
   - **Append:** After EVERY log entry (both phases)
   - **Conflict:** Race condition on append operations
   - **Pattern:** Append-only (safer but still has races)

3. **`Chapters.md`** (Output Generator)
   - **Write:** Once at END of analyze phase (complete file)
   - **Read:** Once at START of illustrate phase
   - **Conflict:** None currently (sequential)
   - **Future Conflict:** Concurrent read while writing

#### Phase-Specific Resources (NO CONFLICT)

1. **`Elements.md`** (Extract phase only)
2. **`Contents.md`** (Extract phase only)
3. **`*.png` images** (Illustrate phase only - unique filenames)

### Current State Management Deep Dive

#### StateManager Class (state-manager.ts)

**Constructor:**
```typescript
constructor(outputDir, bookFile, bookTitle, totalPages)
  → Creates: .imaginize.state.json path
  → Initializes: In-memory state object
```

**Critical Methods:**
```typescript
save()
  → Writes ENTIRE state to JSON (66-69)
  → No locking mechanism
  → Overwrites file completely
  → Called after EVERY chapter update

updateChapter(phase, chapterNumber, status, data)
  → Updates in-memory state (97-118)
  → Caller must manually call save()
  → No atomic operation guarantee

getState()
  → Returns readonly state
  → No cache invalidation
```

**State Structure:**
```json
{
  "version": "2.0.0",
  "bookFile": "...",
  "bookTitle": "...",
  "totalPages": 297,
  "phases": {
    "analyze": {
      "status": "in_progress",
      "chapters": {
        "9": { "status": "completed", "concepts": 1, "tokensUsed": 2000 },
        "10": { "status": "in_progress" }
      }
    },
    "illustrate": {
      "status": "pending",
      "chapters": {}
    }
  },
  "toc": { "chapters": [...] },
  "tokenStats": { "totalUsed": 50000 },
  "lastUpdated": "2025-11-11T..."
}
```

#### ProgressTracker Class (progress-tracker.ts)

**Constructor:**
```typescript
constructor(outputDir)
  → Creates: progress.md path
```

**Critical Methods:**
```typescript
initialize(bookTitle, totalChapters)
  → Writes initial header (writeFile) (23-36)
  → Overwrites existing file

log(message, level)
  → Appends entry to file (41-52)
  → Uses appendFile (Node.js fs/promises)
  → No explicit locking
  → Potential race condition on concurrent appends

completeChapter(chapterNum, chapterTitle, conceptsFound)
  → Calls log() internally
  → Appends to progress.md
```

**Progress.md Format:**
```markdown
# Illustrate Progress Report

**Book:** Impossible Creatures
**Started:** 2025-11-11T00:49:20.637Z
**Total Chapters:** 83

---

## Progress Log

**[2025-11-11T00:49:20.642Z]** ℹ️ Starting phase: analyze
**[2025-11-11T00:49:20.666Z]** ℹ️ Skipping non-story chapter: Also by...
**[2025-11-11T00:50:55.420Z]** ✅ Completed Chapter 9: The Beginning - Found 1 visual concepts
```

---

## Identified Race Conditions & Conflicts

### Critical Issues

1. **State File Write Races**
   ```
   Thread A (Analyze Ch 9):          Thread B (Illustrate Concept 1):
   ─────────────────────────────     ──────────────────────────────────
   updateChapter(analyze, 9, ...)
   save() → write state.json
                                      updateChapter(illustrate, 9, ...)
                                      save() → write state.json
                                      ⚠️  OVERWRITES Thread A's update!
   ```
   **Result:** Lost chapter analysis data

2. **Progress File Append Races**
   ```
   Thread A:                         Thread B:
   ─────────────────────────────     ──────────────────────────────────
   log("Completed Ch 9")
   appendFile(progress.md)
   ├─ read file position
   │                                  log("Generated img for Ch 9")
   │                                  appendFile(progress.md)
   │                                  ├─ read file position (same!)
   │                                  ├─ append "Generated img..."
   ├─ append "Completed Ch 9"        └─ close file
   └─ close file

   ⚠️  RESULT: Interleaved or missing entries
   ```

3. **Chapters.md Read-Write Race**
   ```
   Thread A (Analyze):               Thread B (Illustrate):
   ─────────────────────────────     ──────────────────────────────────
   Processing chapters 1-50...
   generateChaptersFile()
   ├─ Open Chapters.md (write)
   │                                  parseChaptersFile()
   │                                  └─ Open Chapters.md (read)
   │                                     ⚠️  Read incomplete file!
   └─ Write complete
   ```

### Non-Critical Issues

4. **State Cache Invalidation**
   - `getState()` returns in-memory copy
   - Concurrent process updates file
   - In-memory copy becomes stale

5. **Progress.md Out of Order**
   - Timestamps may not match actual chronological order
   - Confusing for user review

---

## Proposed Concurrent Architecture

### Design Principles

1. **Pipeline Isolation:** Each pipeline (analyze/illustrate) has independent state
2. **Atomic Operations:** File writes are atomic and non-blocking
3. **Event-Driven Coordination:** Pipelines communicate via events, not shared files
4. **Graceful Degradation:** System works even if one pipeline fails
5. **Elements.md Integration:** Scenes pull enrichment data from Elements.md

### High-Level Concurrent Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  PIPELINE A: ANALYZE (Text → Concepts)                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  For each chapter (parallel up to maxConcurrency):         │  │
│  │    1. Analyze text with AI                                 │  │
│  │    2. Extract visual concepts                              │  │
│  │    3. Write to .analyze.state/{chapter_N}.json             │  │
│  │    4. Append to progress.analyze.md                        │  │
│  │    5. Emit event: 'conceptsReady' → Pipeline B             │  │
│  │  End parallel loop                                          │  │
│  │                                                             │  │
│  │  Periodic (every 10 chapters or on complete):              │  │
│  │    6. Aggregate chapter JSON → Chapters.md                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                          ⬇ (event-driven)
┌─────────────────────────────────────────────────────────────────┐
│  PIPELINE B: ILLUSTRATE (Concepts → Images)                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Listen for 'conceptsReady' events                         │  │
│  │                                                             │  │
│  │  On event received:                                         │  │
│  │    1. Load chapter JSON from .analyze.state/               │  │
│  │    2. Enrich concepts with Elements.md data                │  │
│  │    3. For each concept (sequential - rate limit):          │  │
│  │         - Generate image                                   │  │
│  │         - Save PNG                                         │  │
│  │         - Write to .illustrate.state/{concept_ID}.json     │  │
│  │         - Append to progress.illustrate.md                 │  │
│  │    4. Emit event: 'imageComplete'                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Total Time: ~2.5 hours (overlapping execution)
```

### Split-State Directory Structure

```
imaginize_ImpossibleCreatures/
├── .imaginize.state.json           # Global metadata & aggregation
├── .analyze.state/                 # Analyze pipeline state
│   ├── chapter_9.json              # Per-chapter concept data
│   ├── chapter_10.json
│   ├── chapter_11.json
│   └── manifest.json               # Completion tracking
├── .illustrate.state/              # Illustrate pipeline state
│   ├── concept_001.json            # Per-concept image metadata
│   ├── concept_002.json
│   └── manifest.json
├── progress.md                     # Aggregated progress (readonly)
├── progress.analyze.md             # Analyze pipeline log
├── progress.illustrate.md          # Illustrate pipeline log
├── Chapters.md                     # Generated incrementally
├── Elements.md                     # Character/place/object catalog
├── Contents.md                     # TOC
└── *.png images                    # Generated images
```

### State File Formats

#### `.analyze.state/chapter_9.json`
```json
{
  "chapterNumber": 9,
  "chapterTitle": "The Beginning",
  "status": "completed",
  "concepts": [
    {
      "id": "ch9_scene1",
      "pageRange": "15-17",
      "quote": "The sky was darkening to purple...",
      "description": "A griffin landing on a rocky outcrop at sunset",
      "mood": "majestic",
      "lighting": "golden hour sunset"
    }
  ],
  "tokensUsed": 2150,
  "completedAt": "2025-11-11T00:50:55.420Z"
}
```

#### `.illustrate.state/concept_001.json`
```json
{
  "conceptId": "ch9_scene1",
  "chapterNumber": 9,
  "status": "completed",
  "enrichedPrompt": "A griffin landing on a rocky outcrop at sunset. The griffin has iridescent scales (from Elements.md: Griffin creature with eagle head, lion body, gold feathers). Character: Christopher watches from below (from Elements.md: young boy, age 12, brown hair)...",
  "imageUrl": "chapter_9_scene_1.png",
  "generatedAt": "2025-11-11T01:15:30.123Z",
  "retries": 2
}
```

#### `.analyze.state/manifest.json`
```json
{
  "totalChapters": 83,
  "completedChapters": [9, 10, 11, 13],
  "inProgressChapters": [12],
  "failedChapters": [],
  "lastUpdated": "2025-11-11T00:51:00.000Z"
}
```

---

## Elements.md Integration for Scene Enrichment

### Current Elements.md Structure

```markdown
# Story Elements - Impossible Creatures

## Characters

### Christopher
**Type:** character
**Description:** A young boy, approximately 12 years old, with messy brown hair and
keen green eyes. Wears simple clothing suitable for adventure. Brave and curious.

**Appearances:**
- Page 15-17: "Christopher stood at the edge..."
- Page 23-25: "His heart raced as he..."

### Mal
**Type:** character
**Description:** A girl with fierce determination, around 12 years old. Short dark
hair, always ready for action. Loyal friend to Christopher.

## Creatures

### Griffin
**Type:** creature
**Description:** Majestic creature with the head and wings of an eagle, body of a
lion. Golden-brown feathers that shimmer in sunlight. Intelligent eyes that show
ancient wisdom.

## Places

### The Archipelago
**Type:** place
**Description:** A mystical chain of floating islands suspended in endless sky.
Each island has unique terrain and magical properties.
```

### Enrichment Strategy

When generating images for a scene:

1. **Parse Chapters.md concept**
   ```
   Chapter: "The Beginning"
   Description: "A griffin landing on a rocky outcrop"
   Quote: "The sky was darkening to purple, and the first stars..."
   ```

2. **Extract entities from description**
   - Entity type: `creature` → "griffin"
   - Entity type: `character` → "Christopher" (inferred from quote context)
   - Entity type: `place` → None explicitly mentioned

3. **Query Elements.md for each entity**
   ```typescript
   const griffin = lookupElement('creature', 'griffin');
   const christopher = lookupElement('character', 'christopher');
   ```

4. **Build enriched prompt**
   ```
   Original: "A griffin landing on a rocky outcrop at sunset"

   Enriched: "A griffin landing on a rocky outcrop at sunset. The griffin
   has the head and wings of an eagle with golden-brown feathers that shimmer,
   and the powerful body of a lion. Its intelligent eyes show ancient wisdom.
   In the foreground, Christopher (a 12-year-old boy with messy brown hair and
   keen green eyes) watches from below with a mixture of awe and curiosity.
   The scene captures the moment just as the griffin's talons touch the weathered
   stone, wings spread wide against the purple sky with the first stars appearing."
   ```

5. **Add consistency markers**
   - Character visual consistency: "Christopher appearance matches previous scenes"
   - Creature visual consistency: "Griffin matches established design"

### Implementation: ElementsLookup Service

```typescript
interface ElementData {
  type: string;
  name: string;
  description: string;
  appearances: string[];
}

class ElementsLookup {
  private elements: Map<string, ElementData>;

  async load(elementsFilePath: string): Promise<void> {
    // Parse Elements.md
    // Build searchable index
  }

  lookup(type: string, name: string): ElementData | null {
    // Find matching element
  }

  enrichPrompt(basePrompt: string, context: any): string {
    // 1. Extract entity mentions from basePrompt
    // 2. Lookup each entity in Elements.md
    // 3. Inject detailed descriptions
    // 4. Add consistency directives
    // 5. Return enriched prompt
  }
}
```

---

## Concurrency Control Mechanisms

### 1. Per-Chapter State Isolation

**Problem:** Multiple chapters writing to same state file
**Solution:** Each chapter gets its own JSON file

```typescript
// OLD (shared state - race condition)
stateManager.updateChapter('analyze', 9, 'completed');
stateManager.save(); // Overwrites entire .imaginize.state.json

// NEW (isolated state - no race)
await writeChapterState(9, {
  status: 'completed',
  concepts: [...]
});
// Writes only to .analyze.state/chapter_9.json
```

### 2. Manifest-Based Coordination

**Problem:** Need to know which chapters are done without reading all files
**Solution:** Lightweight manifest file updated atomically

```typescript
class AnalyzeStateManager {
  async markChapterComplete(chapterNum: number): Promise<void> {
    // Atomic operation using file locking or rename
    const manifest = await this.loadManifest();
    manifest.completedChapters.push(chapterNum);
    manifest.inProgressChapters = manifest.inProgressChapters.filter(
      n => n !== chapterNum
    );
    await this.saveManifest(manifest);
  }
}
```

### 3. Event-Driven Pipeline Communication

**Problem:** Illustrate pipeline doesn't know when new concepts are ready
**Solution:** EventEmitter for inter-pipeline signaling

```typescript
import { EventEmitter } from 'events';

class ConcurrentOrchestrator extends EventEmitter {
  async startPipelines(): Promise<void> {
    // Start both pipelines
    const analyzePromise = this.runAnalyzePipeline();
    const illustratePromise = this.runIllustratePipeline();

    await Promise.all([analyzePromise, illustratePromise]);
  }

  async runAnalyzePipeline(): Promise<void> {
    for (const chapter of chapters) {
      const concepts = await analyzeChapter(chapter);
      await writeChapterState(chapter.number, concepts);

      // Signal illustrate pipeline
      this.emit('conceptsReady', {
        chapterNumber: chapter.number,
        concepts
      });
    }
  }

  async runIllustratePipeline(): Promise<void> {
    this.on('conceptsReady', async (data) => {
      for (const concept of data.concepts) {
        // Enrich with Elements.md
        const enrichedConcept = await elementsLookup.enrichPrompt(
          concept.description,
          concept
        );

        // Generate image
        await generateImage(enrichedConcept, concept.id);
      }
    });
  }
}
```

### 4. Rate Limit Queue for Illustrate Pipeline

**Problem:** Free tier = 1 request/minute, but multiple concepts ready
**Solution:** Queue with automatic 65s spacing

```typescript
class RateLimitedQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;

  async enqueue(task: () => Promise<void>): Promise<void> {
    this.queue.push(task);
    if (!this.processing) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      await task();

      if (this.queue.length > 0) {
        await sleep(65000); // Rate limit spacing
      }
    }

    this.processing = false;
  }
}
```

### 5. Progress Aggregation (Read-Only Master)

**Problem:** User wants single progress.md file, not split logs
**Solution:** Periodically aggregate split logs into master file

```typescript
class ProgressAggregator {
  async aggregate(): Promise<void> {
    const analyzeLog = await readFile('progress.analyze.md');
    const illustrateLog = await readFile('progress.illustrate.md');

    // Merge by timestamp, sort chronologically
    const entries = this.parseAndMerge(analyzeLog, illustrateLog);

    // Write to master progress.md
    await writeFile('progress.md', this.format(entries));
  }
}

// Run aggregation every 30 seconds
setInterval(() => aggregator.aggregate(), 30000);
```

---

## File Locking Strategy

### Approach: Atomic Rename Pattern

Instead of complex locking, use atomic filesystem operations:

```typescript
async function atomicWrite(filepath: string, data: string): Promise<void> {
  const tempPath = `${filepath}.tmp.${Date.now()}`;

  // 1. Write to temp file
  await writeFile(tempPath, data);

  // 2. Atomic rename (replaces original)
  await rename(tempPath, filepath);

  // No race condition - rename is atomic in POSIX
}
```

**Benefits:**
- No locks needed
- Works across processes
- Crash-safe (temp file cleanup)
- OS handles atomicity

**Tradeoffs:**
- Overwrites entire file (okay for small state files)
- Doesn't work for append operations (use split logs instead)

---

## Migration & Compatibility

### Backward Compatibility

**Option 1: Automatic Migration**
```typescript
async function migrateToSplitState(oldStatePath: string): Promise<void> {
  const oldState = JSON.parse(await readFile(oldStatePath));

  // Create new directory structure
  await mkdir('.analyze.state', { recursive: true });
  await mkdir('.illustrate.state', { recursive: true });

  // Split chapter data
  for (const [chapterNum, chapterData] of Object.entries(oldState.phases.analyze.chapters)) {
    await writeFile(
      `.analyze.state/chapter_${chapterNum}.json`,
      JSON.stringify(chapterData, null, 2)
    );
  }

  // Keep global state for metadata
  await writeFile('.imaginize.state.json', JSON.stringify({
    version: '3.0.0',
    bookTitle: oldState.bookTitle,
    // ... global metadata only
  }));
}
```

**Option 2: Feature Flag**
```typescript
const config = {
  useConcurrentPipelines: process.env.CONCURRENT === 'true' || false
};

if (config.useConcurrentPipelines) {
  await runConcurrentPipelines();
} else {
  await runSequentialPipelines(); // Old code path
}
```

### Resume Support

Split-state architecture makes resume easier:

```typescript
async function resumeAnalyzePipeline(): Promise<void> {
  const manifest = await loadManifest('.analyze.state/manifest.json');
  const incomplete = chapters.filter(
    ch => !manifest.completedChapters.includes(ch.number)
  );

  // Only process incomplete chapters
  for (const chapter of incomplete) {
    await analyzeChapter(chapter);
  }
}
```

---

## Performance Projections

### Time Savings Analysis

**Current Sequential:**
```
Analyze:    2.5 hours (83 ch × ~2 min/ch)
Wait:       2.5 hours (idle)
Illustrate: 2.5 hours (130 img × ~70s/img)
─────────────────────────────────────
Total:      5.0 hours
```

**Proposed Concurrent (Pipeline Overlap):**
```
Analyze:    2.5 hours (83 ch × ~2 min/ch)
Illustrate: 2.5 hours (overlaps, starts at minute 2)
            ├─ First image at T+2min
            ├─ Second image at T+3min
            └─ Last image at T+2.5hr
─────────────────────────────────────
Total:      ~2.6 hours (48% faster!)
```

**Theoretical Maximum (Full Parallelization):**
```
All Chapters: Parallel (limited by rate limit: 1/min)
              83 chapters × 1 min = 83 min = 1.4 hours
Images:       Sequential (rate limit: 1/min)
              130 images × 1 min = 130 min = 2.2 hours
─────────────────────────────────────
Total:        ~2.2 hours (56% faster)
```

### Resource Usage

**Memory:**
- Current: Holds all concepts in memory until Chapters.md written
- Proposed: Per-chapter files allow streaming (lower peak memory)
- Improvement: ~40% lower peak memory usage

**Disk I/O:**
- Current: 1 large write (Chapters.md), 83+ state updates
- Proposed: 83 small writes (chapters), 130 small writes (concepts)
- Impact: More writes, but smaller and isolated (less contention)

**Network:**
- Same API call count
- Better throughput utilization (no idle time)

---

## Risk Assessment

### High Risk

1. **Race Conditions Not Caught**
   - Risk: New race conditions in event handling
   - Mitigation: Comprehensive integration tests with concurrent scenarios

2. **Event Loss**
   - Risk: 'conceptsReady' event fires but illustrate pipeline not listening yet
   - Mitigation: Queue events until listener ready, persistent event log

### Medium Risk

3. **Manifest Corruption**
   - Risk: Manifest file gets corrupted during concurrent updates
   - Mitigation: Atomic writes, backup manifest on every update

4. **Incomplete Aggregation**
   - Risk: progress.md misses entries from split logs
   - Mitigation: Timestamp-based merge with deduplication

### Low Risk

5. **Increased Complexity**
   - Risk: Harder to debug concurrent issues
   - Mitigation: Extensive logging, replay capability

6. **Backward Compatibility**
   - Risk: Breaking existing workflows
   - Mitigation: Feature flag, migration tool

---

## Testing Strategy

### Unit Tests

1. **State Isolation Tests**
   ```typescript
   test('concurrent chapter writes do not conflict', async () => {
     await Promise.all([
       writeChapterState(9, concepts9),
       writeChapterState(10, concepts10)
     ]);

     expect(readChapterState(9)).toEqual(concepts9);
     expect(readChapterState(10)).toEqual(concepts10);
   });
   ```

2. **Manifest Atomicity Tests**
   ```typescript
   test('manifest updates are atomic', async () => {
     await Promise.all([
       markChapterComplete(9),
       markChapterComplete(10)
     ]);

     const manifest = await loadManifest();
     expect(manifest.completedChapters).toContain(9);
     expect(manifest.completedChapters).toContain(10);
   });
   ```

### Integration Tests

3. **Pipeline Coordination Tests**
   ```typescript
   test('illustrate pipeline processes concepts as they arrive', async () => {
     const results = [];

     orchestrator.on('imageComplete', (data) => {
       results.push(data.conceptId);
     });

     await orchestrator.startPipelines();

     expect(results).toHaveLength(130);
     expect(results[0]).toBe('ch9_scene1'); // First concept
   });
   ```

4. **Progress Aggregation Tests**
   ```typescript
   test('progress.md correctly aggregates split logs', async () => {
     // Simulate concurrent log entries
     await Promise.all([
       logAnalyze('Completed chapter 9'),
       logIllustrate('Generated image for chapter 9')
     ]);

     await aggregator.aggregate();

     const progress = await readFile('progress.md');
     expect(progress).toContain('Completed chapter 9');
     expect(progress).toContain('Generated image for chapter 9');
   });
   ```

### Load Tests

5. **Concurrent Load Test**
   ```typescript
   test('handles 83 concurrent chapter processes', async () => {
     const startTime = Date.now();

     await runConcurrentPipelines({
       chapters: allChapters,
       maxConcurrency: 83
     });

     const elapsed = Date.now() - startTime;
     expect(elapsed).toBeLessThan(3 * 60 * 60 * 1000); // < 3 hours
   });
   ```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create split-state directory structure
- [ ] Implement per-chapter state files
- [ ] Implement manifest tracking
- [ ] Implement atomic write helpers
- [ ] Unit tests for state isolation

### Phase 2: Pipeline Split (Week 1)
- [ ] Refactor AnalyzePhase for event emission
- [ ] Refactor IllustratePhase for event listening
- [ ] Implement EventEmitter orchestrator
- [ ] Integration tests for pipeline coordination

### Phase 3: Elements.md Integration (Week 2)
- [ ] Implement ElementsLookup service
- [ ] Parse Elements.md format
- [ ] Implement prompt enrichment
- [ ] Add character/creature consistency logic
- [ ] Test enrichment quality

### Phase 4: Progress Aggregation (Week 2)
- [ ] Implement split progress logs
- [ ] Implement ProgressAggregator
- [ ] Real-time aggregation (30s interval)
- [ ] Timestamp-based merge logic

### Phase 5: Migration & Compatibility (Week 2)
- [ ] Implement migration tool
- [ ] Add feature flag for gradual rollout
- [ ] Backward compatibility tests
- [ ] Resume support

### Phase 6: Optimization & Polish (Week 3)
- [ ] Rate limit queue optimization
- [ ] Memory usage profiling
- [ ] Error handling & recovery
- [ ] Documentation
- [ ] End-to-end tests

---

## Open Questions for Review

1. **Event Persistence:** Should 'conceptsReady' events be logged to disk in case illustrate pipeline crashes and needs to resume?

2. **Manifest Conflict Resolution:** If two processes try to update manifest simultaneously, what's the conflict resolution strategy?

3. **Elements.md Update Timing:** If Elements.md is generated AFTER some chapters are analyzed, how do we re-enrich those early chapters?

4. **Progress.md UX:** Should we show two separate tabs (Analyze | Illustrate) or a single unified timeline?

5. **Rollback Strategy:** If concurrent processing fails mid-way, how do we roll back to a consistent state?

6. **Testing Environment:** Do we need to test on actual slow/unreliable file systems to catch I/O race conditions?

---

## Next Steps

1. **Review with Zen MCP + Gemini:** Get AI expert review on architecture
2. **Stakeholder Approval:** Confirm design meets requirements
3. **Proof of Concept:** Implement Phase 1 foundation in branch
4. **Benchmark:** Measure actual time savings on test book
5. **Full Implementation:** Execute phases 2-6

---

## Appendix: Code Snippets

### A. Per-Chapter State Manager

```typescript
// src/lib/concurrent/chapter-state-manager.ts

import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export interface ChapterState {
  chapterNumber: number;
  chapterTitle: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  concepts?: any[];
  tokensUsed?: number;
  completedAt?: string;
  error?: string;
}

export class ChapterStateManager {
  private stateDir: string;

  constructor(outputDir: string, pipeline: 'analyze' | 'illustrate') {
    this.stateDir = join(outputDir, `.${pipeline}.state`);
  }

  async initialize(): Promise<void> {
    if (!existsSync(this.stateDir)) {
      await mkdir(this.stateDir, { recursive: true });
    }
  }

  async writeChapterState(state: ChapterState): Promise<void> {
    const filepath = join(this.stateDir, `chapter_${state.chapterNumber}.json`);
    await atomicWrite(filepath, JSON.stringify(state, null, 2));
  }

  async readChapterState(chapterNumber: number): Promise<ChapterState | null> {
    const filepath = join(this.stateDir, `chapter_${chapterNumber}.json`);

    if (!existsSync(filepath)) {
      return null;
    }

    const data = await readFile(filepath, 'utf-8');
    return JSON.parse(data);
  }

  async listCompletedChapters(): Promise<number[]> {
    const manifest = await this.loadManifest();
    return manifest.completedChapters;
  }

  private async loadManifest(): Promise<any> {
    const manifestPath = join(this.stateDir, 'manifest.json');

    if (!existsSync(manifestPath)) {
      return { completedChapters: [], inProgressChapters: [] };
    }

    const data = await readFile(manifestPath, 'utf-8');
    return JSON.parse(data);
  }
}

async function atomicWrite(filepath: string, data: string): Promise<void> {
  const tempPath = `${filepath}.tmp.${Date.now()}`;
  await writeFile(tempPath, data);
  await rename(tempPath, filepath);
}
```

### B. Elements Enrichment Service

```typescript
// src/lib/concurrent/elements-lookup.ts

import { readFile } from 'fs/promises';

interface ElementData {
  type: 'character' | 'creature' | 'place' | 'item';
  name: string;
  description: string;
  appearances: string[];
}

export class ElementsLookup {
  private elements: Map<string, ElementData> = new Map();

  async load(elementsPath: string): Promise<void> {
    const content = await readFile(elementsPath, 'utf-8');

    // Parse markdown structure
    const sections = this.parseMarkdown(content);

    for (const section of sections) {
      const key = `${section.type}:${section.name.toLowerCase()}`;
      this.elements.set(key, section);
    }
  }

  lookup(type: string, name: string): ElementData | null {
    const key = `${type}:${name.toLowerCase()}`;
    return this.elements.get(key) || null;
  }

  enrichPrompt(baseConcept: any): string {
    let enriched = baseConcept.description;

    // Extract entity mentions
    const entities = this.extractEntities(baseConcept.description);

    // Lookup and inject details
    for (const entity of entities) {
      const data = this.lookup(entity.type, entity.name);

      if (data) {
        enriched += `\n\n${entity.name} details: ${data.description}`;
      }
    }

    // Add consistency directive
    enriched += `\n\nMaintain visual consistency with previous appearances of these characters/creatures.`;

    return enriched;
  }

  private extractEntities(text: string): Array<{type: string, name: string}> {
    // Simple regex-based extraction
    // In production, use NER or more sophisticated parsing
    const entities = [];

    // Match capitalized words (likely character names)
    const names = text.match(/\b[A-Z][a-z]+\b/g) || [];
    for (const name of names) {
      entities.push({ type: 'character', name });
    }

    return entities;
  }

  private parseMarkdown(content: string): ElementData[] {
    // Parse Elements.md format
    // Implementation details...
    return [];
  }
}
```

---

**End of Specification**

*Ready for Zen MCP + Gemini review.*
