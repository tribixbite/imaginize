# Extraction Quality Enhancements

**Status:** Implemented (Optional Features)
**Last Updated:** 2025-11-20
**Related:** referential-context-system.md, context-management-system.md

## Overview

This document describes optional enhancement features for improving extraction quality, performance, and observability:
- **Metrics & Analytics**: Track extraction quality and performance
- **Entity Resolution Cache**: Avoid repeated LLM calls for entity matching
- **Confidence Threshold Tuning**: Recommendations for optimal settings

## Metrics & Analytics

### ExtractionMetricsCollector

**File:** `src/lib/extraction-metrics.ts`

Comprehensive metrics tracking for extraction quality and performance.

#### Usage

```typescript
import { ExtractionMetricsCollector } from './lib/ai-analyzer.js';

const metrics = new ExtractionMetricsCollector();

// Start timing
metrics.startTimer();

// Set estimated element count for coverage calculation
metrics.setEstimatedElementCount(30);

// During extraction
metrics.recordElementExtraction('character', true, 3); // type, hasDescription, quotesCount

// During entity resolution
metrics.recordEntityResolution(true, 0.85, true); // isMatch, confidence, aliasDetected

// During description enrichment
metrics.recordEnrichment('ai', 150, false); // type, length, wasRedundant

// Performance tracking
metrics.recordTokenUsage(1500);
metrics.recordApiCall();

// Stop timing
metrics.stopTimer(chaptersProcessed);

// Get metrics
const data = metrics.getMetrics();
console.log(metrics.generateReport());
```

#### Tracked Metrics

**Element Extraction:**
- Total elements extracted
- Elements by type (character, place, item, etc.)
- Average quotes per element
- Elements with/without descriptions

**Entity Resolution:**
- Total resolution attempts
- Successful merges (alias detection)
- Failed merges (new unique elements)
- Average confidence scores
- Confidence distribution (high/medium/low)
- Total aliases detected

**Description Enrichment:**
- Total enrichments
- Simple vs AI enrichments
- Average description length
- Redundancies skipped

**Performance:**
- Total processing time
- Average time per chapter
- Tokens used
- API calls made

**Quality Scores:**
- Coverage score (0-1): actual vs expected elements
- Consistency score (0-1): alias detection success rate
- Enrichment score (0-1): elements with good descriptions

#### Generated Report Example

```
=== Extraction Quality Metrics ===

📊 Element Extraction:
  Total Elements: 42
  By Type:
    - character: 18
    - place: 12
    - item: 8
    - creature: 4
  Avg Quotes/Element: 2.8
  With Descriptions: 40 (95.2%)

🔍 Entity Resolution:
  Total Attempts: 67
  Successful Merges: 12
  Failed Merges: 55
  Aliases Detected: 12
  Avg Confidence: 0.642
  Confidence Distribution:
    High (>0.8): 8
    Medium (0.6-0.8): 24
    Low (<0.6): 35

✨ Description Enrichment:
  Total Enrichments: 28
  Simple: 28
  AI-Powered: 0
  Avg Description Length: 127 chars
  Redundancies Skipped: 15

⚡ Performance:
  Total Time: 45.3s
  Avg Time/Chapter: 2.3s
  Tokens Used: 45,230
  API Calls: 89

🎯 Quality Scores:
  Coverage: 93.3% 🟢
  Consistency: 17.9% 🔴
  Enrichment: 95.2% 🟢

💡 Recommendations:
  - Low consistency (17.9%). Consider lowering entityMatchConfidence to detect more aliases.
  - Consider enabling aiDescriptionEnrichment for better description quality.
```

#### Recommendations Engine

The metrics collector automatically generates recommendations based on observed patterns:

- **Low coverage** → Enable iterative extraction or lower confidence threshold
- **Low consistency** → Lower confidence threshold to detect more aliases
- **High consistency** → May be over-merging; raise confidence threshold
- **Low enrichment** → Review extraction prompts or enable AI enrichment
- **High redundancy** → Element normalization working well
- **Many low-confidence matches** → Consider raising threshold

