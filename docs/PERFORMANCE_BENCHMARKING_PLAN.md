# Performance Benchmarking Suite Implementation Plan

**Priority**: 3 (Optional Enhancement)
**Estimated Effort**: 2-3 days
**Status**: Planning
**Complexity**: Low-Medium

---

## Overview

Automated performance benchmarking and regression detection system for imaginize. Provides baseline metrics, trend tracking, and alerts for performance degradation across versions.

**Goals**:
1. Establish performance baselines for all core operations
2. Detect performance regressions automatically in CI/CD
3. Track token usage and cost trends over time
4. Optimize slow operations with data-driven insights
5. Validate concurrency improvements with metrics

**Benefits**:
- Early detection of performance regressions
- Data-driven optimization decisions
- Validate performance improvements
- Track token/cost efficiency over versions
- Historical performance visualization

---

## Architecture

### Components

```
src/test/benchmarks/
├── harness/
│   ├── benchmark-runner.ts     # Core benchmarking engine
│   ├── metrics-collector.ts    # Performance metrics collection
│   ├── reporter.ts              # Results formatting and reporting
│   └── comparator.ts            # Baseline comparison logic
├── suites/
│   ├── parsing.bench.ts         # EPUB/PDF parsing performance
│   ├── analysis.bench.ts        # AI analysis phase performance
│   ├── extraction.bench.ts      # Element extraction performance
│   ├── illustration.bench.ts    # Image generation performance
│   ├── concurrent.bench.ts      # Concurrent processing performance
│   └── state.bench.ts           # State management performance
├── fixtures/
│   ├── small-book.epub          # <50 pages
│   ├── medium-book.epub         # 100-200 pages
│   └── large-book.epub          # 500+ pages
└── baselines/
    ├── v2.7.0.json              # Baseline metrics for v2.7.0
    └── README.md                # Baseline documentation
```

### Data Storage

```
benchmarks/
├── results/
│   ├── 2025-11-13_run1.json     # Individual benchmark runs
│   └── 2025-11-13_run2.json
├── baselines/
│   └── v2.7.0.json              # Version baselines
├── trends/
│   └── historical.db            # SQLite database for trends
└── reports/
    ├── latest.html              # HTML report
    └── regression-report.md     # Regression analysis
```

---

## Metrics Tracked

### 1. Processing Time Metrics

**Per Chapter**:
- Parsing time (EPUB/PDF)
- Analysis time (Pass 1 entity extraction)
- Analysis time (Pass 2 full analysis)
- Extraction time (element identification)
- Illustration time (image generation)

**Overall**:
- Total pipeline time
- Average time per chapter
- P50, P90, P95, P99 percentiles
- Concurrent vs sequential comparison

### 2. Token Usage Metrics

**Per Phase**:
- Prompt tokens consumed
- Completion tokens generated
- Total tokens per chapter
- Average tokens per scene
- Average tokens per element

**Cost Tracking**:
- Estimated cost per chapter
- Estimated cost per book
- Cost breakdown by phase
- Provider-specific costs (OpenAI, OpenRouter)

### 3. Memory Consumption

**Peak Memory Usage**:
- During parsing (EPUB/PDF)
- During analysis phases
- During concurrent processing
- Overall process maximum

**Memory Growth**:
- Memory growth rate per chapter
- Memory leaks detection
- GC pressure indicators

### 4. API Request Metrics

**Request Latency**:
- Average API response time
- P50, P90, P95 latency
- Timeout frequency
- Retry frequency

**Throughput**:
- Requests per second
- Concurrent request handling
- Batch processing efficiency

### 5. State Persistence

**File I/O Performance**:
- State file write time
- State file read time
- Progress file write frequency
- Atomic write overhead

---

## Implementation Phases

### Phase 1: Benchmark Harness (1 day)

**Goal**: Core benchmarking infrastructure

