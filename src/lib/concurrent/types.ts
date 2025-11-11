/**
 * Concurrent processing type definitions
 */

/**
 * Chapter status in state machine
 */
export type ChapterStatus =
  | 'pending'
  | 'analyzed'
  | 'illustration_inprogress'
  | 'illustration_complete'
  | 'error';

/**
 * Elements.md generation status
 */
export type ElementsStatus =
  | 'pending'
  | 'inprogress'
  | 'complete'
  | 'error';

/**
 * Chapter state in manifest
 */
export interface ChapterState {
  status: ChapterStatus;
  analyzed_at?: string;
  illustrated_at?: string;
  concepts?: number;
  error?: string;
}

/**
 * Manifest schema for concurrent processing
 * Version 3.0.0 - supports split-state architecture
 */
export interface ConcurrentManifest {
  version: string;
  book_id: string;
  elements_md_status: ElementsStatus;
  analyze_complete: boolean;
  illustrate_complete: boolean;
  chapters: Record<string, ChapterState>;
  last_updated: string;
}

/**
 * Updater function for manifest modifications
 */
export type ManifestUpdater = (manifest: ConcurrentManifest) => void | Promise<void>;
