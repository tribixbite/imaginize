#!/usr/bin/env tsx
/**
 * Run Benchmarks
 *
 * Main entry point for running benchmark suites
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { runSuites } from './harness/benchmark-runner.js';
import {
  generateConsoleReport,
  generateJsonReport,
  generateMarkdownReport,
  compareWithBaseline,
} from './harness/reporter.js';
import { parsingSuite } from './suites/parsing.bench.js';
import { stateSuite } from './suites/state.bench.js';
import type { BenchmarkConfig, BenchmarkResult } from './harness/types.js';

// Get version from package.json
async function getVersion(): Promise<string> {
  try {
    const packageJson = await readFile('package.json', 'utf-8');
    const pkg = JSON.parse(packageJson);
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

// Get git commit hash
async function getCommit(): Promise<string | undefined> {
  try {
    const { execSync } = await import('child_process');
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return undefined;
  }
}

// Load baseline results
async function loadBaseline(version: string): Promise<BenchmarkResult[] | null> {
  try {
    const baselinePath = join('benchmarks', 'baselines', `v${version}.json`);
    const data = await readFile(baselinePath, 'utf-8');
    const baseline = JSON.parse(data);
    return baseline.results;
  } catch {
    return null;
  }
}

/**
 * Main benchmark execution
 */
async function main() {
  const version = await getVersion();
  const commit = await getCommit();

  console.log(`Version: ${version}`);
  if (commit) console.log(`Commit: ${commit}`);

  // Configuration
  const config: Partial<BenchmarkConfig> = {
    warmupIterations: 3,
    iterations: 10,
    collectMemory: true,
    collectTokens: false, // Set to true if testing with API calls
  };

  // Run all suites
  const suites = [
    stateSuite,
    parsingSuite,
  ];

  const results = await runSuites(suites, config, version);

  // Load baseline for comparison
  const baseline = await loadBaseline(version);
  const comparisons = baseline ? compareWithBaseline(results, baseline) : undefined;

  // Console output with comparisons
  generateConsoleReport(results, comparisons);

  if (comparisons) {
    const regressions = comparisons.filter((c) => c.isRegression);
    if (regressions.length > 0) {
      console.log(`\n⚠️ PERFORMANCE REGRESSION DETECTED`);
      console.log(`   ${regressions.length} benchmark(s) slower than baseline:`);
      for (const reg of regressions) {
        console.log(`   - ${reg.name}: ${reg.change.toFixed(1)}% slower`);
      }
    }
  }

  // Save results
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const resultsPath = join('benchmarks', 'results', `${timestamp}.json`);
  const reportPath = join('benchmarks', 'reports', `${timestamp}.md`);

  await generateJsonReport(results, resultsPath, version, commit);
  await generateMarkdownReport(results, reportPath, version, comparisons);

  // Exit with error code if regressions detected
  if (comparisons && comparisons.some((c) => c.isRegression)) {
    console.log('\n❌ Benchmark run completed with performance regressions');
    process.exit(1);
  }

  console.log('\n✅ Benchmark run completed successfully');
}

main().catch((error) => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