**Tasks**:
1. **Benchmark Runner** (`benchmark-runner.ts`)
   - Test execution framework
   - Timing measurement (high-resolution)
   - Warmup iterations
   - Multiple run averaging
   - Error handling and retry

2. **Metrics Collector** (`metrics-collector.ts`)
   - Performance metrics collection
   - Memory profiling
   - Token counting integration
   - API latency tracking
   - File I/O timing

3. **Reporter** (`reporter.ts`)
   - JSON output format
   - Markdown report generation
   - HTML visualization (charts)
   - CI-friendly console output
   - Baseline comparison display

**Deliverables**:
- `src/test/benchmarks/harness/` (3 files, ~800 lines)
- Working benchmark execution framework
- JSON and Markdown output formats

---

### Phase 2: Benchmark Suites (1 day)

**Goal**: Comprehensive benchmark coverage

**Tasks**:
1. **Parsing Benchmarks** (`parsing.bench.ts`)
   - EPUB parsing (small/medium/large)
   - PDF parsing (small/medium/large)
   - Metadata extraction
   - Chapter extraction

2. **Analysis Benchmarks** (`analysis.bench.ts`)
   - Pass 1 entity extraction (1/5/10 chapters)
   - Pass 2 full analysis (1/5/10 chapters)
   - Concurrent vs sequential comparison
   - Token usage per chapter

3. **Extraction Benchmarks** (`extraction.bench.ts`)
   - Element identification
   - Character tracking
   - Entity deduplication
   - Registry updates

4. **Illustration Benchmarks** (`illustration.bench.ts`)
   - Image generation (1/5/10 scenes)
   - Style guide application
   - Concurrent image generation
   - API latency measurement

5. **Concurrent Benchmarks** (`concurrent.bench.ts`)
   - Batch size variations (1/3/5/10)
   - Rate limit handling
   - Parallel efficiency
   - Speedup measurement

6. **State Benchmarks** (`state.bench.ts`)
   - State save/load cycles
   - Progress tracking updates
   - Atomic write performance
   - Recovery time

**Deliverables**:
- `src/test/benchmarks/suites/` (6 files, ~1,200 lines)
- Comprehensive benchmark coverage
- Test fixtures (small/medium/large books)

---

### Phase 3: CI/CD Integration & Baselines (0.5 days)

**Goal**: Automated regression detection

**Tasks**:
1. **GitHub Actions Workflow**
   - Create `.github/workflows/benchmarks.yml`
   - Run on PR and main branch pushes
   - Compare against baseline
   - Post regression warnings as PR comments
   - Store results as artifacts

2. **Baseline Management**
   - Capture v2.7.0 baseline metrics
   - Baseline storage format (JSON)
   - Baseline update process
   - Version tagging strategy

3. **Regression Detection**
   - Threshold configuration (e.g., >10% slowdown)
   - Automatic alerts on regression
   - Performance improvement detection
   - Historical trend analysis

**Deliverables**:
- `.github/workflows/benchmarks.yml` (~80 lines)
- `benchmarks/baselines/v2.7.0.json`
- Automated regression detection

---

### Phase 4: Visualization & Reporting (0.5 days)

**Goal**: Performance insights and trends

**Tasks**:
1. **HTML Reports**
   - Interactive charts (Chart.js or similar)
   - Performance trends over time
   - Comparison views (baseline vs current)
   - Drill-down capabilities

2. **Historical Tracking**
   - SQLite database for trends
   - Query interface for historical data
   - Trend visualization (week/month/year)
   - Export capabilities (CSV, JSON)

3. **Dashboard Integration** (Optional)
   - Real-time benchmark results
   - Performance graphs in dashboard
   - Live comparison with baseline

**Deliverables**:
- `benchmarks/reports/` (HTML/Markdown templates)
- `benchmarks/trends/historical.db` schema
- Visualization scripts

---

## Benchmark Examples

### Example 1: Parsing Performance

