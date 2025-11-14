/**
 * Historical Benchmark Tracking - Integration Module
 *
 * High-level API for recording and analyzing benchmark history
 */

import { BenchmarkDatabase } from './database.js';
import { generateHtmlReport, type ReportData } from './html-reporter.js';
import type { BenchmarkResult } from '../harness/types.js';
import type { EnvironmentInfo, BenchmarkResultRow, BenchmarkRun } from './types.js';
import { platform, arch, release } from 'os';
import { totalmem } from 'os';

export class BenchmarkHistory {
  private db: BenchmarkDatabase;

  constructor(dbPath?: string) {
    this.db = new BenchmarkDatabase(dbPath);
  }

  /**
   * Record a complete benchmark run
   */
  async recordRun(
    version: string,
    results: BenchmarkResult[],
    options?: {
      commitHash?: string;
      branchName?: string;
      ciBuildNumber?: string;
    }
  ): Promise<number> {
    const timestamp = new Date().toISOString();
    const environment = this.getEnvironmentInfo();

    // Insert run
    const runId = this.db.insertRun({
      timestamp,
      version,
      commit_hash: options?.commitHash,
      branch_name: options?.branchName,
      ci_build_number: options?.ciBuildNumber,
      environment: JSON.stringify(environment),
      total_benchmarks: results.length,
    });

    // Convert and insert results
    const resultRows: BenchmarkResultRow[] = results.map((r) => ({
      run_id: runId,
      suite_name: r.suite,
      benchmark_name: r.name,
      avg_time: r.avgTime,
      min_time: r.minTime,
      max_time: r.maxTime,
      std_dev: r.stdDev,
      p50: r.p50,
      p90: r.p90,
      p95: r.p95,
      p99: r.p99,
      ops_per_second: r.opsPerSecond,
      peak_heap_used: r.memory?.peakHeapUsed,
      peak_heap_total: r.memory?.peakHeapTotal,
      peak_rss: r.memory?.peakRss,
      memory_growth_rate: r.memory?.growthRate,
      total_tokens: r.tokens?.total,
      estimated_cost: r.tokens?.estimatedCost,
    }));

    this.db.insertResults(resultRows);

    // Check for regressions against baseline
    const baseline = this.db.getBaseline(version);
    if (baseline) {
      const baselineResults = this.db.getBaselineResults(version);
      const comparisons = this.db.compareWithBaseline(resultRows, baselineResults);

      // Record regression alerts
      this.db.recordRegressions(runId, comparisons);

      // Log regressions to console
      const regressions = comparisons.filter((c) => c.is_regression);
      if (regressions.length > 0) {
        console.log(`\n📊 Detected ${regressions.length} performance regression(s) from baseline`);
        for (const reg of regressions) {
          console.log(`   - ${reg.benchmark_name}: ${reg.percent_change.toFixed(1)}% slower (${reg.severity})`);
        }
      }
    }

    return runId;
  }

  /**
   * Set baseline for current version
   */
  setBaseline(version: string, runId: number, description?: string): void {
    this.db.setBaseline(version, runId, description);
    console.log(`✓ Set baseline for version ${version} (run ${runId})`);
  }

  /**
   * Generate HTML trend report
   */
  async generateTrendReport(
    outputPath: string,
    options?: {
      benchmarks?: string[]; // Specific benchmarks to include
      limit?: number; // Number of data points per benchmark
      version?: string;
      includeComparison?: boolean;
    }
  ): Promise<void> {
    const limit = options?.limit || 30;
    const version = options?.version || 'latest';

    // Get benchmark names to include
    let benchmarkNames: string[];
    if (options?.benchmarks) {
      benchmarkNames = options.benchmarks;
    } else {
      benchmarkNames = this.db.getAllBenchmarkNames();
    }

    // Get trend data for each benchmark
    const trends = benchmarkNames
      .map((name) => this.db.getTrend(name, limit))
      .filter((t) => t !== null) as any[];

    // Get comparisons if requested
    let comparisons;
    if (options?.includeComparison && version !== 'latest') {
      const baselineResults = this.db.getBaselineResults(version);
      const summary = this.db.getLatestRunSummary();
      if (summary && baselineResults.length > 0) {
        // Get latest results
        const latestRunId = summary.run_id;
        const stmt = this.db['db'].prepare(`
          SELECT * FROM benchmark_results WHERE run_id = ?
        `);
        const latestResults = stmt.all(latestRunId) as BenchmarkResultRow[];
        comparisons = this.db.compareWithBaseline(latestResults, baselineResults);
      }
    }

    // Get summary stats
    const summary = this.db.getLatestRunSummary();
    const summaryData = summary
      ? {
          total_benchmarks: summary.total_benchmarks,
          total_regressions: summary.total_regressions,
          total_improvements:
            comparisons?.filter((c) => c.is_improvement).length || 0,
          avg_execution_time: summary.avg_execution_time,
        }
      : undefined;

    const reportData: ReportData = {
      title: 'imaginize Performance Trends',
      version,
      timestamp: new Date().toISOString(),
      commit_hash: summary?.version,
      trends,
      comparisons: options?.includeComparison ? comparisons : undefined,
      summary: summaryData,
    };

    await generateHtmlReport(reportData, outputPath);
    console.log(`✓ Generated HTML trend report: ${outputPath}`);
  }

  /**
   * Get environment information
   */
  private getEnvironmentInfo(): EnvironmentInfo {
    return {
      os: platform(),
      platform: platform(),
      arch: arch(),
      nodeVersion: process.version,
      bunVersion: (process.versions as any).bun,
      totalMemory: totalmem(),
    };
  }

  /**
   * Get regression summary
   */
  getRegressionSummary(acknowledged: boolean = false): string {
    const alerts = this.db.getUnacknowledgedRegressions(100);
    const filtered = acknowledged
      ? alerts
      : alerts.filter((a) => !a.acknowledged);

    if (filtered.length === 0) {
      return 'No regressions detected';
    }

    let summary = `Found ${filtered.length} regression(s):\n`;
    for (const alert of filtered) {
      summary += `  - ${alert.benchmark_name}: ${alert.percent_change.toFixed(1)}% slower (${alert.severity})\n`;
    }

    return summary;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Export types and classes
export { BenchmarkDatabase } from './database.js';
export { generateHtmlReport } from './html-reporter.js';
export type * from './types.js';
