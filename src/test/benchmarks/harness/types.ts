/**
 * Performance Benchmarking Types
 *
 * Core type definitions for the benchmarking framework
 */

export interface BenchmarkConfig {
  /** Number of warmup iterations before timing */
  warmupIterations: number;
  /** Number of measured iterations */
  iterations: number;
  /** Timeout in milliseconds */
  timeout: number;
  /** Collect memory metrics */
  collectMemory: boolean;
  /** Collect token usage */
  collectTokens: boolean;
}

export interface BenchmarkResult {
  /** Benchmark name */
  name: string;
  /** Suite name */
  suite: string;
  /** Average execution time in milliseconds */
  avgTime: number;
  /** Minimum execution time */
  minTime: number;
  /** Maximum execution time */
  maxTime: number;
  /** Standard deviation */
  stdDev: number;
  /** P50 percentile */
  p50: number;
  /** P90 percentile */
  p90: number;
  /** P95 percentile */
  p95: number;
  /** P99 percentile */
  p99: number;
  /** Operations per second */
  opsPerSecond: number;
  /** Memory metrics */
  memory?: MemoryMetrics;
  /** Token metrics */
  tokens?: TokenMetrics;
  /** API metrics */
  api?: ApiMetrics;
  /** Timestamp */
  timestamp: string;
  /** Git commit hash */
  commit?: string;
  /** Version */
  version: string;
}

export interface MemoryMetrics {
  /** Peak heap used (bytes) */
  peakHeapUsed: number;
  /** Peak heap total (bytes) */
  peakHeapTotal: number;
  /** Peak RSS (bytes) */
  peakRss: number;
  /** Memory growth rate (bytes/iteration) */
  growthRate: number;
}

export interface TokenMetrics {
  /** Total tokens consumed */
  totalTokens: number;
  /** Prompt tokens */
  promptTokens: number;
  /** Completion tokens */
  completionTokens: number;
  /** Average tokens per operation */
  avgTokensPerOp: number;
  /** Estimated cost (USD) */
  estimatedCost: number;
}

export interface ApiMetrics {
  /** Total API requests */
  totalRequests: number;
  /** Average latency (ms) */
  avgLatency: number;
  /** P95 latency (ms) */
  p95Latency: number;
  /** Timeout count */
  timeouts: number;
  /** Retry count */
  retries: number;
  /** Requests per second */
  requestsPerSecond: number;
}

export interface BenchmarkSuite {
  /** Suite name */
  name: string;
  /** Suite description */
  description: string;
  /** Benchmarks in this suite */
  benchmarks: BenchmarkFunction[];
}

export interface BenchmarkFunction {
  /** Benchmark name */
  name: string;
  /** Benchmark function */
  fn: () => Promise<void> | void;
  /** Configuration overrides */
  config?: Partial<BenchmarkConfig>;
  /** Setup function (run before each iteration) */
  setup?: () => Promise<void> | void;
  /** Teardown function (run after each iteration) */
  teardown?: () => Promise<void> | void;
}

export interface ComparisonResult {
  /** Benchmark name */
  name: string;
  /** Current result */
  current: BenchmarkResult;
  /** Baseline result */
  baseline: BenchmarkResult;
  /** Performance change (percentage) */
  change: number;
  /** Is regression (slower than baseline) */
  isRegression: boolean;
  /** Is improvement (faster than baseline) */
  isImprovement: boolean;
  /** Significance level */
  significant: boolean;
}

export interface BenchmarkReport {
  /** Report timestamp */
  timestamp: string;
  /** Version */
  version: string;
  /** Git commit */
  commit?: string;
  /** Total benchmarks */
  totalBenchmarks: number;
  /** Results */
  results: BenchmarkResult[];
  /** Comparisons (if baseline exists) */
  comparisons?: ComparisonResult[];
  /** Summary statistics */
  summary: {
    totalTime: number;
    avgTime: number;
    totalMemory: number;
    totalTokens: number;
    totalCost: number;
  };
}
