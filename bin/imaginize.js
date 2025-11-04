#!/usr/bin/env node

/**
 * imaginize CLI entry point
 * Generates illustration guides from EPUB and PDF books using AI
 */

import('../dist/index.js')
  .then(({ main }) => main())
  .catch((err) => {
    console.error('Failed to load imaginize:', err);
    process.exit(1);
  });
