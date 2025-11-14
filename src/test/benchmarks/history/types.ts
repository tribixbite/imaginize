/**
 * Historical Benchmark Tracking Types
 */

export interface BenchmarkRun {
  run_id?: number;
  timestamp: string;
  version: string;
  commit_hash?: string;
  branch_name?: string;
  ci_build_number?: string;
  environment?: string; // JSON string
  duration_ms?: number;
  total_benchmarks: number;
  created_at?: string;
}

export interface BenchmarkResultRow {
  result_id?: number;
  run_id: number;
  suite_name: string;
  benchmark_name: string;

  // Performance metrics
  avg_time: number;
  min_time: number;
  max_time: number;
  std_dev: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  ops_per_second: number;

  // Memory metrics
  peak_heap_used?: number;
  peak_heap_total?: number;
  peak_rss?: number;
  memory_growth_rate?: number;

  // Token metrics (optional)
  total_tokens?: number;
  estimated_cost?: number;

  created_at?: string;
}

export interface VersionBaseline {
  baseline_id?: number;
  version: string;
  run_id: number;
  is_active: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RegressionAlert {
  alert_id?: number;
  run_id: number;
  benchmark_name: string;
  baseline_avg_time: number;
  current_avg_time: number;
  percent_change: number;
  severity: 'minor' | 'moderate' | 'severe';
  acknowledged: boolean;
  notes?: string;
  created_at?: string;
}

export interface EnvironmentInfo {
  os: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  bunVersion?: string;
  cpuModel?: string;
  totalMemory?: number;
}

export interface TrendPoint {
  timestamp: string;
  avg_time: number;
  std_dev: number;
  ops_per_second: number;
  version: string;
  commit_hash?: string;
}

export interface BenchmarkTrend {
  benchmark_name: string;
  suite_name: string;
  data_points: TrendPoint[];
  moving_average?: number[];
  regression_line?: { slope: number; intercept: number };
}

export interface PerformanceComparison {
  benchmark_name: string;
  baseline_time: number;
  current_time: number;
  percent_change: number;
  is_regression: boolean;
  is_improvement: boolean;
  severity?: 'minor' | 'moderate' | 'severe';
}
