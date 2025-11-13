import { memo, useMemo } from 'react';
import type { ProgressStats } from '../types';

interface OverallProgressProps {
  bookTitle: string;
  stats: ProgressStats;
  currentPhase: string;
}

// Helper function moved outside component to avoid recreation on each render
const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

// Memoized component to prevent unnecessary re-renders
export const OverallProgress = memo(function OverallProgress({ bookTitle, stats, currentPhase }: OverallProgressProps) {
  // Memoize progress calculation
  const progressPercent = useMemo(
    () => stats.totalChapters > 0
      ? Math.round((stats.completedChapters / stats.totalChapters) * 100)
      : 0,
    [stats.completedChapters, stats.totalChapters]
  );

  return (
    <section className="bg-gray-800 rounded-lg p-6 shadow-lg" aria-labelledby="book-title">
      <header className="mb-4">
        <h1 id="book-title" className="text-2xl font-bold text-white mb-1">{bookTitle}</h1>
        <p className="text-gray-400 text-sm uppercase tracking-wide">
          Phase: <span className="text-blue-400 font-semibold">{currentPhase}</span>
        </p>
      </header>

      <div className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-300" id="progress-label">Overall Progress</span>
            <span className="text-gray-300 font-semibold" aria-live="polite">{progressPercent}%</span>
          </div>
          <div
            className="w-full bg-gray-700 rounded-full h-3 overflow-hidden"
            role="progressbar"
            aria-labelledby="progress-label"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2" role="list" aria-label="Processing statistics">
          <div className="bg-gray-700 rounded p-3" role="listitem">
            <div className="text-gray-400 text-xs mb-1" id="chapters-label">Chapters</div>
            <div className="text-white text-xl font-bold" aria-labelledby="chapters-label" aria-live="polite">
              {stats.completedChapters}/{stats.totalChapters}
            </div>
          </div>

          <div className="bg-gray-700 rounded p-3" role="listitem">
            <div className="text-gray-400 text-xs mb-1" id="concepts-label">Concepts</div>
            <div className="text-white text-xl font-bold" aria-labelledby="concepts-label" aria-live="polite">
              {stats.totalConcepts}
            </div>
          </div>

          <div className="bg-gray-700 rounded p-3" role="listitem">
            <div className="text-gray-400 text-xs mb-1" id="elapsed-label">Elapsed</div>
            <div className="text-white text-xl font-bold" aria-labelledby="elapsed-label" aria-live="off">
              {formatTime(stats.elapsedMs)}
            </div>
          </div>

          <div className="bg-gray-700 rounded p-3" role="listitem">
            <div className="text-gray-400 text-xs mb-1" id="eta-label">ETA</div>
            <div className="text-white text-xl font-bold" aria-labelledby="eta-label" aria-live="polite">
              {stats.eta ? formatTime(stats.eta) : 'Calculating'}
            </div>
          </div>
        </div>

        {/* Images Generated (if any) */}
        {stats.imagesGenerated > 0 && (
          <div className="pt-2 border-t border-gray-700" role="status" aria-live="polite">
            <div className="text-gray-400 text-sm">
              Images Generated: <span className="text-green-400 font-semibold">{stats.imagesGenerated}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
});
