import { useEffect, useRef } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useToast } from './contexts/ToastContext';
import { OverallProgress } from './components/OverallProgress';
import { PipelineVisualization } from './components/PipelineVisualization';
import { ChapterGrid } from './components/ChapterGrid';
import { LogStream } from './components/LogStream';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  const wsUrl = `ws://${window.location.hostname}:${window.location.port || 3000}`;
  const { state, chapters, logs, isConnected, error } = useWebSocket(wsUrl);
  const { showToast } = useToast();
  const prevConnectedRef = useRef<boolean | null>(null);

  // Show toast notifications on connection status changes
  useEffect(() => {
    // Skip the initial connection (avoid "Connected" toast on first load)
    if (prevConnectedRef.current === null && isConnected) {
      prevConnectedRef.current = isConnected;
      return;
    }

    // Connection established (reconnected after disconnect)
    if (isConnected && prevConnectedRef.current === false) {
      showToast('Connected to dashboard', 'success', 3000);
    }

    // Connection lost
    if (!isConnected && prevConnectedRef.current === true) {
      showToast('Connection lost. Reconnecting...', 'warning', 5000);
    }

    prevConnectedRef.current = isConnected;
  }, [isConnected, showToast]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-900 border border-red-700 rounded-lg p-6 max-w-md">
          <h1 className="text-2xl font-bold text-white mb-2">Connection Error</h1>
          <p className="text-red-200">{error}</p>
          <p className="text-red-300 text-sm mt-4">
            Make sure the imaginize process is running with the --dashboard flag.
          </p>
        </div>
      </div>
    );
  }

  if (!isConnected || !state) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-300 text-lg">Connecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with connection status */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Imaginize Dashboard</h1>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}></div>
            <span className="text-gray-300 text-sm">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Overall Progress */}
        <ErrorBoundary fallback={
          <div className="bg-gray-800 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-400">Unable to load progress overview</p>
          </div>
        }>
          <OverallProgress
            bookTitle={state.bookTitle}
            stats={state.stats}
            currentPhase={state.currentPhase}
          />
        </ErrorBoundary>

        {/* Pipeline Visualization */}
        <ErrorBoundary fallback={
          <div className="bg-gray-800 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-400">Unable to load pipeline visualization</p>
          </div>
        }>
          <PipelineVisualization currentPhase={state.currentPhase} />
        </ErrorBoundary>

        {/* Chapters Grid */}
        <ErrorBoundary fallback={
          <div className="bg-gray-800 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-400">Unable to load chapter grid</p>
          </div>
        }>
          <ChapterGrid chapters={chapters} />
        </ErrorBoundary>

        {/* Log Stream */}
        <ErrorBoundary fallback={
          <div className="bg-gray-800 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-400">Unable to load log stream</p>
          </div>
        }>
          <LogStream logs={logs} />
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default App;
