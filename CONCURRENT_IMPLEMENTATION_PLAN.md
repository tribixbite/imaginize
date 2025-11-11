# Concurrent Processing - Implementation Plan

**Status:** Ready for Implementation
**Based On:** CONCURRENT_ARCHITECTURE.md + Gemini Expert Review
**Timeline:** 3 weeks (phased rollout)
**Risk Level:** Medium (with mitigation strategies)

---

## Executive Summary

**Approved Architecture:** Split-state concurrent processing with mandatory fixes
**Expected Performance:** 40% improvement (5 hours → 3 hours)
**Key Innovation:** Two-pass analyze + manifest-driven coordination

### Expert Validation Results

✅ **Architecture Approved** with critical fixes
✅ **Phased rollout** with feature flag recommended
✅ **Performance projections** adjusted to 40% (realistic)

---

## Critical Fixes Required (MUST IMPLEMENT)

### Fix #1: Replace EventEmitter with Manifest-Driven State Machine

**Problem:** EventEmitter is in-memory only - events lost on crash/late start

**Expert Recommendation:**
> "The manifest must become a robust, transactional source of truth. An event-emitter model is too fragile for this use case."

**Solution:** Hybrid manifest polling + state machine

```typescript
// NEW: Manifest-driven coordination (no EventEmitter!)
class IllustratePipeline {
  async run() {
    // Wait for Elements.md to be ready
    await this.waitForElementsReady();

    // Poll manifest for chapters ready to illustrate
    while (true) {
      const manifest = await this.loadManifestWithLock();

      // Find chapters in 'analyzed' state
      const ready = Object.entries(manifest.chapters)
        .filter(([_, ch]) => ch.status === 'analyzed')
        .map(([num, _]) => parseInt(num));

      if (ready.length === 0) {
        // Check if analyze is done
        if (manifest.analyze_complete) {
          break; // All done
        }
        await sleep(10000); // Wait 10s and retry
        continue;
      }

      // Process first ready chapter
      await this.processChapter(ready[0]);
    }
  }

  async processChapter(chapterNum: number) {
    // Atomically claim chapter
    await this.updateManifestWithLock(manifest => {
      manifest.chapters[chapterNum].status = 'illustration_inprogress';
    });

    // Generate images
    await this.generateImagesForChapter(chapterNum);

    // Mark complete
    await this.updateManifestWithLock(manifest => {
      manifest.chapters[chapterNum].status = 'illustration_complete';
      manifest.chapters[chapterNum].illustrated_at = new Date().toISOString();
    });
  }
}
```

### Fix #2: Two-Pass Analyze Process

**Problem:** Elements.md created AFTER some chapters analyzed, causing inconsistent enrichment

**Expert Recommendation:**
> "A two-pass `analyze` process: Pass 1 extracts all entities, Pass 2 performs full analysis."

**Solution:** Fast entity extraction, then full analysis

```typescript
class AnalyzePipeline {
  async run() {
    // PASS 1: Fast entity extraction (all chapters)
    console.log('Pass 1: Extracting entities from all chapters...');
    const allEntities = [];

    for (const chapter of chapters) {
      const entities = await this.extractEntitiesFast(chapter);
      allEntities.push(...entities);
    }

    // Generate complete Elements.md
    await this.generateElementsFile(allEntities);

    // Mark Elements.md as ready
    await this.updateManifestWithLock(manifest => {
      manifest.elements_md_status = 'complete';
    });

    console.log('✅ Elements.md complete. Starting full analysis...');

    // PASS 2: Full chapter analysis (can be parallel!)
    for (const chapter of chapters) {
      const concepts = await this.analyzeChapterFull(chapter);

      await this.saveChapterConcepts(chapter.number, concepts);

      // Mark chapter as analyzed (triggers illustrate pipeline)
      await this.updateManifestWithLock(manifest => {
        manifest.chapters[chapter.number] = {
          status: 'analyzed',
          analyzed_at: new Date().toISOString(),
          concepts: concepts.length
        };
      });
    }

    // Mark analyze complete
    await this.updateManifestWithLock(manifest => {
      manifest.analyze_complete = true;
    });
  }
}
```

