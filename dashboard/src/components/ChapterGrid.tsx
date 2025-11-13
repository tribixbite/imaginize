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

  const getStatusLabel = (status: ChapterInfo['status']): string => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in-progress':
        return 'In Progress';
      case 'error':
        return 'Error';
      default:
        return 'Pending';
    }
  };

  return (
    <section className="bg-gray-800 rounded-lg p-6 shadow-lg" aria-labelledby="chapters-heading">
      <h2 id="chapters-heading" className="text-xl font-bold text-white mb-4">
        Chapters
      </h2>
      <div
        className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2"
        role="grid"
        aria-label="Chapter status grid"
      >
        {chaptersArray.map((chapter) => (
          <div
            key={chapter.number}
            role="gridcell"
            className={`relative rounded border-2 p-2 text-center transition-all ${getStatusColor(
              chapter.status
            )}`}
            aria-label={`Chapter ${chapter.number}: ${chapter.title}, status ${getStatusLabel(
              chapter.status
            )}${chapter.concepts ? `, ${chapter.concepts} concepts` : ''}`}
            tabIndex={0}
          >
            <div className="text-white font-semibold text-sm" aria-hidden="true">
              {chapter.number}
            </div>
            {chapter.concepts !== undefined && (
              <div className="text-xs text-gray-300 mt-1" aria-hidden="true">
                {chapter.concepts}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-sm" role="list" aria-label="Chapter status legend">
        <div className="flex items-center gap-2" role="listitem">
          <div
            className="w-4 h-4 bg-gray-700 border-2 border-gray-600 rounded"
            role="img"
            aria-label="Pending status color"
          ></div>
          <span className="text-gray-300">Pending</span>
        </div>
        <div className="flex items-center gap-2" role="listitem">
          <div
            className="w-4 h-4 bg-blue-600 border-2 border-blue-500 rounded"
            role="img"
            aria-label="In Progress status color"
          ></div>
          <span className="text-gray-300">In Progress</span>
        </div>
        <div className="flex items-center gap-2" role="listitem">
          <div
            className="w-4 h-4 bg-green-600 border-2 border-green-500 rounded"
            role="img"
            aria-label="Completed status color"
          ></div>
          <span className="text-gray-300">Completed</span>
        </div>
      </div>
    </section>
  );
}
