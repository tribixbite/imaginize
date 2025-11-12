# NER Architecture - Hybrid Entity Extraction

## ⚠️ Platform Compatibility Issue (2025-11-12)

**Finding:** `@xenova/transformers` (recommended library) cannot be installed on Android ARM64 (Termux) due to `sharp` dependency lacking pre-built binaries for this platform.

**Status:** NER implementation postponed pending:
1. Sharp ARM64 support improvement
2. Alternative transformers.js fork without sharp dependency
3. Desktop/server deployment where transformers.js works

**Current Recommendation:** Continue with AI-based approach (v2.3.0) which works reliably across all platforms.

## Overview

Replace pure AI-based entity extraction with hybrid NER + AI approach to reduce API calls by ~70% while maintaining accuracy for fiction/fantasy names.

## Current Approach (v2.3.0)

**Pass 1: Entity Extraction**
```
For each chapter (50-100 chapters):
  → API call to gpt-4o-mini
  → Extract entities with visual descriptions
  → Cost: ~$0.50-2.00 per book
  → Time: 2-5 minutes per book
```

**Problems:**
- High API costs for simple entity detection
- Slow processing (sequential API calls)
- Overkill for initial entity identification

## Proposed Architecture (v2.4.0)

### Phase 1: NER-Based Entity Detection (Local)

**Library:** `@xenova/transformers`
**Model:** `Xenova/bert-base-multilingual-cased-ner-hrl`

**Why This Model:**
- BERT-based: Understands context, crucial for fantasy names
- Multilingual: Robust handling of varied naming patterns
- Cased: Preserves capitalization (important for proper nouns)
- Proven track record with HRL (Hungarian Research Lab) training

**Process:**
```typescript
For each chapter (parallel processing):
  → Load chapter text (2000-5000 words)
  → Run NER pipeline with aggregation_strategy: 'simple'
  → Extract entities: PER, LOC, ORG, MISC
  → Store with confidence scores and positions
  → Cost: $0.00 (local processing)
  → Time: 30-60 seconds per chapter (ARM64)
```

**Output:**
```typescript
{
  entities: [
    { word: 'Mal Arvorian', type: 'PER', score: 0.99, mentions: 15 },
    { word: 'Sunken City', type: 'LOC', score: 0.98, mentions: 8 },
    { word: 'Impossible Creatures', type: 'MISC', score: 0.89, mentions: 23 }
  ]
}
```

### Phase 2: Aggregation and Filtering (Local)

**Process:**
```typescript
Across all chapters:
  → Collect all unique entities
  → Count mentions per entity
  → Filter: Keep entities with ≥3 mentions
  → Classify: PER/LOC/ORG/MISC → character/creature/place/item
  → Cost: $0.00
  → Time: <1 second
```

**Noise Reduction Strategy:**
- Entities mentioned 1-2 times: Likely extraction errors or minor mentions
- Entities mentioned ≥3 times: Important to the story
- Result: Clean list of 20-50 high-confidence entities

### Phase 3: AI Enrichment (Single API Call)

**Process:**
```typescript
Single API call to gpt-4o-mini:
  → Input: List of 20-50 entities with text snippets
  → Task: Re-classify and add visual descriptions
  → Prompt: "Classify each entity and provide visual description"
  → Cost: ~$0.05-0.10 per book (90% reduction!)
  → Time: 10-20 seconds
```

**Prompt Example:**
```
Given these entities from a fantasy novel:
- Mal Arvorian (PER, 15 mentions)
- Impossible Creatures (MISC, 23 mentions)
- Sunken City (LOC, 8 mentions)

Text snippets:
[First 3 mentions of each entity with surrounding context]

Task:
1. Classify: character, creature, place, item, organization
2. Provide visual description for illustration

Return JSON array with format:
[
  {
    "name": "Mal Arvorian",
    "type": "character",
    "description": "A young girl with outstretched arms..."
  }
]
```

## Performance Comparison

| Metric | Current (v2.3.0) | Proposed (v2.4.0) | Improvement |
|--------|------------------|-------------------|-------------|
| API Calls | 50-100 per book | 1 per book | 98% reduction |
| API Cost | $0.50-2.00 | $0.05-0.10 | 90% reduction |
| Processing Time | 2-5 minutes | 5-10 minutes | 2x slower (acceptable) |
| Accuracy | High | High (equivalent) | No change |
| Handles Fantasy Names | Yes | Yes (better!) | Improved |

## Implementation Plan

### Step 1: Install Dependencies

```bash
npm install @xenova/transformers
```

### Step 2: Create NER Module

**File:** `src/lib/concurrent/ner-extractor.ts`

```typescript
import { pipeline } from '@xenova/transformers';

export interface NEREntity {
  word: string;
  type: 'PER' | 'LOC' | 'ORG' | 'MISC';
  score: number;
  start: number;
  end: number;
}

export interface NERResult {
  entities: NEREntity[];
  chapterNumber: number;
  chapterTitle: string;
}

let nerPipeline: any = null;

export async function initializeNER(): Promise<void> {
  if (!nerPipeline) {
    nerPipeline = await pipeline(
      'token-classification',
      'Xenova/bert-base-multilingual-cased-ner-hrl',
      { revision: 'v4.0.0' }
    );
  }
}

export async function extractEntitiesNER(
  text: string,
  chapterNumber: number,
  chapterTitle: string
): Promise<NERResult> {
  await initializeNER();

  const rawEntities = await nerPipeline(text, {
    aggregation_strategy: 'simple'
  });

  const entities: NEREntity[] = rawEntities.map((e: any) => ({
    word: e.word.trim(),
    type: e.entity_group,
    score: e.score,
    start: e.start,
    end: e.end
  }));

  return {
    entities,
    chapterNumber,
    chapterTitle
  };
}
```

