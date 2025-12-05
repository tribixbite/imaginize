/**
 * Benchmark Runner
 *
 * Core execution framework for running benchmarks with timing,
 * warmup iterations, and error handling
 */

import type {
  BenchmarkConfig,
  BenchmarkFunction,
  BenchmarkResult,
  BenchmarkSuite,
} from './types.js';
import { MetricsCollector } from './metrics-collector.js';

/** Default benchmark configuration */
const DEFAULT_CONFIG: BenchmarkConfig = {
  warmupIterations: 3,
  iterations: 10,
  timeout: 300000, // 5 minutes
  collectMemory: true,
  collectTokens: false,
};

/**
 * Calculate statistics from an array of measurements
 */
function calculateStats(measurements: number[]): {
  avg: number;
  min: number;
  max: number;
  stdDev: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
} {
  const sorted = [...measurements].sort((a, b) => a - b);
  const sum = measurements.reduce((a, b) => a + b, 0);
  const avg = sum / measurements.length;

  // Standard deviation
  const variance =
    measurements.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
    measurements.length;
  const stdDev = Math.sqrt(variance);

  // Percentiles
  const percentile = (p: number) => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  };

  return {
    avg,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    stdDev,
    p50: percentile(50),
    p90: percentile(90),
    p95: percentile(95),
    p99: percentile(99),
  };
}

/**
 * Run a single benchmark with timing and metrics collection
 */
async function runBenchmark(
  benchmark: BenchmarkFunction,
  suiteName: string,
  config: BenchmarkConfig,
  version: string
): Promise<BenchmarkResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config, ...benchmark.config };
  const metricsCollector = new MetricsCollector(mergedConfig);
  const measurements: number[] = [];

  console.log(`  Running: ${benchmark.name}`);

  // Warmup iterations
  console.log(`    Warmup (${mergedConfig.warmupIterations} iterations)...`);
  for (let i = 0; i < mergedConfig.warmupIterations; i++) {
    if (benchmark.setup) await benchmark.setup();
    await benchmark.fn();
    if (benchmark.teardown) await benchmark.teardown();
  }

  // Measured iterations
  console.log(`    Measuring (${mergedConfig.iterations} iterations)...`);
  metricsCollector.start();

  for (let i = 0; i < mergedConfig.iterations; i++) {
    if (benchmark.setup) await benchmark.setup();

    const start = performance.now();
    await benchmark.fn();
    const end = performance.now();

    measurements.push(end - start);
    metricsCollector.recordIteration();

    if (benchmark.teardown) await benchmark.teardown();
  }

  metricsCollector.end();

  // Calculate statistics
  const stats = calculateStats(measurements);
  const memory = mergedConfig.collectMemory
    ? metricsCollector.getMemoryMetrics()
    : undefined;
  const tokens = mergedConfig.collectTokens
    ? metricsCollector.getTokenMetrics()
    : undefined;
  const api = mergedConfig.collectTokens ? metricsCollector.getApiMetrics() : undefined;

  console.log(
    `    ✓ ${benchmark.name}: ${stats.avg.toFixed(2)}ms (±${stats.stdDev.toFixed(2)}ms)`
  );

  return {
    name: benchmark.name,
    suite: suiteName,
    avgTime: stats.avg,
    minTime: stats.min,
    maxTime: stats.max,
    stdDev: stats.stdDev,
    p50: stats.p50,
    p90: stats.p90,
    p95: stats.p95,
    p99: stats.p99,
    opsPerSecond: 1000 / stats.avg,
    memory,
    tokens,
    api,
    timestamp: new Date().toISOString(),
    version,
  };
}

/**
 * Run a complete benchmark suite
 */
export async function runSuite(
  suite: BenchmarkSuite,
  config: Partial<BenchmarkConfig> = {},
  version: string = 'unknown'
): Promise<BenchmarkResult[]> {
  console.log(`\n📊 Running suite: ${suite.name}`);
  console.log(`   ${suite.description}`);

  const results: BenchmarkResult[] = [];
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  for (const benchmark of suite.benchmarks) {
    try {
      const result = await runBenchmark(benchmark, suite.name, mergedConfig, version);
      results.push(result);
    } catch (error) {
      console.error(`  ✗ ${benchmark.name} failed:`, error);
      // Continue with other benchmarks
    }
  }

  console.log(
    `\n✓ Suite complete: ${results.length}/${suite.benchmarks.length} benchmarks passed\n`
  );

  return results;
}

/**
 * Run multiple benchmark suites
 */
export async function runSuites(
  suites: BenchmarkSuite[],
  config: Partial<BenchmarkConfig> = {},
  version: string = 'unknown'
): Promise<BenchmarkResult[]> {
  const allResults: BenchmarkResult[] = [];

  console.log('\n' + '='.repeat(60));
  console.log('🚀 IMAGINIZE PERFORMANCE BENCHMARKS');
  console.log('='.repeat(60));

  for (const suite of suites) {
    const results = await runSuite(suite, config, version);
    allResults.push(...results);
  }

  console.log('='.repeat(60));
  console.log(`✅ All suites complete: ${allResults.length} benchmarks run`);
  console.log('='.repeat(60) + '\n');

  return allResults;
}
