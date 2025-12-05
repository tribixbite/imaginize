/**
 * State Management Benchmarks
 *
 * Benchmarks for state persistence and recovery operations
 */

import { StateManager } from '../../../lib/state-manager.js';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import type { BenchmarkSuite } from '../harness/types.js';

const TEST_DIR = join(process.cwd(), 'benchmarks', 'test-state');

export const stateSuite: BenchmarkSuite = {
  name: 'State Management',
  description: 'State persistence and recovery performance',
  benchmarks: [
    {
      name: 'State file write',
      setup: () => {
        mkdirSync(TEST_DIR, { recursive: true });
      },
      fn: async () => {
        const stateManager = new StateManager(
          TEST_DIR,
          'test-book.epub',
          'Test Book',
          100
        );

        // Update some phase status
        stateManager.updatePhase('parse', 'completed');
        stateManager.updatePhase('analyze', 'in_progress');

        await stateManager.save();
      },
      teardown: () => {
        rmSync(TEST_DIR, { recursive: true, force: true });
      },
      config: {
        warmupIterations: 3,
        iterations: 10,
        collectMemory: true,
      },
    },
    {
      name: 'State file read',
      setup: async () => {
        mkdirSync(TEST_DIR, { recursive: true });
        const stateManager = new StateManager(
          TEST_DIR,
          'test-book.epub',
          'Test Book',
          100
        );

        stateManager.updatePhase('parse', 'completed');
        stateManager.updatePhase('analyze', 'in_progress');

        await stateManager.save();
      },
      fn: async () => {
        const stateManager = new StateManager(
          TEST_DIR,
          'test-book.epub',
          'Test Book',
          100
        );
        await stateManager.load();
      },
      teardown: () => {
        rmSync(TEST_DIR, { recursive: true, force: true });
      },
      config: {
        warmupIterations: 3,
        iterations: 10,
        collectMemory: true,
      },
    },
  ],
};
