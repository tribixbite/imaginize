/**
 * Historical Benchmark Database
 *
 * SQLite database for storing and querying benchmark history
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type {
  BenchmarkRun,
  BenchmarkResultRow,
  VersionBaseline,
  RegressionAlert,
  TrendPoint,
  BenchmarkTrend,
  PerformanceComparison,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class BenchmarkDatabase {
  private db: Database.Database;

  constructor(dbPath: string = 'benchmarks/history/benchmarks.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
    this.initialize();
  }

  /**
   * Initialize database with schema
   */
  private initialize(): void {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Execute schema (multiple statements)
    this.db.exec(schema);
  }

  /**
   * Insert a new benchmark run
   */
  insertRun(run: BenchmarkRun): number {
    const stmt = this.db.prepare(`
      INSERT INTO benchmark_runs (
        timestamp, version, commit_hash, branch_name,
        ci_build_number, environment, duration_ms, total_benchmarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      run.timestamp,
      run.version,
      run.commit_hash || null,
      run.branch_name || null,
      run.ci_build_number || null,
      run.environment || null,
      run.duration_ms || null,
      run.total_benchmarks
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Insert benchmark results for a run
   */
  insertResults(results: BenchmarkResultRow[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO benchmark_results (
        run_id, suite_name, benchmark_name,
        avg_time, min_time, max_time, std_dev,
        p50, p90, p95, p99, ops_per_second,
        peak_heap_used, peak_heap_total, peak_rss, memory_growth_rate,
        total_tokens, estimated_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insert = this.db.transaction((rows: BenchmarkResultRow[]) => {
      for (const row of rows) {
        stmt.run(
          row.run_id,
          row.suite_name,
          row.benchmark_name,
          row.avg_time,
          row.min_time,
          row.max_time,
          row.std_dev,
          row.p50,
          row.p90,
          row.p95,
          row.p99,
          row.ops_per_second,
          row.peak_heap_used || null,
          row.peak_heap_total || null,
          row.peak_rss || null,
          row.memory_growth_rate || null,
          row.total_tokens || null,
          row.estimated_cost || null
        );
      }
    });

    insert(results);
  }

  /**
   * Get trend data for a specific benchmark
   */
  getTrend(benchmarkName: string, limit: number = 30): BenchmarkTrend | null {
    const stmt = this.db.prepare(`
      SELECT
        br.avg_time,
        br.std_dev,
        br.ops_per_second,
        br.suite_name,
        run.timestamp,
        run.version,
        run.commit_hash
      FROM benchmark_results br
      JOIN benchmark_runs run ON br.run_id = run.run_id
      WHERE br.benchmark_name = ?
      ORDER BY run.timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(benchmarkName, limit) as Array<{
      avg_time: number;
      std_dev: number;
      ops_per_second: number;
      suite_name: string;
      timestamp: string;
      version: string;
      commit_hash: string;
    }>;

    if (rows.length === 0) {
      return null;
    }

    const dataPoints: TrendPoint[] = rows.reverse().map((row) => ({
      timestamp: row.timestamp,
      avg_time: row.avg_time,
      std_dev: row.std_dev,
      ops_per_second: row.ops_per_second,
      version: row.version,
      commit_hash: row.commit_hash,
    }));

    return {
      benchmark_name: benchmarkName,
      suite_name: rows[0].suite_name,
      data_points: dataPoints,
    };
  }

  /**
   * Get all benchmark names
   */
  getAllBenchmarkNames(): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT benchmark_name
      FROM benchmark_results
      ORDER BY benchmark_name
    `);

    const rows = stmt.all() as Array<{ benchmark_name: string }>;
    return rows.map((r) => r.benchmark_name);
  }

  /**
   * Set or update baseline for a version
   */
  setBaseline(version: string, runId: number, description?: string): void {
    // Deactivate previous baseline for this version
    const deactivateStmt = this.db.prepare(`
      UPDATE version_baselines
      SET is_active = 0
      WHERE version = ?
    `);
    deactivateStmt.run(version);

    // Insert new baseline
    const insertStmt = this.db.prepare(`
      INSERT INTO version_baselines (version, run_id, is_active, description)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(version) DO UPDATE SET
        run_id = excluded.run_id,
        is_active = 1,
        description = excluded.description,
        updated_at = CURRENT_TIMESTAMP
    `);

    insertStmt.run(version, runId, description || null);
  }

  /**
   * Get active baseline for a version
   */
  getBaseline(version: string): VersionBaseline | null {
    const stmt = this.db.prepare(`
      SELECT * FROM version_baselines
      WHERE version = ? AND is_active = 1
    `);

    return stmt.get(version) as VersionBaseline | null;
  }

  /**
   * Get baseline results for comparison
   */
  getBaselineResults(version: string): BenchmarkResultRow[] {
    const stmt = this.db.prepare(`
      SELECT br.*
      FROM version_baselines vb
      JOIN benchmark_results br ON br.run_id = vb.run_id
      WHERE vb.version = ? AND vb.is_active = 1
      ORDER BY br.suite_name, br.benchmark_name
    `);

    return stmt.all(version) as BenchmarkResultRow[];
  }

  /**
   * Compare current results with baseline
   */
  compareWithBaseline(
    currentResults: BenchmarkResultRow[],
    baselineResults: BenchmarkResultRow[],
    threshold: number = 0.05
  ): PerformanceComparison[] {
    const baselineMap = new Map<string, BenchmarkResultRow>();
    for (const result of baselineResults) {
      baselineMap.set(result.benchmark_name, result);
    }

    const comparisons: PerformanceComparison[] = [];

    for (const current of currentResults) {
      const baseline = baselineMap.get(current.benchmark_name);
      if (!baseline) continue;

      const percentChange = ((current.avg_time - baseline.avg_time) / baseline.avg_time) * 100;
      const isRegression = percentChange > threshold * 100;
      const isImprovement = percentChange < -threshold * 100;

      let severity: 'minor' | 'moderate' | 'severe' | undefined;
      if (isRegression) {
        if (percentChange > 50) severity = 'severe';
        else if (percentChange > 20) severity = 'moderate';
        else severity = 'minor';
      }

      comparisons.push({
        benchmark_name: current.benchmark_name,
        baseline_time: baseline.avg_time,
        current_time: current.avg_time,
        percent_change: percentChange,
        is_regression: isRegression,
        is_improvement: isImprovement,
        severity,
      });
    }

    return comparisons;
  }

  /**
   * Record regression alerts
   */
  recordRegressions(runId: number, comparisons: PerformanceComparison[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO regression_alerts (
        run_id, benchmark_name, baseline_avg_time, current_avg_time,
        percent_change, severity
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insert = this.db.transaction((alerts: PerformanceComparison[]) => {
      for (const alert of alerts) {
        if (alert.is_regression && alert.severity) {
          stmt.run(
            runId,
            alert.benchmark_name,
            alert.baseline_time,
            alert.current_time,
            alert.percent_change,
            alert.severity
          );
        }
      }
    });

    insert(comparisons);
  }

  /**
   * Get unacknowledged regression alerts
   */
  getUnacknowledgedRegressions(limit: number = 50): RegressionAlert[] {
    const stmt = this.db.prepare(`
      SELECT * FROM regression_alerts
      WHERE acknowledged = 0
      ORDER BY created_at DESC
      LIMIT ?
    `);

    return stmt.all(limit) as RegressionAlert[];
  }

  /**
   * Acknowledge a regression alert
   */
  acknowledgeRegression(alertId: number, notes?: string): void {
    const stmt = this.db.prepare(`
      UPDATE regression_alerts
      SET acknowledged = 1, notes = ?
      WHERE alert_id = ?
    `);

    stmt.run(notes || null, alertId);
  }

  /**
   * Get summary statistics for latest run
   */
  getLatestRunSummary(): {
    run_id: number;
    timestamp: string;
    version: string;
    total_benchmarks: number;
    avg_execution_time: number;
    total_regressions: number;
  } | null {
    const stmt = this.db.prepare(`
      SELECT
        run.run_id,
        run.timestamp,
        run.version,
        run.total_benchmarks,
        AVG(br.avg_time) as avg_execution_time,
        (
          SELECT COUNT(*)
          FROM regression_alerts ra
          WHERE ra.run_id = run.run_id
        ) as total_regressions
      FROM benchmark_runs run
      LEFT JOIN benchmark_results br ON br.run_id = run.run_id
      WHERE run.run_id = (SELECT MAX(run_id) FROM benchmark_runs)
      GROUP BY run.run_id
    `);

    return stmt.get() as any;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