### Fix #3: Robust Locking Mechanism

**Problem:** No protection against concurrent process conflicts

**Expert Recommendation:**
> "Use a file lock to prevent two processes from performing an atomic write simultaneously."

**Solution:** File-based exclusive locking with try/finally

```typescript
// src/lib/concurrent/file-lock.ts

import { mkdir, rmdir } from 'fs/promises';
import { existsSync } from 'fs';

export class FileLock {
  private lockDir: string;
  private acquired = false;

  constructor(filepath: string) {
    this.lockDir = `${filepath}.lock`;
  }

  async acquire(timeoutMs = 60000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Atomic operation: create directory (fails if exists)
        await mkdir(this.lockDir, { recursive: false });
        this.acquired = true;
        return;
      } catch (error: any) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
        // Lock held by another process, wait and retry
        await sleep(100);
      }
    }

    throw new Error(`Failed to acquire lock after ${timeoutMs}ms`);
  }

  async release(): Promise<void> {
    if (!this.acquired) {
      return;
    }

    try {
      await rmdir(this.lockDir);
      this.acquired = false;
    } catch (error: any) {
      // Lock directory already removed (benign)
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      await this.release();
    }
  }
}

// Usage
async function updateManifestWithLock(updater: (manifest: any) => void) {
  const lock = new FileLock('manifest.json');

  await lock.withLock(async () => {
    // Read
    const manifest = JSON.parse(await readFile('manifest.json', 'utf-8'));

    // Modify
    updater(manifest);

    // Atomic write
    await atomicWrite('manifest.json', JSON.stringify(manifest, null, 2));
  });
}
```

### Fix #4: Manifest State Machine

**Problem:** Current state doesn't track individual chapter status

**Expert Recommendation:**
> "The manifest should track per-chapter status. This is key to idempotency and recovery."

**Solution:** Chapter-level state tracking

```json
{
  "version": "3.0.0",
  "book_id": "ImpossibleCreatures",
  "elements_md_status": "complete",
  "analyze_complete": false,
  "illustrate_complete": false,
  "chapters": {
    "9": {
      "status": "illustration_complete",
      "analyzed_at": "2025-11-11T10:30:00.000Z",
      "illustrated_at": "2025-11-11T11:45:00.000Z",
      "concepts": 1
    },
    "10": {
      "status": "analyzed",
      "analyzed_at": "2025-11-11T10:32:00.000Z",
      "concepts": 1
    },
    "11": {
      "status": "illustration_inprogress",
      "analyzed_at": "2025-11-11T10:34:00.000Z",
      "concepts": 1
    },
    "12": {
      "status": "pending"
    }
  },
  "last_updated": "2025-11-11T11:45:00.000Z"
}
```

**State Transitions:**
```
pending → analyzed → illustration_inprogress → illustration_complete
                                            ↘ error
```

---

## Implementation Phases

### Phase 1: Foundational Safety (Week 1 - Days 1-3)

**Goal:** Bulletproof state management before adding concurrency

#### Tasks

1. **Create FileLock utility** ✓ See Fix #3 code above
   - File: `src/lib/concurrent/file-lock.ts`
   - Tests: Lock acquisition, timeout, release on error

2. **Centralize manifest updates**
   - File: `src/lib/concurrent/manifest-manager.ts`
   - Single function: `updateManifestWithLock(updater)`
   - Atomic write pattern: temp file → rename

3. **Update manifest schema**
   - Add `elements_md_status` field
   - Add per-chapter status tracking
   - Add completion flags

4. **Migration tool**
   - Convert old `.imaginize.state.json` to new format
   - Preserve existing progress
   - CLI: `npx imaginize --migrate-concurrent`

#### Acceptance Criteria

