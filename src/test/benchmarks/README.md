# imaginize Performance Benchmarks

Automated performance benchmarking and regression detection system for imaginize.

## Quick Start

```bash
# Run all benchmarks
npm run bench

# Run with baseline comparison
npm run bench

# View latest report
cat benchmarks/reports/latest.md
```

## Architecture

### Components

```
src/test/benchmarks/
├── harness/              # Core benchmarking framework
│   ├── types.ts         # Type definitions
│   ├── benchmark-runner.ts  # Execution engine
│   ├── metrics-collector.ts # Performance metrics
│   └── reporter.ts      # Report generation
├── suites/              # Benchmark test suites
│   ├── parsing.bench.ts # EPUB/PDF parsing
│   ├── state.bench.ts   # State management
│   └── ...
├── fixtures/            # Test data files
└── run-benchmarks.ts    # Main entry point

benchmarks/              # Benchmark data storage
├── results/            # Individual benchmark runs
├── baselines/          # Version baselines
├── trends/             # Historical data
└── reports/            # Generated reports
```

## Metrics Tracked

### Performance Metrics
- **Execution Time**: avg, min, max, p50, p90, p95, p99
- **Operations/Second**: Throughput measurement
- **Standard Deviation**: Consistency indicator

### Memory Metrics
- **Peak Heap Used**: Maximum memory consumption
- **Peak RSS**: Resident set size
- **Growth Rate**: Memory growth per iteration

### Token Metrics (when enabled)
- **Total Tokens**: Prompt + completion
- **Estimated Cost**: USD cost estimation
- **Tokens/Operation**: Average efficiency

### API Metrics (when enabled)
- **Request Latency**: avg, p95
- **Timeouts & Retries**: Reliability metrics
- **Requests/Second**: API throughput

## Benchmark Suites

### State Management (2 benchmarks)
- State file write performance (~650μs avg, 1,543 ops/sec)
- State file read performance (~234μs avg, 4,280 ops/sec)

### Parsing (1 benchmark)
- EPUB parsing (~5.79ms avg, 173 ops/sec)
- PDF parsing (disabled - fixture compression issues)

### Processing (10 benchmarks) 🆕
- Token estimation (short text ~200 chars): ~7μs avg, 135k ops/sec
- Token estimation (medium text ~800 chars): ~57μs avg, 17k ops/sec
- Token estimation (long text ~8000 chars): ~719μs avg, 1.4k ops/sec
- Token estimation (very long text ~40k chars): ~4.02ms avg, 249 ops/sec
- Cost calculation (gpt-4o-mini): ~1.79μs avg, 559k ops/sec
- Cost calculation (gpt-4o): ~1.08μs avg, 927k ops/sec
- Context limit check (within limit): ~1.18μs avg, 847k ops/sec
- Context limit check (exceeding limit): ~1.00μs avg, 997k ops/sec
- Text chunking (small text, no splits): ~97μs avg, 10k ops/sec
- Text chunking (large text, multiple splits): ~5.36ms avg, 187 ops/sec

### Output Generation (8 benchmarks) 🆕
- Build Contents.md (small - 10 chapters, 20 elements): ~2.10μs avg, 477k ops/sec
- Build Contents.md (large - 50 chapters, 200 elements): ~1.47μs avg, 679k ops/sec
- Build Chapters.md (small - 1 concept per chapter): ~14μs avg, 70k ops/sec
- Build Chapters.md (medium - 5 concepts per chapter): ~40μs avg, 25k ops/sec
- Build Chapters.md (large - 10 concepts per chapter): ~40μs avg, 25k ops/sec
- Build Elements.md (small - 20 elements): ~54μs avg, 18k ops/sec
- Build Elements.md (medium - 50 elements): ~83μs avg, 12k ops/sec
- Build Elements.md (large - 100 elements): ~383μs avg, 2.6k ops/sec

**Total Benchmarks:** 21 operational (up from 3)

## Creating New Benchmarks

