/**
 * Processing progress visualization component
 */

import type { ProcessingState, ActivityLog } from '../types';

interface ProcessingProgressProps {
  state: ProcessingState;
  activityLogs: ActivityLog[];
  onCancel?: () => void;
}

const PHASE_LABELS = {
  idle: 'Ready',
  parsing: 'Parsing',
  analyzing: 'Analyzing',
  extracting: 'Extracting',
  illustrating: 'Illustrating',
  complete: 'Complete',
  error: 'Error',
};

const PHASE_ICONS = {
  idle: '⏳',
  parsing: '📖',
  analyzing: '🔍',
  extracting: '📝',
  illustrating: '🎨',
  complete: '✅',
  error: '❌',
};

export function ProcessingProgress({ state, activityLogs, onCancel }: ProcessingProgressProps) {
  const { phase, progress, currentStep, estimatedTimeRemaining } = state;

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className="w-full space-y-6">
      {/* Progress Header */}
      <div className="text-center">
        <div className="text-5xl mb-2">{PHASE_ICONS[phase]}</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {PHASE_LABELS[phase]}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">{currentStep}</p>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>{progress}%</span>
          {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
            <span>~{formatTime(estimatedTimeRemaining)} remaining</span>
          )}
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Phase Steps */}
      <div className="flex justify-between items-center">
        {(['parsing', 'analyzing', 'illustrating', 'complete'] as const).map((p, idx) => {
          const isActive = p === phase;
          const isPast =
            (p === 'parsing' && ['analyzing', 'illustrating', 'complete'].includes(phase)) ||
            (p === 'analyzing' && ['illustrating', 'complete'].includes(phase)) ||
            (p === 'illustrating' && phase === 'complete');
          const isComplete = isPast || (p === 'complete' && phase === 'complete');

          return (
            <div key={p} className="flex flex-col items-center flex-1">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-lg
                  transition-colors duration-200
                  ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-blue-500 text-white animate-pulse'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                  }
                `}
              >
                {isComplete ? '✓' : PHASE_ICONS[p]}
              </div>
              <span
                className={`
                  mt-2 text-xs font-medium
                  ${isActive || isComplete ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}
                `}
              >
                {PHASE_LABELS[p]}
              </span>
              {idx < 3 && (
                <div
                  className={`
                    absolute w-full h-0.5 top-5 left-1/2
                    transition-colors duration-200
                    ${isComplete ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}
                  `}
                  style={{ width: 'calc(100% - 2.5rem)', marginLeft: '1.25rem' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Activity Log */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Recent Activity</h3>
        <div className="space-y-2">
          {activityLogs.slice(-10).reverse().map((log, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <span
                className={`
                  ${log.type === 'success' ? 'text-green-600 dark:text-green-400' : ''}
                  ${log.type === 'error' ? 'text-red-600 dark:text-red-400' : ''}
                  ${log.type === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : ''}
                  ${log.type === 'info' ? 'text-gray-600 dark:text-gray-400' : ''}
                `}
              >
                {log.type === 'success' && '✓'}
                {log.type === 'error' && '✗'}
                {log.type === 'warning' && '⚠'}
                {log.type === 'info' && '•'}
              </span>
              <span className="text-gray-700 dark:text-gray-300 flex-1">{log.message}</span>
              <span className="text-gray-400 text-xs">
                {log.timestamp.toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cancel Button */}
      {phase !== 'complete' && phase !== 'error' && phase !== 'idle' && onCancel && (
        <div className="flex justify-center">
          <button
            onClick={onCancel}
            className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
          >
            Cancel Processing
          </button>
        </div>
      )}
    </div>
  );
}
