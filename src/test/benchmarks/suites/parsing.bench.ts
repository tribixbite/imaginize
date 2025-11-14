/**
 * Parsing Benchmarks
 *
 * Benchmarks for EPUB and PDF parsing performance
 */

import { parseEpub } from '../../../lib/epub-parser.js';
import { parsePdf } from '../../../lib/pdf-parser.js';
import { join } from 'path';
import type { BenchmarkSuite } from '../harness/types.js';

// Use integration test fixtures
const EPUB_FIXTURE = join(process.cwd(), 'src/test/integration/fixtures/epub/simple.epub');
const PDF_FIXTURE = join(process.cwd(), 'src/test/integration/fixtures/pdf/simple.pdf');

export const parsingSuite: BenchmarkSuite = {
  name: 'Parsing',
  description: 'EPUB and PDF parsing performance',
  benchmarks: [
    {
      name: 'EPUB parsing',
      fn: async () => {
        await parseEpub(EPUB_FIXTURE);
      },
      config: {
        warmupIterations: 2,
        iterations: 5,
        collectMemory: true,
      },
    },
    // Note: PDF parsing benchmark disabled due to fixture compression issues
    // The simple.pdf fixture works in integration tests but fails in benchmarks
    // with "Invalid PDF structure" due to compression method incompatibilities.
    // Future: Create dedicated benchmark fixture or use real-world PDF sample
    // {
    //   name: 'PDF parsing',
    //   fn: async () => {
    //     await parsePdf(PDF_FIXTURE);
    //   },
    //   config: {
    //     warmupIterations: 2,
    //     iterations: 5,
    //     collectMemory: true,
    //   },
    // },
  ],
};
