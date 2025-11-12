
interface PipelineVisualizationProps {
  currentPhase: string;
}

const phases = [
  { id: 'initializing', label: 'Initialize', icon: '⚙️' },
  { id: 'analyze', label: 'Analyze', icon: '📝' },
  { id: 'extract', label: 'Extract', icon: '🔍' },
  { id: 'illustrate', label: 'Illustrate', icon: '🎨' },
  { id: 'complete', label: 'Complete', icon: '✨' },
];

export function PipelineVisualization({ currentPhase }: PipelineVisualizationProps) {
  const currentIndex = phases.findIndex((p) => p.id === currentPhase);

  const getPhaseStatus = (index: number): 'completed' | 'active' | 'pending' => {
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'active';
    return 'pending';
  };

  const getPhaseColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-600 border-green-500 text-white';
      case 'active':
        return 'bg-blue-600 border-blue-500 text-white animate-pulse';
      default:
        return 'bg-gray-700 border-gray-600 text-gray-400';
    }
  };

  const getConnectorColor = (index: number): string => {
    return index < currentIndex ? 'bg-green-500' : 'bg-gray-600';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-bold text-white mb-6">Pipeline</h2>
      <div className="flex items-center justify-between">
        {phases.map((phase, index) => {
          const status = getPhaseStatus(index);
          return (
            <div key={phase.id} className="contents">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-16 h-16 rounded-full border-4 flex items-center justify-center text-2xl transition-all ${getPhaseColor(
                    status
                  )}`}
                >
                  {phase.icon}
                </div>
                <div className="mt-2 text-sm font-semibold text-gray-300">
                  {phase.label}
                </div>
              </div>
              {index < phases.length - 1 && (
                <div className="flex-1 h-1 mx-2 relative top-[-20px]">
                  <div
                    className={`h-full transition-all duration-500 ${getConnectorColor(
                      index
                    )}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