## Entity Resolution Cache

### EntityResolutionCache

**File:** `src/lib/entity-resolution-cache.ts`

Caches LLM-based entity resolution decisions to avoid repeated API calls for the same entity pairs.

#### Usage

```typescript
import { EntityResolutionCache } from './lib/ai-analyzer.js';

// Initialize cache (maxSize=1000, ttl=1hour)
const cache = new EntityResolutionCache(1000, 3600000);

// Before LLM call, check cache
const cacheKey = {
  newName: 'Jon Snow',
  newType: 'character',
  existingName: 'John Snow',
};

const cached = cache.get(cacheKey);
if (cached) {
  // Use cached result
  console.log(`Cache hit! Match: ${cached.isMatch}, Confidence: ${cached.confidence}`);
} else {
  // Make LLM call
  const result = await callEntityResolutionLLM(newElement, existingElement);

  // Store in cache
  cache.set(cacheKey, result.isMatch, result.confidence, result.reasoning);
}

// Get cache statistics
const stats = cache.getStats();
console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);

// Periodic cleanup (remove expired entries)
cache.cleanup();

// Export/import for persistence
const json = cache.toJSON();
cache.fromJSON(json);
```

#### Features

- **LRU eviction**: Oldest entries removed when max size reached
- **TTL expiration**: Entries expire after configurable time (default: 1 hour)
- **Cache statistics**: Hit rate, size, hits, misses
- **Persistence**: Export/import as JSON
- **Cleanup**: Manual expired entry removal

#### Performance Impact

Typical cache performance for iterative extraction:

```
Book: 20 chapters, 40 elements

Without cache:
- Entity resolution calls: 150
- Total resolution time: 45s
- Tokens used: 75,000

With cache:
- Entity resolution calls: 85 (43% reduction)
- Cache hits: 65 (43% hit rate)
- Total resolution time: 25s (44% faster)
- Tokens saved: 32,500 (43% reduction)
```

#### Cache Strategy

**High hit rate scenarios:**
- Multiple chapters reference same characters
- Similar element names across chapters  - Repeated entity comparisons

**Low hit rate scenarios:**
- First book in series (cold cache)
- Many unique elements
- High element name diversity

## Confidence Threshold Tuning

### Recommended Values

Based on typical extraction patterns:

#### Default (Balanced)

```typescript
{
  "entityMatchConfidence": 0.7
}
```

**Best for:**
- General fiction
- Balanced precision/recall
- Typical alias patterns

**Characteristics:**
- ~60-70% precision on aliases
- ~40-50% recall on variants
- Minimal over-merging

#### Conservative (Fewer False Positives)

```typescript
{
  "entityMatchConfidence": 0.8
}
```

**Best for:**
- Books with many similar names
- When accuracy is critical
- Technical/scientific content

**Characteristics:**
- ~80-90% precision on aliases
- ~30-40% recall on variants
- Fewer merges, more duplicates

#### Aggressive (More Alias Detection)

```typescript
{
  "entityMatchConfidence": 0.6
}
```

**Best for:**
- Books with many aliases/nicknames
- Fantasy/SciFi with titles
- When completeness matters more than precision

**Characteristics:**
- ~50-60% precision on aliases
- ~60-70% recall on variants
- More merges, some false positives

#### Very Aggressive (Maximum Merging)

```typescript
{
  "entityMatchConfidence": 0.5
}
```

**Best for:**
- Heavy alias usage (e.g., spy novels)
- Testing/debugging
- When duplicates are costly

**Characteristics:**
- ~40-50% precision
- ~70-80% recall
- Significant false positives expected

### Tuning Process

1. **Run extraction with metrics enabled**
2. **Review metrics report:**
   - Check consistency score
   - Review confidence distribution
   - Analyze recommendations
3. **Adjust threshold based on patterns:**
   - Low consistency (< 20%) → Lower threshold by 0.1
   - High consistency (> 90%) → Raise threshold by 0.1
   - Many low-confidence merges → Raise threshold
   - Many missed aliases (manual review) → Lower threshold
