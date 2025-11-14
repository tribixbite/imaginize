/**
 * Benchmark Reporter
 *
 * Generates benchmark reports in multiple formats:
 * - JSON (machine-readable, for CI/CD)
 * - Markdown (human-readable, for PRs)
 * - Console (terminal output)
 */

import { writeFile } from 'fs/promises';
import type { BenchmarkReport, BenchmarkResult, ComparisonResult } from './types.js';

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format number with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * Format time in milliseconds
 */
function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Generate console output for benchmark results
 */
export function generateConsoleReport(results: BenchmarkResult[], comparisons?: ComparisonResult[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 BENCHMARK RESULTS');
  console.log('='.repeat(80));

  // Group by suite
  const suites = new Map<string, BenchmarkResult[]>();
  for (const result of results) {
    if (!suites.has(result.suite)) {
      suites.set(result.suite, []);
    }
    suites.get(result.suite)!.push(result);
  }

  // Display each suite
  for (const [suiteName, suiteResults] of suites) {
    console.log(`\n## ${suiteName}`);
    console.log('-'.repeat(80));

    for (const result of suiteResults) {
      const comparison = comparisons?.find((c) => c.name === result.name);
      let changeStr = '';
      if (comparison) {
        const sign = comparison.change >= 0 ? '+' : '';
        const emoji = comparison.isImprovement ? '🟢' : comparison.isRegression ? '🔴' : '⚪';
        changeStr = ` ${emoji} (${sign}${comparison.change.toFixed(1)}%)`;
      }

      console.log(`  ${result.name}:`);
      console.log(`    Avg: ${formatTime(result.avgTime)} ± ${formatTime(result.stdDev)}${changeStr}`);
      console.log(`    Min: ${formatTime(result.minTime)} | Max: ${formatTime(result.maxTime)}`);
      console.log(`    P50: ${formatTime(result.p50)} | P90: ${formatTime(result.p90)} | P95: ${formatTime(result.p95)}`);
      console.log(`    Ops/sec: ${formatNumber(result.opsPerSecond)}`);

      if (result.memory) {
        console.log(`    Memory: ${formatBytes(result.memory.peakHeapUsed)} peak`);
      }

      if (result.tokens) {
        console.log(`    Tokens: ${formatNumber(result.tokens.totalTokens)} ($${result.tokens.estimatedCost.toFixed(4)})`);
      }

      console.log('');
    }
  }

  console.log('='.repeat(80) + '\n');
}

/**
 * Generate JSON report
 */
export async function generateJsonReport(
  results: BenchmarkResult[],
  outputPath: string,
  version: string = 'unknown',
  commit?: string
): Promise<BenchmarkReport> {
  const report: BenchmarkReport = {
    timestamp: new Date().toISOString(),
    version,
    commit,
    totalBenchmarks: results.length,
    results,
    summary: {
      totalTime: results.reduce((sum, r) => sum + r.avgTime, 0),
      avgTime: results.reduce((sum, r) => sum + r.avgTime, 0) / results.length,
      totalMemory: results.reduce((sum, r) => sum + (r.memory?.peakHeapUsed || 0), 0),
      totalTokens: results.reduce((sum, r) => sum + (r.tokens?.totalTokens || 0), 0),
      totalCost: results.reduce((sum, r) => sum + (r.tokens?.estimatedCost || 0), 0),
    },
  };

  await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`✅ JSON report saved: ${outputPath}`);

  return report;
}

/**
 * Generate Markdown report
 */
