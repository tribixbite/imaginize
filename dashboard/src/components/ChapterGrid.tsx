import type { ChapterInfo } from '../types';

interface ChapterGridProps {
  chapters: Map<number, ChapterInfo>;
}

export function ChapterGrid({ chapters }: ChapterGridProps) {
  const getStatusColor = (status: ChapterInfo['status']): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-600 border-green-500';
      case 'in-progress':
        return 'bg-blue-600 border-blue-500 animate-pulse';
      case 'error':
        return 'bg-red-600 border-red-500';
      default:
        return 'bg-gray-700 border-gray-600';
    }
  };

  const chaptersArray = Array.from(chapters.values()).sort((a, b) => a.number - b.number);

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-bold text-white mb-4">Chapters</h2>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
        {chaptersArray.map((chapter) => (
          <div
            key={chapter.number}
            className={`relative rounded border-2 p-2 text-center transition-all ${getStatusColor(
              chapter.status
            )}`}
            title={`${chapter.title} - ${chapter.status}${
              chapter.concepts ? ` (${chapter.concepts} concepts)` : ''
            }`}
          >
            <div className="text-white font-semibold text-sm">{chapter.number}</div>
            {chapter.concepts !== undefined && (
              <div className="text-xs text-gray-300 mt-1">{chapter.concepts}</div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-700 border-2 border-gray-600 rounded"></div>
          <span className="text-gray-300">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-600 border-2 border-blue-500 rounded"></div>
          <span className="text-gray-300">In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-600 border-2 border-green-500 rounded"></div>
          <span className="text-gray-300">Completed</span>
        </div>
      </div>
    </div>
  );
}