- [ ] FileLock passes concurrent access tests
- [ ] Manifest updates are atomic (no corruption under stress test)
- [ ] Migration tool preserves all data
- [ ] Old state files still readable (backward compat)

---

### Phase 2: Two-Pass Analyze (Week 1-2 - Days 4-7)

**Goal:** Solve Elements.md timing dependency

#### Tasks

1. **Implement fast entity extraction**
   - New method: `extractEntitiesFast(chapter)`
   - Minimal AI call - just extract character/creature/place names
   - Use lightweight regex + NER if available

2. **Refactor analyze workflow**
   - Pass 1: Loop all chapters → extract entities
   - Generate Elements.md
   - Update manifest: `elements_md_status = 'complete'`
   - Pass 2: Full analysis with enrichment

3. **ElementsLookup service** (from architecture spec)
   - Parse Elements.md markdown
   - Build searchable index
   - Method: `enrichPrompt(baseConcept)`

4. **Update AnalyzePhase class**
   - Split `execute()` into `executePass1()` and `executePass2()`
   - Add progress tracking for both passes

#### Acceptance Criteria

- [ ] Elements.md generated before any full chapter analysis
- [ ] All chapters analyzed with complete Elements.md available
- [ ] Enriched prompts include character/creature details
- [ ] Pass 1 completes in < 20 minutes for 83 chapters

---

### Phase 3: Manifest-Driven Illustrate (Week 2 - Days 8-10)

**Goal:** Replace EventEmitter with robust polling

#### Tasks

1. **Refactor IllustratePhase**
   - Remove EventEmitter dependency
   - Implement manifest polling loop (10s interval)
   - Wait for `elements_md_status === 'complete'`

2. **Atomic chapter claiming**
   - Lock manifest
   - Find first `status === 'analyzed'`
   - Update to `illustration_inprogress`
   - Unlock manifest

3. **Recovery logic**
   - On startup, find stuck chapters (inprogress > 30 min)
   - Reset to `analyzed` state
   - Resume processing

4. **Completion detection**
   - Check `analyze_complete === true` AND no pending chapters
   - Update `illustrate_complete = true`
   - Exit gracefully

#### Acceptance Criteria

- [ ] Illustrate pipeline starts as soon as first chapter analyzed
- [ ] Crashed illustrate process resumes correctly
- [ ] No duplicate image generation
- [ ] Clean shutdown when all chapters complete

---

### Phase 4: Integration & Testing (Week 2-3 - Days 11-14)

**Goal:** End-to-end validation

#### Tasks

1. **Concurrent execution test**
   - Start analyze in background
   - Start illustrate after 2 minutes
   - Verify both run simultaneously
   - Measure total time (should be ~3 hours)

2. **Crash recovery tests**
   - Kill analyze mid-execution → restart → verify resume
   - Kill illustrate mid-execution → restart → verify resume
   - Corrupt manifest → verify detection and recovery

3. **Edge case tests**
   - Empty book (0 chapters)
   - Single chapter book
   - Book with no story content (all front matter)
   - Elements.md doesn't exist (handle gracefully)

4. **Performance validation**
   - Run sequential baseline (5 hours expected)
   - Run concurrent (3 hours expected)
   - Measure actual improvement

#### Acceptance Criteria

- [ ] Concurrent execution 35-45% faster than sequential
- [ ] Zero data loss under crash scenarios
- [ ] All edge cases handled gracefully
- [ ] No race conditions observed under stress test

---

### Phase 5: Feature Flag & Rollout (Week 3 - Days 15-21)

**Goal:** Safe production rollout

#### Tasks

1. **Add feature flag**
   ```typescript
   // .imaginize.config
   {
     "experimentalConcurrent": false  // Default: off
   }
   ```

2. **CLI flag**
   ```bash
   npx imaginize --concurrent     # Enable concurrent
   npx imaginize --sequential     # Force old code path
   ```

3. **Environment variable**
   ```bash
   IMAGINIZE_CONCURRENT=true npx imaginize
   ```

