/**
 * Type definitions for the imaginize demo application
 */

export interface ProcessingState {
  phase: 'idle' | 'parsing' | 'analyzing' | 'extracting' | 'illustrating' | 'complete' | 'error';
  progress: number;
  currentStep: string;
  estimatedTimeRemaining?: number;
}

export interface BookFile {
  file: File;
  type: 'epub' | 'pdf';
  size: number;
  name: string;
}

export interface APIKeyConfig {
  key: string;
  sessionOnly: boolean;
  lastUsed?: Date;
}

export interface ProcessingResult {
  chapters: Chapter[];
  elements: Element[];
  images: GeneratedImage[];
  statistics: ProcessingStatistics;
}

export interface Chapter {
  number: number;
  title: string;
  scenes: Scene[];
}

export interface Scene {
  number: number;
  description: string;
  mood?: string;
  lighting?: string;
  imageFilename?: string;
}

export interface Element {
  type: 'character' | 'place' | 'object';
  name: string;
  description: string;
  appearances: number[];
}

export interface GeneratedImage {
  chapterNumber: number;
  sceneNumber: number;
  filename: string;
  url: string;
  prompt: string;
  timestamp: Date;
}

export interface ProcessingStatistics {
  processingTime: number;
  apiCalls: number;
  estimatedCost: number;
  imagesGenerated: number;
  chaptersProcessed: number;
}

export interface ActivityLog {
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

// Re-export pipeline config types
export type { ProcessingOptions, ModelProvider, ModelOption, PipelinePhase } from '../lib/pipeline-config';
export { DEFAULT_OPTIONS, MODEL_PROVIDERS, PIPELINE_PHASES, IMAGE_SIZES } from '../lib/pipeline-config';
