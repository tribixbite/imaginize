#!/usr/bin/env tsx
/**
 * Verify database contents
 */

import { BenchmarkDatabase } from './history/database.js';

const db = new BenchmarkDatabase();

console.log('📊 Benchmark History Database Verification\n');

// Get latest run summary
const summary = db.getLatestRunSummary();
console.log('Latest Run Summary:');
console.log(`  Run ID: ${summary?.run_id}`);
console.log(`  Version: ${summary?.version}`);
console.log(`  Timestamp: ${summary?.timestamp}`);
console.log(`  Total Benchmarks: ${summary?.total_benchmarks}`);
console.log(`  Avg Execution Time: ${summary?.avg_execution_time.toFixed(3)}ms`);
console.log(`  Total Regressions: ${summary?.total_regressions}\n`);

// Get all benchmark names
const benchmarkNames = db.getAllBenchmarkNames();
console.log(`Total Unique Benchmarks: ${benchmarkNames.length}`);
console.log('Benchmark Names:');
benchmarkNames.forEach((name, i) => {
  console.log(`  ${i + 1}. ${name}`);
});

// Get baseline info
const baseline = db.getBaseline('2.7.0');
console.log(`\nBaseline for v2.7.0:`);
console.log(`  Baseline ID: ${baseline?.baseline_id}`);
console.log(`  Run ID: ${baseline?.run_id}`);
console.log(`  Active: ${baseline?.is_active}`);
console.log(`  Description: ${baseline?.description}`);

// Get unacknowledged regressions
const regressions = db.getUnacknowledgedRegressions(10);
console.log(`\nUnacknowledged Regressions: ${regressions.length}`);
if (regressions.length > 0) {
  regressions.slice(0, 5).forEach((reg) => {
    console.log(
      `  - ${reg.benchmark_name}: ${reg.percent_change.toFixed(1)}% slower (${reg.severity})`
    );
  });
}

db.close();
console.log('\n✅ Database verification complete');