export async function generateMarkdownReport(
  results: BenchmarkResult[],
  outputPath: string,
  version: string = 'unknown',
  comparisons?: ComparisonResult[]
): Promise<void> {
  const lines: string[] = [];

  lines.push(`# Benchmark Report`);
  lines.push(``);
  lines.push(`**Version:** ${version}`);
  lines.push(`**Date:** ${new Date().toISOString()}`);
  lines.push(`**Benchmarks:** ${results.length}`);
  lines.push(``);

  // Summary table
  lines.push(`## Summary`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);

  const totalTime = results.reduce((sum, r) => sum + r.avgTime, 0);
  const avgTime = totalTime / results.length;
  const totalMemory = results.reduce((sum, r) => sum + (r.memory?.peakHeapUsed || 0), 0);
  const totalTokens = results.reduce((sum, r) => sum + (r.tokens?.totalTokens || 0), 0);
  const totalCost = results.reduce((sum, r) => sum + (r.tokens?.estimatedCost || 0), 0);

  lines.push(`| Total Time | ${formatTime(totalTime)} |`);
  lines.push(`| Average Time | ${formatTime(avgTime)} |`);
  lines.push(`| Total Memory | ${formatBytes(totalMemory)} |`);
  if (totalTokens > 0) {
    lines.push(`| Total Tokens | ${formatNumber(totalTokens)} |`);
    lines.push(`| Total Cost | $${totalCost.toFixed(4)} |`);
  }
  lines.push(``);

  // Group by suite
  const suites = new Map<string, BenchmarkResult[]>();
  for (const result of results) {
    if (!suites.has(result.suite)) {
      suites.set(result.suite, []);
    }
    suites.get(result.suite)!.push(result);
  }

  // Detailed results by suite
  for (const [suiteName, suiteResults] of suites) {
    lines.push(`## ${suiteName}`);
    lines.push(``);
    lines.push(`| Benchmark | Avg Time | P95 | Ops/sec | Memory | Change |`);
    lines.push(`|-----------|----------|-----|---------|--------|--------|`);

    for (const result of suiteResults) {
      const comparison = comparisons?.find((c) => c.name === result.name);
      let changeStr = '-';
      if (comparison) {
        const sign = comparison.change >= 0 ? '+' : '';
        const emoji = comparison.isImprovement ? '🟢' : comparison.isRegression ? '🔴' : '⚪';
        changeStr = `${emoji} ${sign}${comparison.change.toFixed(1)}%`;
      }

      const memStr = result.memory ? formatBytes(result.memory.peakHeapUsed) : '-';

      lines.push(
        `| ${result.name} | ${formatTime(result.avgTime)} | ${formatTime(result.p95)} | ${formatNumber(result.opsPerSecond)} | ${memStr} | ${changeStr} |`
      );
    }

    lines.push(``);
  }

  // Regression warnings
  if (comparisons && comparisons.some((c) => c.isRegression)) {
    lines.push(`## ⚠️ Performance Regressions Detected`);
    lines.push(``);

    const regressions = comparisons.filter((c) => c.isRegression);
    for (const reg of regressions) {
      lines.push(`- **${reg.name}**: ${reg.change.toFixed(1)}% slower (${formatTime(reg.baseline.avgTime)} → ${formatTime(reg.current.avgTime)})`);
    }

    lines.push(``);
  }

  await writeFile(outputPath, lines.join('\n'), 'utf-8');
  console.log(`✅ Markdown report saved: ${outputPath}`);
}

/**
 * Compare results with baseline
 */
export function compareWithBaseline(
  current: BenchmarkResult[],
  baseline: BenchmarkResult[],
  threshold: number = 5.0
): ComparisonResult[] {
  const comparisons: ComparisonResult[] = [];

  for (const currentResult of current) {
    const baselineResult = baseline.find(
      (b) => b.name === currentResult.name && b.suite === currentResult.suite
    );

    if (!baselineResult) {
      continue;
    }

    const change = ((currentResult.avgTime - baselineResult.avgTime) / baselineResult.avgTime) * 100;
    const isRegression = change > threshold;
    const isImprovement = change < -threshold;

    comparisons.push({
      name: currentResult.name,
      current: currentResult,
      baseline: baselineResult,
      change,
      isRegression,
      isImprovement,
      significant: Math.abs(change) > threshold,
    });
  }

  return comparisons;
}
