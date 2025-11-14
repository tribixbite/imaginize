/**
 * Parsing Benchmarks
 *
 * Benchmarks for EPUB and PDF parsing performance
 */

import { parseEpub } from '../../../lib/epub-parser.js';
import { parsePdf } from '../../../lib/pdf-parser.js';
import type { BenchmarkSuite } from '../harness/types.js';

// TODO: Add test fixtures in src/test/benchmarks/fixtures/
// For now, these benchmarks require actual book files to exist

export const parsingSuite: BenchmarkSuite = {
  name: 'Parsing',
  description: 'EPUB and PDF parsing performance',
  benchmarks: [
    {
      name: 'EPUB parsing (small book)',
      fn: async () => {
        // TODO: Use actual small test fixture
        // const result = await parseEpub('fixtures/small-book.epub');
        // Placeholder for now
        await new Promise((resolve) => setTimeout(resolve, 1));
      },
      config: {
        warmupIterations: 2,
        iterations: 5,
        collectMemory: true,
      },
    },
    {
      name: 'PDF parsing (small book)',
      fn: async () => {
        // TODO: Use actual small test fixture
        // const result = await parsePdf('fixtures/small-book.pdf');
        // Placeholder for now
        await new Promise((resolve) => setTimeout(resolve, 1));
      },
      config: {
        warmupIterations: 2,
        iterations: 5,
        collectMemory: true,
      },
    },
  ],
};
