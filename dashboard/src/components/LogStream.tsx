import { useEffect, useRef } from 'react';
import type { ProgressEvent } from '../types';

interface LogStreamProps {
  logs: ProgressEvent[];
}

export function LogStream({ logs }: LogStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    if (shouldAutoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      shouldAutoScrollRef.current = isAtBottom;
    }
  };

  const getLevelColor = (level: ProgressEvent['level']): string => {
    switch (level) {
      case 'success':
        return 'text-green-400';
      case 'warning':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-300';
    }
  };

  const getLevelIcon = (level: ProgressEvent['level']): string => {
    switch (level) {
      case 'success':
        return '✓';
      case 'warning':
        return '⚠';
      case 'error':
        return '✗';
      default:
        return '•';
    }
  };

  return (
    <section className="bg-gray-800 rounded-lg shadow-lg flex flex-col h-96" aria-labelledby="log-heading">
      <header className="p-4 border-b border-gray-700">
        <h2 id="log-heading" className="text-xl font-bold text-white">Live Log</h2>
      </header>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-sm"
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Processing log messages"
        tabIndex={0}
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-8" role="status">Waiting for logs...</div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className={`flex gap-2 ${getLevelColor(log.level)}`}
              role="log"
              aria-label={`${log.level} message at ${new Date(log.timestamp).toLocaleTimeString()}`}
            >
              <span className="text-gray-500 select-none" aria-hidden="true">
                {getLevelIcon(log.level)}
              </span>
              <time className="text-gray-500 select-none min-w-[80px]" dateTime={new Date(log.timestamp).toISOString()}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </time>
              <span className="flex-1">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
