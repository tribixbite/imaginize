/**
 * Type definitions for dashboard server
 */

import type { ProgressEvent, ProgressStats } from '../progress-tracker.js';

/**
 * Dashboard server configuration options
 */
export interface DashboardServerOptions {
  port?: number;
  host?: string;
}

/**
 * WebSocket message types
 */
export type WebSocketMessageType =
  | 'initial-state'
  | 'progress'
  | 'stats'
  | 'chapter-start'
  | 'chapter-complete'
  | 'phase-start'
  | 'phase-complete'
  | 'image-start'
  | 'image-complete'
  | 'error';

/**
 * WebSocket message structure
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
}

/**
 * Dashboard state for initial connection
 */
export interface DashboardState {
  bookTitle: string;
  currentPhase: string;
  currentChapter?: number;
  stats: ProgressStats;
  startTime: number;
}

/**
 * Chapter start event data
 */
export interface ChapterStartEvent {
  chapterNum: number;
  chapterTitle: string;
}

/**
 * Chapter complete event data
 */
export interface ChapterCompleteEvent {
  chapterNum: number;
  chapterTitle: string;
  conceptsFound: number;
}

/**
 * Phase start event data
 */
export interface PhaseStartEvent {
  phase: string;
}

/**
 * Image complete event data
 */
export interface ImageCompleteEvent {
  elementName: string;
}

/**
 * Initialization event data
 */
export interface InitializedEvent {
  bookTitle: string;
  totalChapters: number;
  startTime: number;
}