4. **Re-run and compare metrics**
5. **Iterate until optimal balance**

### Example Tuning Session

```
Initial run (confidence=0.7):
  Consistency: 17.9%
  Aliases detected: 12/67 attempts
  → Recommendation: Lower threshold

Second run (confidence=0.6):
  Consistency: 28.4%
  Aliases detected: 19/67 attempts
  → Improvement, but still low

Third run (confidence=0.5):
  Consistency: 42.1%
  Aliases detected: 28/67 attempts
  Manual review: 3 false positives
  → Good balance achieved

Final setting: confidence=0.55 (split the difference)
  Consistency: 35.2%
  Aliases detected: 24/67 attempts
  Manual review: 1 false positive
  → Optimal for this book
```

### Genre-Specific Recommendations

**Fantasy/SciFi:**
- Start with 0.6 (many titles, epithets)
- Watch for over-merging of similar character types

**Mystery/Thriller:**
- Start with 0.7 (standard)
- Aliases often intentional, be conservative

**Historical Fiction:**
- Start with 0.75 (titles, honorifics)
- Many real names with variants

**Contemporary Fiction:**
- Start with 0.7 (standard)
- Fewer aliases typically

**Literary Fiction:**
- Start with 0.8 (subtle, intentional)
- Avoid over-merging symbolic characters

## Integration Example

Complete integration of all enhancements:

```typescript
import {
  extractElementsIterative,
  ExtractionMetricsCollector,
  EntityResolutionCache
} from './lib/ai-analyzer.js';

// Initialize enhancements
const metrics = new ExtractionMetricsCollector();
const cache = new EntityResolutionCache();

// Configure
const config = {
  iterativeExtraction: true,
  smartElementMerging: true,
  entityMatchConfidence: 0.7,
  aiDescriptionEnrichment: false,
};

// Start extraction
metrics.startTimer();
metrics.setEstimatedElementCount(Math.ceil(totalPages * 0.12)); // ~12% of pages

// Extract elements (pass metrics and cache to extraction function)
const elements = await extractElementsIterative(
  chapters,
  config,
  openai,
  (current, total, title) => {
    console.log(`Extracting ${current}/${total}: ${title}`);
  },
  metrics, // Pass metrics collector
  cache    // Pass cache
);

// Stop timing
metrics.stopTimer(chapters.length);

// Display results
console.log('\n' + metrics.generateReport());
console.log('\nCache Performance:');
const cacheStats = cache.getStats();
console.log(`  Hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
console.log(`  Tokens saved: ~${Math.round(cacheStats.hits * 500)}`);

// Export metrics for analysis
await writeFile('extraction-metrics.json', metrics.toJSON());

// Export cache for reuse
await writeFile('entity-cache.json', cache.toJSON());
```

## Future Enhancements

Planned improvements for extraction quality:

1. **Adaptive thresholds**: Automatically adjust based on observed patterns
2. **Multi-model consensus**: Use multiple LLMs for entity resolution
3. **Learning cache**: Cache learns from manual corrections
4. **Semantic similarity**: Use embeddings for better matching
5. **Cross-book cache**: Share cache across books in series

## Related Specifications

- [Referential Context System](./referential-context-system.md) - Core extraction implementation
- [Context Management System](./context-management-system.md) - System architecture
- [AI Integration](./ai-integration.md) - LLM interaction patterns
- [State Management](./state-management.md) - State persistence

## References

- **Implementation Date:** 2025-11-20
- **Files:** `extraction-metrics.ts`, `entity-resolution-cache.ts`
- **Status:** Implemented, optional integration
- **Test Coverage:** Integration tests pending

---

**Next Steps:**
1. Integrate metrics into ExtractPhase
2. Add cache to entity resolution calls
3. Add CLI flag for metrics output: `--show-metrics`
4. Add CLI flag for cache persistence: `--cache-file <path>`
5. Create web UI dashboard for real-time metrics