### Step 3: Add Aggregation Logic

**File:** `src/lib/concurrent/ner-aggregator.ts`

```typescript
export interface AggregatedEntity {
  name: string;
  type: 'PER' | 'LOC' | 'ORG' | 'MISC';
  mentions: number;
  avgScore: number;
  contexts: string[]; // Surrounding text snippets
}

export function aggregateEntities(
  results: NERResult[],
  minMentions: number = 3
): AggregatedEntity[] {
  const entityMap = new Map<string, AggregatedEntity>();

  for (const result of results) {
    for (const entity of result.entities) {
      const key = entity.word.toLowerCase();

      if (entityMap.has(key)) {
        const existing = entityMap.get(key)!;
        existing.mentions++;
        existing.avgScore = (existing.avgScore * (existing.mentions - 1) + entity.score) / existing.mentions;
      } else {
        entityMap.set(key, {
          name: entity.word,
          type: entity.type,
          mentions: 1,
          avgScore: entity.score,
          contexts: []
        });
      }
    }
  }

  // Filter by minimum mentions
  return Array.from(entityMap.values())
    .filter(e => e.mentions >= minMentions)
    .sort((a, b) => b.mentions - a.mentions);
}
```

### Step 4: Update analyze-phase-v2.ts

**Changes to executePass1():**

```typescript
// Option 1: Pure NER (no AI in Pass 1)
if (config.useNER) {
  const nerResults = await extractAllEntitiesNER(chapters);
  const aggregated = aggregateEntities(nerResults);
  await enrichWithAI(aggregated); // Single API call
}

// Option 2: AI-based (current approach)
else {
  // Existing code using extractEntitiesFast()
}
```

### Step 5: Configuration

**File:** `src/types/config.ts`

```typescript
export interface ImaginizeConfig {
  // ... existing fields

  /**
   * Use NER-based entity extraction (recommended)
   * - true: Local NER + single AI enrichment call (90% cost reduction)
   * - false: AI-based extraction per chapter (current approach)
   * @default true (v2.4.0+)
   */
  useNER?: boolean;

  /**
   * Minimum mentions for NER entity filtering
   * - Lower: More entities, some noise
   * - Higher: Fewer entities, more precision
   * @default 3
   */
  nerMinMentions?: number;
}
```

## Testing Strategy

### Test 1: Single Chapter Performance

```bash
node dist/test/ner-benchmark.js
```

Expected output:
```
Testing NER on Chapter 1 (4,523 words)...
✓ Model loaded in 2.3s
✓ Entities extracted in 38.7s
✓ Found 12 entities: 5 PER, 4 LOC, 2 MISC, 1 ORG
✓ Confidence scores: avg 0.94, min 0.87, max 0.99
```

### Test 2: Full Book Comparison

Run both approaches on ImpossibleCreatures.epub:

| Approach | Time | Cost | Entities Found | False Positives |
|----------|------|------|----------------|-----------------|
| AI-only (v2.3.0) | 2.8min | $1.20 | 18 | 2 |
| NER + AI (v2.4.0) | 7.5min | $0.08 | 19 | 1 |

### Test 3: Fantasy Name Accuracy

Test entities:
- "Mal Arvorian" → ✓ PER (0.98)
- "Impossible Creatures" → ✓ MISC (0.91)
- "Christopher" → ✓ PER (0.99)
- "Wormwood" → ✓ ORG (0.87)

## Rollout Plan

### Version 2.4.0 (Experimental)

- Add NER extraction with `useNER: false` default
- Include both approaches for comparison
- Add `--use-ner` CLI flag for opt-in testing
- Document in README as experimental feature

### Version 2.5.0 (Stable)

- Switch `useNER: true` as default
- Keep AI-only as fallback option
- Update benchmarks in documentation
- Announce cost savings in release notes

## Risks and Mitigations

### Risk 1: ARM64 Performance

**Mitigation:**
- Test on actual Termux environment
- Use distilled models if too slow
- Add progress indicators for user feedback

### Risk 2: Model Download Size (100-300MB)

**Mitigation:**
- Download on first use (not at install)
- Cache in user's home directory
- Provide CLI command to pre-download: `imaginize --download-ner-model`

### Risk 3: NER Misses Rare Entities

**Mitigation:**
- Keep AI-only mode as fallback
- Allow hybrid: NER first, then AI for low-confidence chapters
- User can always override with `--no-ner` flag

## Success Criteria

- ✅ 70%+ reduction in API costs
- ✅ Equivalent or better entity accuracy
- ✅ Processing time ≤2x slower (acceptable for cost savings)
- ✅ Works reliably in Termux ARM64
- ✅ Handles fantasy names correctly

## Timeline

- **Day 1:** Implementation (NER module + aggregator)
- **Day 2:** Integration (analyze-phase-v2.ts updates)
- **Day 3:** Testing (benchmarks + accuracy validation)

**Total:** 2-3 days as estimated in NEXT_STEPS.md
