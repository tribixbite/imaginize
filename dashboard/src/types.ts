export interface ProgressStats {
  totalChapters: number;
  completedChapters: number;
  totalConcepts: number;
  totalElements: number;
  imagesGenerated: number;
  elapsedMs: number;
  eta?: number;
}

export interface DashboardState {
  bookTitle: string;
  currentPhase: string;
  currentChapter?: number;
  stats: ProgressStats;
  startTime: number;
}

export interface ProgressEvent {
  timestamp: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  phase?: string;
  chapter?: number;
}

export interface ChapterStartEvent {
  chapterNum: number;
  chapterTitle: string;
}

export interface ChapterCompleteEvent {
  chapterNum: number;
  chapterTitle: string;
  conceptsFound: number;
}

export interface PhaseStartEvent {
  phase: string;
}

export interface ImageCompleteEvent {
  elementName: string;
  success: boolean;
  url?: string;
}

export type WebSocketMessageType =
  | 'initial-state'
  | 'progress'
  | 'stats'
  | 'chapter-start'
  | 'chapter-complete'
  | 'phase-start'
  | 'image-complete';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
}

export interface ChapterInfo {
  number: number;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  concepts?: number;
}
