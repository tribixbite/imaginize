import { useEffect, useState, useCallback, useRef } from 'react';
import type { DashboardState, WebSocketMessage, ProgressEvent, ChapterInfo } from '../types';

// Maximum number of logs to keep in memory (prevents memory leaks in long-running sessions)
const MAX_LOGS = 1000;

interface UseWebSocketReturn {
  state: DashboardState | null;
  chapters: Map<number, ChapterInfo>;
  logs: ProgressEvent[];
  isConnected: boolean;
  error: string | null;
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const [state, setState] = useState<DashboardState | null>(null);
  const [chapters, setChapters] = useState<Map<number, ChapterInfo>>(new Map());
  const [logs, setLogs] = useState<ProgressEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const reconnectDelay = 2000;

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Dashboard] WebSocket connected');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'initial-state':
              setState(message.data);
              // Initialize chapters from state
              const initialChapters = new Map<number, ChapterInfo>();
              for (let i = 1; i <= message.data.stats.totalChapters; i++) {
                initialChapters.set(i, {
                  number: i,
                  title: `Chapter ${i}`,
                  status: 'pending',
                });
              }
              setChapters(initialChapters);
              break;

            case 'stats':
              setState((prev) =>
                prev ? { ...prev, stats: message.data } : null
              );
              break;

            case 'progress':
              // Add new log and keep only last MAX_LOGS entries (circular buffer)
              setLogs((prev) => [...prev, message.data].slice(-MAX_LOGS));
              break;

            case 'chapter-start':
              setChapters((prev) => {
                const newMap = new Map(prev);
                const chapter = newMap.get(message.data.chapterNum);
                if (chapter) {
                  newMap.set(message.data.chapterNum, {
                    ...chapter,
                    title: message.data.chapterTitle,
                    status: 'in-progress',
                  });
                }
                return newMap;
              });
              setState((prev) =>
                prev
                  ? {
                      ...prev,
                      currentChapter: message.data.chapterNum,
                    }
                  : null
              );
              break;

            case 'chapter-complete':
              setChapters((prev) => {
                const newMap = new Map(prev);
                const chapter = newMap.get(message.data.chapterNum);
                if (chapter) {
                  newMap.set(message.data.chapterNum, {
                    ...chapter,
                    status: 'completed',
                    concepts: message.data.conceptsFound,
                  });
                }
                return newMap;
              });
              break;

            case 'phase-start':
              setState((prev) =>
                prev ? { ...prev, currentPhase: message.data.phase } : null
              );
              break;

            case 'image-complete':
              // Handle image completion if needed
              break;

            default:
              console.warn('[Dashboard] Unknown message type:', message.type);
          }
        } catch (err) {
          console.error('[Dashboard] Error parsing message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[Dashboard] WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('[Dashboard] WebSocket closed');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(
            `[Dashboard] Reconnecting (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`
          );
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, reconnectDelay);
        } else {
          setError('Failed to connect after multiple attempts');
        }
      };
    } catch (err) {
      console.error('[Dashboard] Error creating WebSocket:', err);
      setError('Failed to create WebSocket connection');
    }
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    state,
    chapters,
    logs,
    isConnected,
    error,
  };
}
