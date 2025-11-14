/**
 * HTML Report Generator
 *
 * Generates interactive HTML reports with trend charts
 */

import { writeFile } from 'fs/promises';
import type { BenchmarkTrend, PerformanceComparison } from './types.js';

export interface ReportData {
  title: string;
  version: string;
  timestamp: string;
  commit_hash?: string;
  trends: BenchmarkTrend[];
  comparisons?: PerformanceComparison[];
  summary?: {
    total_benchmarks: number;
    total_regressions: number;
    total_improvements: number;
    avg_execution_time: number;
  };
}

/**
 * Generate HTML report with Chart.js visualizations
 */
export async function generateHtmlReport(
  data: ReportData,
  outputPath: string
): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      padding: 2rem;
      line-height: 1.6;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 2px solid #1e293b;
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      background: linear-gradient(to right, #3b82f6, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .meta {
      color: #94a3b8;
      font-size: 0.95rem;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-bottom: 3rem;
    }

    .summary-card {
      background: #1e293b;
      padding: 1.5rem;
      border-radius: 0.75rem;
      border: 1px solid #334155;
    }

    .summary-label {
      color: #94a3b8;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    .summary-value {
      font-size: 2rem;
      font-weight: 700;
      color: #e2e8f0;
    }

    .summary-value.good {
      color: #10b981;
    }

    .summary-value.bad {
      color: #ef4444;
    }

    .chart-section {
      margin-bottom: 3rem;
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    h2 {
      font-size: 1.5rem;
      color: #e2e8f0;
    }

    .suite-badge {
      background: #1e293b;
      color: #94a3b8;
      padding: 0.25rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      border: 1px solid #334155;
    }

    .chart-container {
      background: #1e293b;
      padding: 2rem;
      border-radius: 0.75rem;
      border: 1px solid #334155;
      position: relative;
      height: 400px;
    }

    .comparisons {
      margin-top: 3rem;
    }

    .comparison-table {
      width: 100%;
      border-collapse: collapse;
      background: #1e293b;
      border-radius: 0.75rem;
      overflow: hidden;
    }

    .comparison-table th {
      background: #0f172a;
      padding: 1rem;
      text-align: left;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      font-size: 0.875rem;
      letter-spacing: 0.05em;
    }

    .comparison-table td {
      padding: 1rem;
      border-top: 1px solid #334155;
    }

    .comparison-table tr:hover {
      background: #0f172a;
    }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .badge.improvement {
      background: #064e3b;
      color: #10b981;
    }

    .badge.regression {
      background: #7f1d1d;
      color: #ef4444;
    }

    .badge.neutral {
      background: #1e293b;
      color: #94a3b8;
    }

    .badge.severe {
      background: #7f1d1d;
      color: #fee2e2;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    footer {
      margin-top: 4rem;
      padding-top: 2rem;
      border-top: 2px solid #1e293b;
      text-align: center;
      color: #64748b;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${data.title}</h1>
      <div class="meta">
        <strong>Version:</strong> ${data.version} |
        <strong>Generated:</strong> ${new Date(data.timestamp).toLocaleString()}
        ${data.commit_hash ? ` | <strong>Commit:</strong> ${data.commit_hash}` : ''}
      </div>
    </header>

    ${
      data.summary
        ? `
    <div class="summary">
      <div class="summary-card">
        <div class="summary-label">Total Benchmarks</div>
        <div class="summary-value">${data.summary.total_benchmarks}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Avg Execution Time</div>
        <div class="summary-value">${data.summary.avg_execution_time.toFixed(2)}ms</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Improvements</div>
        <div class="summary-value good">${data.summary.total_improvements}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Regressions</div>
        <div class="summary-value ${data.summary.total_regressions > 0 ? 'bad' : ''}">${data.summary.total_regressions}</div>
      </div>
    </div>
    `
        : ''
    }

    ${data.trends
      .map(
        (trend, index) => `
    <div class="chart-section">
      <div class="chart-header">
        <h2>${trend.benchmark_name}</h2>
        <span class="suite-badge">${trend.suite_name}</span>
      </div>
      <div class="chart-container">
        <canvas id="chart-${index}"></canvas>
      </div>
    </div>
    `
      )
      .join('')}

    ${
      data.comparisons && data.comparisons.length > 0
        ? `
    <div class="comparisons">
      <h2 style="margin-bottom: 1.5rem;">Performance Comparison</h2>
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Benchmark</th>
            <th>Baseline</th>
            <th>Current</th>
            <th>Change</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.comparisons
            .map(
              (comp) => `
          <tr>
            <td>${comp.benchmark_name}</td>
            <td>${comp.baseline_time.toFixed(3)}ms</td>
            <td>${comp.current_time.toFixed(3)}ms</td>
            <td>${comp.percent_change > 0 ? '+' : ''}${comp.percent_change.toFixed(1)}%</td>
            <td>
              ${
                comp.is_regression
                  ? `<span class="badge regression ${comp.severity === 'severe' ? 'severe' : ''}">${comp.severity?.toUpperCase()}</span>`
                  : comp.is_improvement
                    ? '<span class="badge improvement">IMPROVEMENT</span>'
                    : '<span class="badge neutral">NO CHANGE</span>'
              }
            </td>
          </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
    `
        : ''
    }

    <footer>
      Generated by imaginize benchmark suite
    </footer>
  </div>

  <script>
    const trendsData = ${JSON.stringify(data.trends)};

    trendsData.forEach((trend, index) => {
      const ctx = document.getElementById('chart-' + index).getContext('2d');

      new Chart(ctx, {
        type: 'line',
        data: {
          labels: trend.data_points.map(p => {
            const date = new Date(p.timestamp);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
          }),
          datasets: [
            {
              label: 'Execution Time (ms)',
              data: trend.data_points.map(p => p.avg_time),
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderWidth: 2,
              tension: 0.3,
              fill: true,
              pointRadius: 4,
              pointHoverRadius: 6,
            },
            {
              label: 'Std Dev',
              data: trend.data_points.map(p => p.std_dev),
              borderColor: '#8b5cf6',
              backgroundColor: 'rgba(139, 92, 246, 0.05)',
              borderWidth: 1,
              borderDash: [5, 5],
              tension: 0.3,
              fill: false,
              pointRadius: 2,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                color: '#94a3b8',
                font: {
                  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
                  size: 12
                }
              }
            },
            tooltip: {
              backgroundColor: '#0f172a',
              titleColor: '#e2e8f0',
              bodyColor: '#94a3b8',
              borderColor: '#334155',
              borderWidth: 1,
              callbacks: {
                footer: function(items) {
                  const index = items[0].dataIndex;
                  const point = trend.data_points[index];
                  return 'Version: ' + point.version + (point.commit_hash ? '\\nCommit: ' + point.commit_hash : '');
                }
              }
            }
          },
          scales: {
            x: {
              grid: {
                color: '#1e293b',
              },
              ticks: {
                color: '#64748b',
                maxRotation: 45,
                minRotation: 45
              }
            },
            y: {
              grid: {
                color: '#1e293b',
              },
              ticks: {
                color: '#64748b',
                callback: function(value) {
                  return value.toFixed(3) + 'ms';
                }
              }
            }
          }
        }
      });
    });
  </script>
</body>
</html>`;

  await writeFile(outputPath, html, 'utf-8');
}