```typescript
import { benchmarkSuite, fixture } from '../harness/benchmark-runner';
import { parseEpub } from '../../../lib/epub-parser';

benchmarkSuite('EPUB Parsing Performance', () => {
  benchmark('Parse small book (<50 pages)', async (metrics) => {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    const result = await parseEpub(fixture('small-book.epub'));

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    metrics.record({
      duration: endTime - startTime,
      memoryUsed: endMemory - startMemory,
      chaptersProcessed: result.length,
      averageTimePerChapter: (endTime - startTime) / result.length,
    });
  });

  benchmark('Parse medium book (100-200 pages)', async (metrics) => {
    // Similar implementation
  });

  benchmark('Parse large book (500+ pages)', async (metrics) => {
    // Similar implementation
  });
});
```

### Example 2: Token Usage Tracking

```typescript
benchmarkSuite('Token Usage - Analysis Phase', () => {
  benchmark('Pass 1 - Entity extraction (10 chapters)', async (metrics) => {
    const tokenTracker = new TokenTracker();

    // Run analysis with token tracking
    await runAnalysisPhase({
      chapters: fixture('medium-book-chapters'),
      tokenTracker,
    });

    metrics.record({
      totalTokens: tokenTracker.getTotalTokens(),
      promptTokens: tokenTracker.getPromptTokens(),
      completionTokens: tokenTracker.getCompletionTokens(),
      averageTokensPerChapter: tokenTracker.getAveragePerChapter(),
      estimatedCost: tokenTracker.getEstimatedCost(),
      costBreakdown: tokenTracker.getCostBreakdown(),
    });
  });
});
```

### Example 3: Concurrent Processing Efficiency

```typescript
benchmarkSuite('Concurrent Processing Efficiency', () => {
  const chapters = fixture('10-chapters');

  benchmark('Sequential processing (batch=1)', async (metrics) => {
    const startTime = performance.now();

    await runConcurrentAnalysis(chapters, { batchSize: 1 });

    metrics.record({
      duration: performance.now() - startTime,
      batchSize: 1,
      chaptersProcessed: chapters.length,
    });
  });

  benchmark('Concurrent processing (batch=3)', async (metrics) => {
    const startTime = performance.now();

    await runConcurrentAnalysis(chapters, { batchSize: 3 });

    metrics.record({
      duration: performance.now() - startTime,
      batchSize: 3,
      chaptersProcessed: chapters.length,
      speedupFactor: /* calculate vs sequential */,
      parallelEfficiency: /* calculate */,
    });
  });

  benchmark('Concurrent processing (batch=5)', async (metrics) => {
    // Similar implementation
  });
});
```

---

## Baseline Format

### Baseline JSON Schema

```json
{
  "version": "2.7.0",
  "date": "2025-11-13",
  "environment": {
    "node": "20.10.0",
    "platform": "linux",
    "arch": "arm64"
  },
  "benchmarks": {
    "parsing": {
      "epub_small": {
        "duration_ms": 45.2,
        "memory_mb": 8.5,
        "chapters": 10
      },
      "epub_medium": {
        "duration_ms": 124.7,
        "memory_mb": 22.3,
        "chapters": 50
      }
    },
    "analysis": {
      "pass1_10_chapters": {
        "duration_ms": 15430,
        "tokens_total": 45230,
        "tokens_per_chapter": 4523,
        "cost_usd": 0.0226
      },
      "pass2_10_chapters": {
        "duration_ms": 23120,
        "tokens_total": 68450,
        "tokens_per_chapter": 6845,
        "cost_usd": 0.0342
      }
    },
    "concurrent": {
      "batch_1": {
        "duration_ms": 45200,
        "chapters": 10
      },
      "batch_3": {
        "duration_ms": 18500,
        "chapters": 10,
        "speedup": 2.44,
        "efficiency": 0.81
      }
    }
  }
}
```

---

## Regression Detection

### Threshold Configuration

