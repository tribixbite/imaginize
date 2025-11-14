-- Historical Benchmark Tracking Database Schema
-- SQLite database for storing benchmark results over time

-- Benchmark runs table (one per execution)
CREATE TABLE IF NOT EXISTS benchmark_runs (
  run_id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,           -- ISO 8601 timestamp
  version TEXT NOT NULL,              -- Package version (e.g., "2.7.0")
  commit_hash TEXT,                   -- Git commit hash
  branch_name TEXT,                   -- Git branch name
  ci_build_number TEXT,               -- CI build number (optional)
  environment TEXT,                   -- JSON: OS, Node version, etc.
  duration_ms INTEGER,                -- Total benchmark run time
  total_benchmarks INTEGER NOT NULL,  -- Count of benchmarks run
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying by version and timestamp
CREATE INDEX IF NOT EXISTS idx_runs_version_timestamp
  ON benchmark_runs(version, timestamp DESC);

-- Index for querying by commit hash
CREATE INDEX IF NOT EXISTS idx_runs_commit
  ON benchmark_runs(commit_hash);

-- Benchmark results table (one per benchmark per run)
CREATE TABLE IF NOT EXISTS benchmark_results (
  result_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  suite_name TEXT NOT NULL,
  benchmark_name TEXT NOT NULL,

  -- Performance metrics
  avg_time REAL NOT NULL,             -- Average execution time (ms)
  min_time REAL NOT NULL,             -- Minimum execution time (ms)
  max_time REAL NOT NULL,             -- Maximum execution time (ms)
  std_dev REAL NOT NULL,              -- Standard deviation (ms)
  p50 REAL NOT NULL,                  -- 50th percentile (median)
  p90 REAL NOT NULL,                  -- 90th percentile
  p95 REAL NOT NULL,                  -- 95th percentile
  p99 REAL NOT NULL,                  -- 99th percentile
  ops_per_second REAL NOT NULL,       -- Operations per second

  -- Memory metrics
  peak_heap_used INTEGER,             -- Peak heap memory used (bytes)
  peak_heap_total INTEGER,            -- Peak heap total (bytes)
  peak_rss INTEGER,                   -- Peak RSS (bytes)
  memory_growth_rate REAL,            -- Memory growth per iteration

  -- Token metrics (optional, for API benchmarks)
  total_tokens INTEGER,
  estimated_cost REAL,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (run_id) REFERENCES benchmark_runs(run_id) ON DELETE CASCADE
);

-- Index for querying by benchmark name across runs
CREATE INDEX IF NOT EXISTS idx_results_benchmark
  ON benchmark_results(benchmark_name, run_id);

-- Index for querying by suite
CREATE INDEX IF NOT EXISTS idx_results_suite
  ON benchmark_results(suite_name, benchmark_name);

-- Composite index for trend queries
CREATE INDEX IF NOT EXISTS idx_results_trends
  ON benchmark_results(benchmark_name, run_id DESC);

-- Version baselines table (canonical benchmark results for each version)
CREATE TABLE IF NOT EXISTS version_baselines (
  baseline_id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL UNIQUE,      -- Package version
  run_id INTEGER NOT NULL,            -- Reference run for this baseline
  is_active INTEGER NOT NULL DEFAULT 1, -- Boolean: currently active baseline
  description TEXT,                   -- Optional description
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (run_id) REFERENCES benchmark_runs(run_id)
);

-- Index for active baselines
CREATE INDEX IF NOT EXISTS idx_baselines_active
  ON version_baselines(is_active, version);

-- Regression alerts table (detected performance regressions)
CREATE TABLE IF NOT EXISTS regression_alerts (
  alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  benchmark_name TEXT NOT NULL,
  baseline_avg_time REAL NOT NULL,
  current_avg_time REAL NOT NULL,
  percent_change REAL NOT NULL,      -- Percentage slower (positive) or faster (negative)
  severity TEXT NOT NULL,             -- 'minor', 'moderate', 'severe'
  acknowledged INTEGER DEFAULT 0,     -- Boolean: has been reviewed
  notes TEXT,                         -- Optional notes about the regression
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (run_id) REFERENCES benchmark_runs(run_id)
);

-- Index for unacknowledged alerts
CREATE INDEX IF NOT EXISTS idx_alerts_unacknowledged
  ON regression_alerts(acknowledged, created_at DESC);

-- View: Latest results for each benchmark
CREATE VIEW IF NOT EXISTS latest_benchmark_results AS
SELECT
  br.benchmark_name,
  br.suite_name,
  br.avg_time,
  br.std_dev,
  br.ops_per_second,
  br.peak_heap_used,
  run.version,
  run.commit_hash,
  run.timestamp,
  br.run_id
FROM benchmark_results br
JOIN benchmark_runs run ON br.run_id = run.run_id
WHERE run.run_id = (
  SELECT MAX(r2.run_id)
  FROM benchmark_runs r2
)
ORDER BY br.suite_name, br.benchmark_name;

-- View: Performance trends (last 30 runs per benchmark)
CREATE VIEW IF NOT EXISTS performance_trends AS
SELECT
  br.benchmark_name,
  br.suite_name,
  br.avg_time,
  br.std_dev,
  br.ops_per_second,
  run.version,
  run.timestamp,
  run.commit_hash,
  br.run_id,
  ROW_NUMBER() OVER (
    PARTITION BY br.benchmark_name
    ORDER BY run.timestamp DESC
  ) AS run_rank
FROM benchmark_results br
JOIN benchmark_runs run ON br.run_id = run.run_id
ORDER BY br.benchmark_name, run.timestamp DESC;

-- View: Active baselines with benchmark details
CREATE VIEW IF NOT EXISTS active_baselines AS
SELECT
  vb.version,
  vb.baseline_id,
  br.benchmark_name,
  br.suite_name,
  br.avg_time,
  br.std_dev,
  br.ops_per_second,
  run.timestamp,
  run.commit_hash
FROM version_baselines vb
JOIN benchmark_runs run ON vb.run_id = run.run_id
JOIN benchmark_results br ON br.run_id = run.run_id
WHERE vb.is_active = 1
ORDER BY br.suite_name, br.benchmark_name;
