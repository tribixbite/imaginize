/**
 * React hook for managing book processing state
 */

import { useState, useCallback, useRef } from 'react';
import { createOpenAIClient } from '../lib/api-client';
import { BookProcessor } from '../lib/processor';
import type { BookFile, ProcessingState, ProcessingResult, ActivityLog, ProcessingOptions } from '../types';

export function useProcessing() {
  const [state, setState] = useState<ProcessingState>({
    phase: 'idle',
    progress: 0,
    currentStep: '',
  });

  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const processorRef = useRef<BookProcessor | null>(null);

  /**
   * Start processing a book
   */
  const startProcessing = useCallback(async (
    bookFile: BookFile,
    apiKey: string,
    options?: Partial<ProcessingOptions>
  ) => {
    // Reset state
    setState({ phase: 'idle', progress: 0, currentStep: '' });
    setResult(null);
    setActivityLogs([]);
    setError(null);

    try {
      // Merge options with API key
      const processingOptions = { ...options, apiKey };

      // Create OpenAI client with options
      const openai = createOpenAIClient(apiKey, processingOptions);

      // Create processor with options
      const processor = new BookProcessor(bookFile, openai, {
        onStateChange: (newState) => {
          setState(newState);
        },

        onActivity: (log) => {
          setActivityLogs((prev) => [...prev, log]);
        },

        onChapterComplete: (chapterNumber, analysis) => {
          console.log(`Chapter ${chapterNumber} complete:`, analysis);
        },

        onImageComplete: (image) => {
          console.log(`Image generated:`, image);
        },

        onError: (err) => {
          setError(err);
        },
      }, processingOptions);

      processorRef.current = processor;

      // Start processing
      const processingResult = await processor.process();
      setResult(processingResult);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setState({ phase: 'error', progress: 0, currentStep: error.message });
    }
  }, []);

  /**
   * Cancel processing
   */
  const cancelProcessing = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.cancel();
      processorRef.current = null;
      setState({ phase: 'idle', progress: 0, currentStep: 'Cancelled' });
    }
  }, []);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    processorRef.current = null;
    setState({ phase: 'idle', progress: 0, currentStep: '' });
    setResult(null);
    setActivityLogs([]);
    setError(null);
  }, []);

  return {
    state,
    result,
    activityLogs,
    error,
    startProcessing,
    cancelProcessing,
    reset,
    isProcessing: state.phase !== 'idle' && state.phase !== 'complete' && state.phase !== 'error',
  };
}