```typescript
const regressionThresholds = {
  parsing: {
    duration: 1.10, // 10% slowdown
    memory: 1.15, // 15% memory increase
  },
  analysis: {
    duration: 1.15, // 15% slowdown
    tokens: 1.20, // 20% token increase (acceptable)
    cost: 1.25, // 25% cost increase (warning)
  },
  concurrent: {
    speedup: 0.90, // 10% reduction in speedup (warning)
    efficiency: 0.85, // 15% reduction in efficiency
  },
};
```

### CI/CD Reporting

**PR Comment Example**:
```markdown
## Performance Benchmark Results

### ⚠️ Regressions Detected

- **EPUB Parsing (medium)**: 15.3% slower (124.7ms → 144.0ms)
- **Token Usage (Pass 1)**: 22.1% increase (4523 → 5523 tokens/chapter)

### ✅ Improvements

- **Concurrent Efficiency (batch=3)**: 5.2% faster (18.5s → 17.5s)

### Summary

- 3 benchmarks regressed
- 2 benchmarks improved
- 15 benchmarks within threshold

**Baseline**: v2.7.0 (2025-11-13)
**Full Report**: [View HTML Report](artifacts/benchmark-report.html)
```

---

## npm Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "bench": "bun run src/test/benchmarks/run-all.ts",
    "bench:parsing": "bun run src/test/benchmarks/suites/parsing.bench.ts",
    "bench:analysis": "bun run src/test/benchmarks/suites/analysis.bench.ts",
    "bench:compare": "bun run src/test/benchmarks/compare-baseline.ts",
    "bench:report": "bun run src/test/benchmarks/generate-report.ts",
    "bench:baseline": "bun run src/test/benchmarks/capture-baseline.ts"
  }
}
```

---

## Success Criteria

### Phase 1-2 Complete:
- ✅ Benchmark harness working
- ✅ All 6 benchmark suites implemented
- ✅ Can run benchmarks locally
- ✅ JSON and Markdown output

### Phase 3 Complete:
- ✅ CI/CD workflow integrated
- ✅ Baseline captured for v2.7.0
- ✅ Regression detection working
- ✅ PR comments on regressions

### Phase 4 Complete:
- ✅ HTML reports with charts
- ✅ Historical tracking database
- ✅ Trend visualization

### Overall Success:
- ✅ Can detect 10%+ performance regressions automatically
- ✅ Baselines established for all core operations
- ✅ Historical trends tracked and visualized
- ✅ Data-driven optimization decisions enabled

---

## Timeline

**Day 1**: Phase 1 (Benchmark Harness)
- Morning: Benchmark runner and metrics collector
- Afternoon: Reporter and output formats

**Day 2**: Phase 2 (Benchmark Suites)
- Morning: Parsing, analysis, extraction benchmarks
- Afternoon: Illustration, concurrent, state benchmarks

**Day 3 (Half Day)**: Phase 3-4 (CI/CD & Visualization)
- Morning: GitHub Actions workflow, baseline capture
- Afternoon: HTML reports and historical tracking

**Total**: 2.5 days

---

## Optional Enhancements (Future)

1. **Flamegraph Generation** - CPU profiling for bottleneck identification
2. **Memory Leak Detection** - Long-running tests to detect leaks
3. **Comparison Modes** - Compare branches, versions, configurations
4. **Load Testing** - High-volume stress testing
5. **Real-time Monitoring** - Live performance dashboard
6. **Automated Optimization** - Suggestions based on benchmark results

---

## Dependencies

**Required**:
- `bun` or `node` runtime (already available)
- Test fixtures (EPUB/PDF files - can reuse from integration tests)

**Optional**:
- `chart.js` or `d3` - For HTML visualizations
- `better-sqlite3` - For historical tracking database
- `@types/better-sqlite3` - TypeScript types

---

## References

- NEXT_STEPS.md - Priority 3 description
- Integration Tests - Reuse fixtures
- Concurrent Architecture - Performance validation targets
- Token Management - Cost tracking integration

---

**Status**: Planning Complete - Ready for Implementation
**Next Step**: Begin Phase 1 (Benchmark Harness)

