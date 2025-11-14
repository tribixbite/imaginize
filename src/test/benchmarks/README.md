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

### State Management
- State file write performance
- State file read performance

### Parsing (TODO: Add fixtures)
- EPUB parsing (small/medium/large)
- PDF parsing (small/medium/large)

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

```yaml
name: Benchmarks

on:
  pull_request:
  push:
    branches: [main]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run bench
      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('benchmarks/reports/latest.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: report
            });
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

## Future Enhancements

- [ ] Phase 2: Additional benchmark suites (analysis, extraction, illustration)
- [ ] Phase 3: GitHub Actions integration
- [ ] Phase 4: Historical trend visualization
- [ ] SQLite database for trend tracking
- [ ] HTML report generation with charts
- [ ] Automated baseline updates
- [ ] Performance regression alerts

---

**Last Updated**: 2025-11-13
**Status**: Phase 1 Complete (Harness + Basic Suites)