```typescript
import type { BenchmarkSuite } from '../harness/types.js';

export const mySuite: BenchmarkSuite = {
  name: 'My Suite',
  description: 'Description of what this suite tests',
  benchmarks: [
    {
      name: 'My benchmark',
      fn: async () => {
        // Your benchmark code here
      },
      setup: async () => {
        // Optional: Run before each iteration
      },
      teardown: async () => {
        // Optional: Run after each iteration
      },
      config: {
        warmupIterations: 3,
        iterations: 10,
        collectMemory: true,
        collectTokens: false,
      },
    },
  ],
};
```

Then add to `run-benchmarks.ts`:

```typescript
import { mySuite } from './suites/my-suite.bench.js';

const suites = [
  stateSuite,
  mySuite, // Add your suite
];
```

## Baseline Management

### Creating a Baseline

After running benchmarks, save results as a baseline:

```bash
# Run benchmarks
npm run bench

# Copy latest results as baseline for current version
cp benchmarks/results/latest.json benchmarks/baselines/v2.7.0.json
```

### Comparison

When a baseline exists for the current version, benchmarks will automatically:
- Compare current results with baseline
- Flag regressions (>5% slower)
- Flag improvements (>5% faster)
- Exit with error code if regressions detected

## CI/CD Integration

### GitHub Actions Workflow

The `.github/workflows/benchmarks.yml` workflow provides automated performance testing:

**Features:**
- ✅ Runs on every push to main and all pull requests
- ✅ Compares results against baseline (v2.7.0)
- ✅ Posts benchmark results as PR comments
- ✅ Detects performance regressions (>5% threshold)
- ✅ Fails builds if regressions detected
- ✅ Uploads results as artifacts (30-day retention)

**Workflow Triggers:**
- Push to `main` branch
- Pull requests to `main` branch
- Manual dispatch via GitHub Actions UI

**PR Comment Features:**
- Automatic benchmark results posting
- Emoji indicators (🟢 improvement, 🔴 regression, ⚪ no change)
- Comparison with baseline performance
- Interactive "How to interpret" section
- Updates existing comments instead of creating duplicates

**Regression Detection:**
When regressions are detected:
1. Console output: `⚠️ PERFORMANCE REGRESSION DETECTED`
2. Detailed list of slower benchmarks with percentages
3. PR comment highlights regressions in red 🔴
4. Build fails with error code 1
5. GitHub Actions summary shows warning

**Artifacts Uploaded:**
- `benchmark-results/` (30-day retention)
  - JSON results files
  - Markdown reports
  - Console output

**Manual Trigger:**
```bash
gh workflow run benchmarks.yml
```

## Output Formats

### JSON (`benchmarks/results/*.json`)
Machine-readable format for CI/CD integration and historical tracking.

### Markdown (`benchmarks/reports/*.md`)
Human-readable format suitable for PR comments and documentation.

### Console
Colorized terminal output with emoji indicators:
- 🟢 Improvement (>5% faster)
- 🔴 Regression (>5% slower)
- ⚪ No significant change

## Configuration

### Global Config

Edit `run-benchmarks.ts`:

```typescript
const config: Partial<BenchmarkConfig> = {
  warmupIterations: 3,    // Warmup runs (not measured)
  iterations: 10,         // Measured runs
  collectMemory: true,    // Track memory usage
  collectTokens: false,   // Track API token usage
  timeout: 300000,        // 5 minute timeout
};
```

### Per-Benchmark Config

Override in individual benchmarks:

```typescript
{
  name: 'Fast operation',
  fn: async () => { /* ... */ },
  config: {
    iterations: 100, // More iterations for fast ops
  },
}
```

## Best Practices

1. **Use Fixtures**: Create consistent test data in `fixtures/`
2. **Isolate Tests**: Use `setup`/`teardown` for clean state
3. **Warmup**: Always include warmup iterations
4. **Multiple Runs**: Use 10+ iterations for statistical significance
5. **Monitor Baselines**: Update baselines after intentional changes
6. **CI Integration**: Run benchmarks on every PR
7. **Track Trends**: Archive results for long-term analysis

