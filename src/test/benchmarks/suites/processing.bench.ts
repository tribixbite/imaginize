/**
 * Processing Operations Benchmarks
 *
 * Benchmarks for token estimation, cost calculation, and text processing
 */

import {
  estimateTokens,
  estimateCost,
  willExceedLimit,
  calculateSplits,
} from '../../../lib/token-counter.js';
import type { BenchmarkSuite } from '../harness/types.js';
import type { ModelConfig } from '../../../types/config.js';

// Test data - realistic book chapter content
const SHORT_TEXT = `
The old wizard stood at the edge of the forest, his silver beard glinting in the moonlight.
Behind him, the village lay silent and dark, unaware of the danger that approached from the north.
He clutched his staff tightly, feeling the ancient magic pulse through the wood.
`;

const MEDIUM_TEXT = SHORT_TEXT.repeat(10); // ~800 chars, ~200 words
const LONG_TEXT = SHORT_TEXT.repeat(100); // ~8000 chars, ~2000 words
const VERY_LONG_TEXT = SHORT_TEXT.repeat(500); // ~40000 chars, ~10000 words

// Test model configurations
const GPT4O_MINI: ModelConfig = {
  name: 'gpt-4o-mini',
  contextLength: 128_000,
  inputCostPer1M: 0.15,
  outputCostPer1M: 0.6,
};

const GPT4O: ModelConfig = {
  name: 'gpt-4o',
  contextLength: 128_000,
  inputCostPer1M: 2.5,
  outputCostPer1M: 10.0,
};

export const processingSuite: BenchmarkSuite = {
  name: 'Processing',
  description: 'Token estimation, cost calculation, and text processing',
  benchmarks: [
    {
      name: 'Token estimation (short text ~200 chars)',
      fn: () => {
        estimateTokens(SHORT_TEXT);
      },
      config: {
        warmupIterations: 5,
        iterations: 20,
        collectMemory: true,
      },
    },
    {
      name: 'Token estimation (medium text ~800 chars)',
      fn: () => {
        estimateTokens(MEDIUM_TEXT);
      },
      config: {
        warmupIterations: 5,
        iterations: 20,
        collectMemory: true,
      },
    },
    {
      name: 'Token estimation (long text ~8000 chars)',
      fn: () => {
        estimateTokens(LONG_TEXT);
      },
      config: {
        warmupIterations: 5,
        iterations: 20,
        collectMemory: true,
      },
    },
    {
      name: 'Token estimation (very long text ~40k chars)',
      fn: () => {
        estimateTokens(VERY_LONG_TEXT);
      },
      config: {
        warmupIterations: 3,
        iterations: 10,
        collectMemory: true,
      },
    },
    {
      name: 'Cost calculation (gpt-4o-mini)',
      fn: () => {
        estimateCost(5000, 1000, GPT4O_MINI);
      },
      config: {
        warmupIterations: 5,
        iterations: 20,
        collectMemory: false,
      },
    },
    {
      name: 'Cost calculation (gpt-4o)',
      fn: () => {
        estimateCost(5000, 1000, GPT4O);
      },
      config: {
        warmupIterations: 5,
        iterations: 20,
        collectMemory: false,
      },
    },
    {
      name: 'Context limit check (within limit)',
      fn: () => {
        willExceedLimit(50_000, 2000, GPT4O_MINI, 0.9);
      },
      config: {
        warmupIterations: 5,
        iterations: 20,
        collectMemory: false,
      },
    },
    {
      name: 'Context limit check (exceeding limit)',
      fn: () => {
        willExceedLimit(120_000, 10_000, GPT4O_MINI, 0.9);
      },
      config: {
        warmupIterations: 5,
        iterations: 20,
        collectMemory: false,
      },
    },
    {
      name: 'Text chunking (small text, no splits)',
      fn: () => {
        calculateSplits(MEDIUM_TEXT, 10_000, 200);
      },
      config: {
        warmupIterations: 3,
        iterations: 10,
        collectMemory: true,
      },
    },
    {
      name: 'Text chunking (large text, multiple splits)',
      fn: () => {
        calculateSplits(VERY_LONG_TEXT, 5_000, 200);
      },
      config: {
        warmupIterations: 3,
        iterations: 10,
        collectMemory: true,
      },
    },
  ],
};
