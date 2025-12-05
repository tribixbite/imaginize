/**
 * Metrics Collector
 *
 * Collects performance metrics during benchmark execution including
 * memory usage, token counts, and API latency
 */

import type {
  BenchmarkConfig,
  MemoryMetrics,
  TokenMetrics,
  ApiMetrics,
} from './types.js';

export class MetricsCollector {
  private config: BenchmarkConfig;
  private startTime: number = 0;
  private endTime: number = 0;
  private iterations: number = 0;

  // Memory tracking
  private memorySnapshots: { heapUsed: number; heapTotal: number; rss: number }[] = [];
  private initialMemory: NodeJS.MemoryUsage;

  // Token tracking
  private totalTokens: number = 0;
  private promptTokens: number = 0;
  private completionTokens: number = 0;

  // API tracking
  private apiRequests: number = 0;
  private apiLatencies: number[] = [];
  private apiTimeouts: number = 0;
  private apiRetries: number = 0;

  constructor(config: BenchmarkConfig) {
    this.config = config;
    this.initialMemory = process.memoryUsage();
  }

  /**
   * Start metrics collection
   */
  start(): void {
    this.startTime = performance.now();
    if (this.config.collectMemory) {
      this.recordMemorySnapshot();
    }
  }

  /**
   * End metrics collection
   */
  end(): void {
    this.endTime = performance.now();
    if (this.config.collectMemory) {
      this.recordMemorySnapshot();
    }
  }

  /**
   * Record an iteration (for memory tracking)
   */
  recordIteration(): void {
    this.iterations++;
    if (this.config.collectMemory) {
      this.recordMemorySnapshot();
    }
  }

  /**
   * Record memory snapshot
   */
  private recordMemorySnapshot(): void {
    const mem = process.memoryUsage();
    this.memorySnapshots.push({
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      rss: mem.rss,
    });
  }

  /**
   * Record token usage from API response
   */
  recordTokens(prompt: number, completion: number): void {
    this.promptTokens += prompt;
    this.completionTokens += completion;
    this.totalTokens += prompt + completion;
  }

  /**
   * Record API request metrics
   */
  recordApiRequest(
    latencyMs: number,
    timeout: boolean = false,
    retry: boolean = false
  ): void {
    this.apiRequests++;
    this.apiLatencies.push(latencyMs);
    if (timeout) this.apiTimeouts++;
    if (retry) this.apiRetries++;
  }

  /**
   * Get memory metrics
   */
  getMemoryMetrics(): MemoryMetrics {
    if (this.memorySnapshots.length === 0) {
      return {
        peakHeapUsed: 0,
        peakHeapTotal: 0,
        peakRss: 0,
        growthRate: 0,
      };
    }

    const peakHeapUsed = Math.max(...this.memorySnapshots.map((s) => s.heapUsed));
    const peakHeapTotal = Math.max(...this.memorySnapshots.map((s) => s.heapTotal));
    const peakRss = Math.max(...this.memorySnapshots.map((s) => s.rss));

    // Calculate growth rate (bytes per iteration)
    const firstSnapshot = this.memorySnapshots[0];
    const lastSnapshot = this.memorySnapshots[this.memorySnapshots.length - 1];
    const growthRate =
      this.iterations > 1
        ? (lastSnapshot.heapUsed - firstSnapshot.heapUsed) / this.iterations
        : 0;

    return {
      peakHeapUsed,
      peakHeapTotal,
      peakRss,
      growthRate,
    };
  }

  /**
   * Get token metrics
   */
  getTokenMetrics(): TokenMetrics {
    const avgTokensPerOp = this.iterations > 0 ? this.totalTokens / this.iterations : 0;

    // Rough cost estimation (GPT-4o pricing as of 2024)
    // $2.50 per 1M input tokens, $10 per 1M output tokens
    const estimatedCost =
      (this.promptTokens / 1_000_000) * 2.5 + (this.completionTokens / 1_000_000) * 10;

    return {
      totalTokens: this.totalTokens,
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      avgTokensPerOp,
      estimatedCost,
    };
  }

  /**
   * Get API metrics
   */
  getApiMetrics(): ApiMetrics {
    if (this.apiLatencies.length === 0) {
      return {
        totalRequests: 0,
        avgLatency: 0,
        p95Latency: 0,
        timeouts: 0,
        retries: 0,
        requestsPerSecond: 0,
      };
    }

    const sorted = [...this.apiLatencies].sort((a, b) => a - b);
    const avgLatency = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;
    const p95Index = Math.ceil(0.95 * sorted.length) - 1;
    const p95Latency = sorted[Math.max(0, p95Index)];

    const durationSeconds = (this.endTime - this.startTime) / 1000;
    const requestsPerSecond =
      durationSeconds > 0 ? this.apiRequests / durationSeconds : 0;

    return {
      totalRequests: this.apiRequests,
      avgLatency,
      p95Latency,
      timeouts: this.apiTimeouts,
      retries: this.apiRetries,
      requestsPerSecond,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.startTime = 0;
    this.endTime = 0;
    this.iterations = 0;
    this.memorySnapshots = [];
    this.totalTokens = 0;
    this.promptTokens = 0;
    this.completionTokens = 0;
    this.apiRequests = 0;
    this.apiLatencies = [];
    this.apiTimeouts = 0;
    this.apiRetries = 0;
    this.initialMemory = process.memoryUsage();
  }
}