4. **Documentation**
   - Update README with `--concurrent` flag
   - Document two-pass analyze behavior
   - Add troubleshooting guide

5. **Gradual rollout**
   - Week 1: Internal testing only
   - Week 2: Beta users (feature flag opt-in)
   - Week 3: Default enabled, keep fallback for 2 releases

#### Acceptance Criteria

- [ ] Feature flag works correctly
- [ ] Both code paths maintained
- [ ] Documentation complete
- [ ] Rollback plan tested

---

## Code Changes Summary

### New Files

```
src/lib/concurrent/
├── file-lock.ts               # Locking mechanism
├── manifest-manager.ts        # Centralized manifest updates
├── elements-lookup.ts         # Elements.md parsing & enrichment
└── types.ts                   # TypeScript interfaces

src/lib/phases/
├── analyze-phase-v2.ts        # Two-pass analyze
└── illustrate-phase-v2.ts     # Manifest-driven illustrate
```

### Modified Files

```
src/index.ts                   # Add --concurrent flag, route to v2
src/lib/state-manager.ts       # Deprecate (keep for migration)
src/lib/config.ts              # Add experimentalConcurrent flag
package.json                   # Add migration script
```

### Migration Script

```bash
npx imaginize --migrate-concurrent
```

---

## Risk Mitigation

### High-Risk Items

1. **Manifest corruption during concurrent writes**
   - Mitigation: FileLock + atomic writes + backup on every update
   - Test: Stress test with 10 concurrent processes

2. **Pass 1 entity extraction misses entities**
   - Mitigation: Conservative extraction (false positives okay)
   - Test: Validate against known character list

3. **Performance doesn't meet 40% target**
   - Mitigation: Profile bottlenecks, optimize Pass 1
   - Test: Benchmark on multiple books

### Medium-Risk Items

4. **Feature flag bugs causing crashes**
   - Mitigation: Extensive testing of both code paths
   - Test: Toggle flag mid-book processing

5. **Migration data loss**
   - Mitigation: Backup old state before migration
   - Test: Migrate multiple state files

---

## Testing Strategy

### Unit Tests (80+ tests)

```typescript
// file-lock.test.ts
describe('FileLock', () => {
  test('prevents concurrent access', async () => {
    const lock1 = new FileLock('test.json');
    const lock2 = new FileLock('test.json');

    await lock1.acquire();
    await expect(lock2.acquire(1000)).rejects.toThrow('Failed to acquire lock');
  });

  test('releases lock on error', async () => {
    const lock = new FileLock('test.json');
    await expect(lock.withLock(async () => {
      throw new Error('test error');
    })).rejects.toThrow('test error');

    // Lock should be released
    const lock2 = new FileLock('test.json');
    await expect(lock2.acquire()).resolves.not.toThrow();
  });
});

// manifest-manager.test.ts
describe('ManifestManager', () => {
  test('atomic updates under concurrent load', async () => {
    await Promise.all([
      updateManifest(m => m.chapters['9'].status = 'analyzed'),
      updateManifest(m => m.chapters['10'].status = 'analyzed'),
      updateManifest(m => m.chapters['11'].status = 'analyzed')
    ]);

    const manifest = await loadManifest();
    expect(manifest.chapters['9'].status).toBe('analyzed');
    expect(manifest.chapters['10'].status).toBe('analyzed');
    expect(manifest.chapters['11'].status).toBe('analyzed');
  });
});

// analyze-phase-v2.test.ts
describe('TwoPassAnalyze', () => {
  test('Elements.md created before Pass 2', async () => {
    const phase = new AnalyzePhaseV2(context);

    await phase.executePass1();
    expect(existsSync('Elements.md')).toBe(true);

    const manifest = await loadManifest();
    expect(manifest.elements_md_status).toBe('complete');
  });
});
```

### Integration Tests (20+ tests)

