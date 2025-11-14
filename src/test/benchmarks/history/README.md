# Historical Benchmark Tracking

SQLite-based performance trend tracking and visualization for imaginize benchmarks.

## Features

- ✅ **SQLite Database** - Persistent storage of all benchmark runs
- ✅ **Automatic Baseline Management** - First run auto-sets baseline for each version
- ✅ **Trend Analysis** - Track performance over time with up to N historical runs
- ✅ **Regression Detection** - Automatic comparison against baseline with severity levels
- ✅ **HTML Reports** - Interactive Chart.js visualizations with dark mode
- ✅ **CI/CD Integration** - Optional tracking via environment variable

## Quick Start

### 1. Enable Historical Tracking

```bash
# Run benchmarks with history tracking (opt-in)
npm run bench:history

# Or use environment variable
BENCHMARK_HISTORY=1 npm run bench
```

**First Run:**
```
📊 Recorded benchmark run #1 to history database
✓ Set baseline for version 2.7.0 (run 1)
```

**Subsequent Runs:**
```
📊 Recorded benchmark run #2 to history database

📊 Detected 3 performance regression(s) from baseline
   - Token estimation (long text): 15.3% slower (minor)
   - EPUB parsing: 8.2% slower (minor)
   - Build Elements.md (large): 12.1% slower (minor)
```

### 2. Generate Trend Reports

```bash
# Generate HTML trend report for all benchmarks
npm run bench:trends

# Generate with baseline comparison
npm run bench:trends -- --comparison

# Generate for specific benchmarks
npm run bench:trends -- --benchmarks "State file write,EPUB parsing"

# Generate with custom output path
npm run bench:trends -- --output reports/trends.html

# Generate with more historical data points
npm run bench:trends -- --limit 50
```

**Output:**
```
📊 Generating performance trend report...

✓ Generated HTML trend report: benchmarks/trends/performance-report.html

✅ Report generated successfully

Open in browser:
  file:///path/to/benchmarks/trends/performance-report.html
```

## Database Schema

The SQLite database (`benchmarks/history/benchmarks.db`) contains:

**Tables:**
- `benchmark_runs` - Metadata for each benchmark execution
- `benchmark_results` - Individual benchmark results per run
- `version_baselines` - Baseline results for each version
- `regression_alerts` - Detected performance regressions

**Views:**
- `latest_benchmark_results` - Most recent results for each benchmark
- `performance_trends` - Last 30 runs per benchmark
- `active_baselines` - Current baseline results

## HTML Reports

Generated HTML reports include:

- **Interactive Charts** - Chart.js line charts with hover tooltips
- **Dark Mode UI** - Professional dark theme optimized for readability
- **Multiple Metrics** - Execution time, standard deviation, operations per second
- **Version Tracking** - Shows version and commit hash for each data point
- **Comparison Table** - Baseline vs current performance (when --comparison is used)
- **Severity Indicators** - Visual indicators for regression severity (minor/moderate/severe)

**Report Features:**
- 📊 Trend visualization for all benchmarks
- 🎯 Summary cards (total benchmarks, avg time, improvements, regressions)
- 📈 Execution time trend line
- 📉 Standard deviation trend line
- 🏷️ Version labels on hover
- ⚡ Responsive design

## API Usage

### Programmatic Access

```typescript
import { BenchmarkHistory } from './history/index.js';

const history = new BenchmarkHistory();

// Record a benchmark run
const runId = await history.recordRun(version, results, {
  commitHash: 'abc123',
  branchName: 'main',
  ciBuildNumber: '42',
});

// Set baseline for a version
history.setBaseline('2.7.0', runId, 'Stable baseline');

// Generate HTML trend report
await history.generateTrendReport('output.html', {
  benchmarks: ['State file write', 'EPUB parsing'],
  limit: 30,
  version: '2.7.0',
  includeComparison: true,
});

// Get regression summary
const summary = history.getRegressionSummary();
console.log(summary);

history.close();
```

### Database Layer

```typescript
import { BenchmarkDatabase } from './history/database.js';

const db = new BenchmarkDatabase();

// Get trend data for a benchmark
const trend = db.getTrend('State file write', 30);

// Get baseline results
const baseline = db.getBaselineResults('2.7.0');

// Compare with baseline
const comparisons = db.compareWithBaseline(currentResults, baseline);

// Get unacknowledged regressions
const regressions = db.getUnacknowledgedRegressions(50);

db.close();
```

## Environment Variables

- `BENCHMARK_HISTORY=1` - Enable historical tracking (opt-in)
- `GITHUB_REF_NAME` - Auto-captured branch name in CI/CD
- `GITHUB_RUN_NUMBER` - Auto-captured CI build number

## File Locations

```
benchmarks/
├── history/
│   ├── benchmarks.db      # SQLite database (gitignored)
│   ├── *.db-shm          # SQLite shared memory (gitignored)
│   └── *.db-wal          # SQLite write-ahead log (gitignored)
├── trends/
│   └── *.html            # Generated HTML reports (gitignored)
├── results/
│   └── *.json            # Individual run results (kept)
└── baselines/
    └── v*.json           # Version baselines (kept)
```

## Regression Severity Levels

| Severity | Threshold | Description |
|----------|-----------|-------------|
| Minor | 5-20% slower | Acceptable variance |
| Moderate | 20-50% slower | Review recommended |
| Severe | >50% slower | Immediate attention required |

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Benchmark Performance

on:
  push:
    branches: [main]
  pull_request:

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install

      # Run benchmarks with history tracking
      - name: Run Benchmarks
        run: BENCHMARK_HISTORY=1 npm run bench
        env:
          GITHUB_REF_NAME: ${{ github.ref_name }}
          GITHUB_RUN_NUMBER: ${{ github.run_number }}

      # Generate trend report
      - name: Generate Trend Report
        if: success() || failure()
        run: npm run bench:trends -- --comparison

      # Upload report as artifact
      - name: Upload Trend Report
        uses: actions/upload-artifact@v3
        with:
          name: benchmark-trends
          path: benchmarks/trends/performance-report.html
          retention-days: 30

      # Fail on severe regressions
      - name: Check for Severe Regressions
        run: |
          if grep -q "severe" benchmarks/trends/performance-report.html; then
            echo "Severe performance regression detected"
            exit 1
          fi
```

## Troubleshooting

### Database Locked

If you get "database is locked" errors:
```bash
# Kill any hanging processes
pkill -9 tsx

# Remove lock files
rm benchmarks/history/*.db-shm
rm benchmarks/history/*.db-wal
```

### Missing Historical Data

To populate history from existing results:
```bash
# Re-run benchmarks with history enabled
for i in {1..10}; do
  BENCHMARK_HISTORY=1 npm run bench
  sleep 2
done
```

### Large Database File

To compact the database:
```bash
sqlite3 benchmarks/history/benchmarks.db "VACUUM;"
```

## Best Practices

1. **Baseline Management**
   - Set stable baseline after significant changes
   - Update baseline for each major version
   - Document baseline changes in version control

2. **Trend Analysis**
   - Run benchmarks consistently (same environment)
   - Use limit=50 for comprehensive trend analysis
   - Monitor trends before releases

3. **Regression Handling**
   - Investigate moderate regressions promptly
   - Block releases on severe regressions
   - Acknowledge known regressions in database

4. **CI/CD Usage**
   - Enable history tracking only on main branch
   - Upload HTML reports as CI artifacts
   - Set up alerts for severe regressions

---

**Created:** 2025-11-14
**Status:** Production-ready
**Dependencies:** better-sqlite3, Chart.js (CDN)
