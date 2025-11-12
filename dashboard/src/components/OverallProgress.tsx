import type { ProgressStats } from '../types';

interface OverallProgressProps {
  bookTitle: string;
  stats: ProgressStats;
  currentPhase: string;
}

export function OverallProgress({ bookTitle, stats, currentPhase }: OverallProgressProps) {
  const progressPercent = stats.totalChapters > 0 
    ? Math.round((stats.completedChapters / stats.totalChapters) * 100) 
    : 0;

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

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white mb-1">{bookTitle}</h1>
        <p className="text-gray-400 text-sm uppercase tracking-wide">
          Phase: <span className="text-blue-400 font-semibold">{currentPhase}</span>
        </p>
      </div>

      <div className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-300">Overall Progress</span>
            <span className="text-gray-300 font-semibold">{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="bg-gray-700 rounded p-3">
            <div className="text-gray-400 text-xs mb-1">Chapters</div>
            <div className="text-white text-xl font-bold">
              {stats.completedChapters}/{stats.totalChapters}
            </div>
          </div>
          
          <div className="bg-gray-700 rounded p-3">
            <div className="text-gray-400 text-xs mb-1">Concepts</div>
            <div className="text-white text-xl font-bold">{stats.totalConcepts}</div>
          </div>
          
          <div className="bg-gray-700 rounded p-3">
            <div className="text-gray-400 text-xs mb-1">Elapsed</div>
            <div className="text-white text-xl font-bold">
              {formatTime(stats.elapsedMs)}
            </div>
          </div>
          
          <div className="bg-gray-700 rounded p-3">
            <div className="text-gray-400 text-xs mb-1">ETA</div>
            <div className="text-white text-xl font-bold">
              {stats.eta ? formatTime(stats.eta) : '--'}
            </div>
          </div>
        </div>

        {/* Images Generated (if any) */}
        {stats.imagesGenerated > 0 && (
          <div className="pt-2 border-t border-gray-700">
            <div className="text-gray-400 text-sm">
              Images Generated: <span className="text-green-400 font-semibold">{stats.imagesGenerated}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
