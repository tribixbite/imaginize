#!/usr/bin/env tsx
/**
 * Generate HTML Trend Report
 *
 * CLI tool for generating interactive HTML performance trend reports
 */

import { BenchmarkHistory } from './history/index.js';
import { join } from 'path';

interface Options {
  output?: string;
  version?: string;
  benchmarks?: string[];
  limit?: number;
  comparison?: boolean;
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    output: 'benchmarks/trends/performance-report.html',
    limit: 30,
    comparison: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--output':
      case '-o':
        options.output = args[++i];
        break;

      case '--version':
      case '-v':
        options.version = args[++i];
        break;

      case '--benchmarks':
      case '-b':
        options.benchmarks = args[++i].split(',');
        break;

      case '--limit':
      case '-l':
        options.limit = parseInt(args[++i], 10);
        break;

      case '--comparison':
      case '-c':
        options.comparison = true;
        break;

      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Generate HTML Performance Trend Report

Usage:
  npm run bench:trends [options]

Options:
  -o, --output <path>       Output path for HTML report (default: benchmarks/trends/performance-report.html)
  -v, --version <version>   Version to compare against (default: latest)
  -b, --benchmarks <list>   Comma-separated list of benchmark names to include (default: all)
  -l, --limit <number>      Number of historical runs to include per benchmark (default: 30)
  -c, --comparison          Include baseline comparison in report
  -h, --help                Show this help message

Examples:
  # Generate report for all benchmarks with last 30 runs
  npm run bench:trends

  # Generate report with baseline comparison
  npm run bench:trends --comparison

  # Generate report for specific benchmarks
  npm run bench:trends --benchmarks "State file write,EPUB parsing"

  # Generate report with more historical data
  npm run bench:trends --limit 50

  # Generate report comparing against v2.6.0
  npm run bench:trends --version 2.6.0 --comparison
  `);
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  console.log('📊 Generating performance trend report...\n');

  const history = new BenchmarkHistory();

  try {
    await history.generateTrendReport(options.output!, {
      benchmarks: options.benchmarks,
      limit: options.limit,
      version: options.version,
      includeComparison: options.comparison,
    });

    console.log('\n✅ Report generated successfully');
    console.log(`\nOpen in browser:`);
    console.log(`  file://${join(process.cwd(), options.output!)}`);

    // Show regression summary if available
    if (options.comparison) {
      console.log('\n' + history.getRegressionSummary());
    }
  } catch (error) {
    console.error('\n❌ Failed to generate report:', error);
    process.exit(1);
  } finally {
    history.close();
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