## Troubleshooting

### High Variance

If benchmarks show high standard deviation:
- Increase warmup iterations
- Increase measured iterations
- Close background applications
- Run on dedicated hardware

### Out of Memory

For memory-intensive benchmarks:
- Reduce iterations
- Use smaller test fixtures
- Add teardown to clean up resources

### Timeouts

For long-running benchmarks:
- Increase timeout in config
- Split into smaller benchmarks
- Use setup to prepare expensive data

## Implementation Status

- ✅ **Phase 1**: Benchmark Harness (Complete)
  - types.ts, benchmark-runner.ts, metrics-collector.ts, reporter.ts
  - Statistical analysis (avg, min, max, stdDev, P50/P90/P95/P99)
  - Memory profiling and token tracking
  - Multi-format reporting (JSON, Markdown, Console)

- ✅ **Phase 2**: Initial Benchmark Suites (Complete)
  - State management benchmarks (write/read)
  - Baseline v2.7.0 established
  - Regression detection with 5% threshold

- ✅ **Phase 3**: CI/CD Integration (Complete)
  - GitHub Actions workflow (`.github/workflows/benchmarks.yml`)
  - Automated PR comments with results
  - Regression detection and build failures
  - Artifact uploads with 30-day retention
  - Manual workflow dispatch support

- ✅ **Phase 4**: Parsing Benchmark Suite (Complete)
  - EPUB parsing benchmark (~5.79ms avg, 173 ops/sec)
  - Uses integration test fixtures
  - PDF parsing disabled (fixture compression issues)
  - Baseline updated with parsing results

- ✅ **Phase 5**: Processing & Output Benchmarks (Complete)
  - Processing suite (10 benchmarks):
    - Token estimation (4 variations from 200 chars to 40k chars)
    - Cost calculation (gpt-4o-mini, gpt-4o)
    - Context limit checking (within/exceeding limits)
    - Text chunking (small/large with multiple splits)
  - Output generation suite (8 benchmarks):
    - Contents.md generation (small/large)
    - Chapters.md generation (1/5/10 concepts per chapter)
    - Elements.md generation (20/50/100 elements)
  - Baseline updated with 21 total benchmarks

- 🚧 **Phase 6**: Historical Trend Visualization (Infrastructure Complete - Testing Required) 🆕
  - SQLite database schema and implementation (`history/schema.sql`, `history/database.ts`)
  - Benchmark history recorder with automatic baseline management
  - HTML report generator with Chart.js visualizations (`history/html-reporter.ts`)
  - Performance trend analysis and regression detection
  - CLI tools: `npm run bench:history` and `npm run bench:trends`
  - **Status**: Core infrastructure implemented, needs end-to-end testing
  - **Remaining**: Integration testing, documentation, example reports

## Usage (Phase 6)

### Enable Historical Tracking

```bash
# Run benchmarks with history tracking (opt-in)
npm run bench:history

# Or set environment variable
BENCHMARK_HISTORY=1 npm run bench
```

### Generate Trend Reports

```bash
# Generate HTML trend report for all benchmarks
npm run bench:trends

# Generate with baseline comparison
npm run bench:trends -- --comparison

# Generate for specific benchmarks
npm run bench:trends -- --benchmarks "State file write,EPUB parsing"

# Generate with more history
npm run bench:trends -- --limit 50
```

## Future Enhancements

- [ ] Phase 6 Testing & Validation
  - End-to-end integration tests
  - Example trend reports
  - Performance regression alert system
- [ ] Fix PDF parsing fixture for benchmarks
- [ ] Additional analysis/illustration benchmarks (API-based operations)

---

**Last Updated**: 2025-11-14
**Status**: Phase 1-5 Complete | Phase 6 Infrastructure Complete (Testing Required)