```typescript
describe('ConcurrentExecution', () => {
  test('analyze and illustrate run simultaneously', async () => {
    const analyzePromise = new AnalyzePhaseV2(context).execute();

    // Wait for first chapter to analyze
    await waitForCondition(() =>
      getManifest().chapters['9']?.status === 'analyzed',
      { timeout: 120000 }
    );

    const illustratePromise = new IllustratePhaseV2(context).execute();

    // Both should complete
    await Promise.all([analyzePromise, illustratePromise]);

    expect(totalTime).toBeLessThan(4 * 60 * 60 * 1000); // < 4 hours
  });
});
```

### Manual Test Plan

1. **Baseline Sequential Run**
   ```bash
   time npx imaginize --sequential --text --images --file test.epub
   # Expected: ~5 hours
   ```

2. **Concurrent Run**
   ```bash
   time npx imaginize --concurrent --text --images --file test.epub
   # Expected: ~3 hours
   ```

3. **Crash Recovery**
   ```bash
   # Start concurrent run
   npx imaginize --concurrent --text --images --file test.epub &
   PID=$!

   # Kill after 30 minutes
   sleep 1800 && kill $PID

   # Resume
   npx imaginize --concurrent --continue --text --images --file test.epub
   # Expected: Resumes from where it left off
   ```

---

## Success Metrics

### Performance

- [ ] Total time reduced by 35-45% (5h → 3-3.5h)
- [ ] First image generated within 5 minutes of start
- [ ] Memory usage stable (no leaks)

### Reliability

- [ ] Zero data corruption in 100 test runs
- [ ] 100% crash recovery success rate
- [ ] No duplicate image generation

### User Experience

- [ ] Progress visible from minute 1
- [ ] Clear error messages on conflicts
- [ ] Easy rollback to sequential mode

---

## Rollback Plan

If concurrent mode fails in production:

1. **Immediate Rollback**
   ```bash
   npx imaginize --sequential  # Force old code path
   ```

2. **Disable Feature Flag**
   ```typescript
   // config.ts
   experimentalConcurrent: false  // Default off
   ```

3. **Data Recovery**
   - Old `.imaginize.state.json` preserved during migration
   - Can restore: `cp .imaginize.state.json.backup .imaginize.state.json`

---

## Post-Implementation

### Monitoring

- [ ] Track concurrent vs sequential usage (telemetry)
- [ ] Monitor crash/recovery rates
- [ ] Collect user feedback on performance

### Future Enhancements

1. **Parallel chapter analysis** (Week 4+)
   - Analyze multiple chapters simultaneously
   - Respect API rate limits
   - Further reduce total time to ~2 hours

2. **Better entity extraction** (Week 6+)
   - Replace regex with NER library
   - Or use LLM-based extraction
   - Improves accuracy

3. **Real-time progress UI** (Week 8+)
   - Web dashboard showing both pipelines
   - Live image preview
   - ETA calculation

---

## Expert Recommendations Summary

From Gemini expert review:

> "I approve moving forward with the concurrent architecture, contingent on implementing these fixes. The foundational safety work in Phase 1 is paramount. I also strongly recommend wrapping the new concurrent implementation in a feature flag so you can easily revert to the old, stable sequential logic if unforeseen issues arise in production."

**Key Takeaways:**
1. ✅ Phase 1 (locking + atomic writes) is **critical foundation**
2. ✅ Two-pass analyze solves Elements.md timing elegantly
3. ✅ Manifest-driven coordination more robust than EventEmitter
4. ✅ Feature flag essential for safe rollout
5. ✅ Keep sequential code as fallback for 2-3 releases

---

## Next Steps

1. **Review this plan** - Get stakeholder approval
2. **Set up feature branch** - `feature/concurrent-processing`
3. **Implement Phase 1** - Foundation (3 days)
4. **Daily progress updates** - Track against timeline
5. **Weekly demos** - Show incremental progress

**Ready to start?** Begin with Phase 1: FileLock implementation.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-11
**Reviewed By:** Gemini 2.5 Pro (Zen MCP)
**Approved:** ✅ With critical fixes implemented
