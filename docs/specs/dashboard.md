# Dashboard System Specification

## Overview

The imaginize dashboard provides real-time monitoring of book processing through a React-based web interface. It uses WebSocket for live updates and displays overall progress, pipeline status, chapter grid, and streaming logs.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              React Dashboard UI                        │ │
│  │  ┌──────────┐ ┌──────────┐ ┌───────┐ ┌────────────┐  │ │
│  │  │ Overall  │ │ Pipeline │ │Chapter│ │ Log Stream │  │ │
│  │  │ Progress │ │   Viz    │ │ Grid  │ │            │  │ │
│  │  └──────────┘ └──────────┘ └───────┘ └────────────┘  │ │
│  │                                                        │ │
│  │  useWebSocket Hook (Reconnection, State Management)   │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│                            │ WebSocket (ws://)               │
│                            ▼                                 │
└─────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────────────────────────────────────────┐
│                    Node.js Server (Backend)                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                  Dashboard Server                        │ │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────────┐ │ │
│  │  │  Express   │  │  WebSocket  │  │ Progress Tracker │ │ │
│  │  │  HTTP API  │  │   Server    │  │  Event Emitter   │ │ │
│  │  │            │  │             │  │                  │ │ │
│  │  │ /api/state │  │ Broadcast   │  │ 7 Event Types    │ │ │
│  │  │ /api/health│  │ to clients  │  │                  │ │ │
│  │  └────────────┘  └─────────────┘  └──────────────────┘ │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

## Backend Components

### 1. Dashboard Server (`src/lib/dashboard-server.ts`)

**Purpose**: HTTP + WebSocket server for real-time updates

**Initialization**:
```typescript
const dashboardServer = new DashboardServer(
  progressTracker,
  config.dashboardPort || 3000,
  config.dashboardHost || 'localhost'
);

await dashboardServer.start();
```

**API Endpoints**:

#### `GET /api/state`
Returns current processing state
```typescript
{
  bookTitle: string;
  currentPhase: string;
  currentChapter?: number;
  stats: ProgressStats;
  startTime: number;
}
```

#### `GET /api/health`
Health check endpoint
```typescript
{
  status: 'ok',
  uptime: number,
  clients: number
}
```

**WebSocket Server**:
- Path: `ws://localhost:3000`
- Protocol: Native WebSocket (ws)
- Auto-reconnect: Client-side with exponential backoff

### 2. Progress Tracker Integration

**Event Emitter** (`src/lib/progress-tracker.ts`):
```typescript
class ProgressTracker extends EventEmitter {
  // Emit events for dashboard
  emit('initialized', data);
  emit('progress', data);
  emit('chapter-start', data);
  emit('chapter-complete', data);
  emit('phase-start', data);
  emit('stats', data);
  emit('image-complete', data);
}
```

**Event Subscription**:
```typescript
// Dashboard server subscribes to all events
progressTracker.on('initialized', (data) => {
  wss.broadcast('initial-state', data);
});

progressTracker.on('progress', (data) => {
  wss.broadcast('progress', data);
});

// ... 7 event types total
```

## Event Types

### 1. `initial-state`
Sent on new WebSocket connection
```typescript
{
  type: 'initial-state',
  data: {
    bookTitle: 'Impossible Creatures',
    currentPhase: 'analyze',
    currentChapter: 15,
    stats: {
      totalChapters: 83,
      completedChapters: 14,
      percent: 16.9,
      eta: 3600000  // milliseconds
    },
    startTime: 1699876543210
  }
}
```

### 2. `progress`
General progress update
```typescript
{
  type: 'progress',
  data: {
    message: '✓ Chapter 15 analyzed',
    level: 'success',  // info | success | warning | error
    timestamp: '2025-11-13T10:30:00.000Z',
    phase: 'analyze',
    chapter: 15
  }
}
```

### 3. `chapter-start`
Chapter processing started
```typescript
{
  type: 'chapter-start',
  data: {
    phase: 'analyze',
    chapter: 16,
    title: 'The Reveal',
    timestamp: '2025-11-13T10:30:05.000Z'
  }
}
```

### 4. `chapter-complete`
Chapter processing completed
```typescript
{
  type: 'chapter-complete',
  data: {
    phase: 'analyze',
    chapter: 16,
    title: 'The Reveal',
    tokensUsed: 2450,
    timestamp: '2025-11-13T10:31:00.000Z'
  }
}
```

### 5. `phase-start`
New phase started
```typescript
{
  type: 'phase-start',
  data: {
    phase: 'illustrate',
    timestamp: '2025-11-13T11:00:00.000Z'
  }
}
```

### 6. `stats`
Statistics update (ETA, progress %)
```typescript
{
  type: 'stats',
  data: {
    totalChapters: 83,
    completedChapters: 16,
    percent: 19.3,
    eta: 3420000,  // 57 minutes
    tokensUsed: 45230,
    estimatedCost: 0.023
  }
}
```

### 7. `image-complete`
Image generation completed
```typescript
{
  type: 'image-complete',
  data: {
    chapter: 16,
    scene: 2,
    filename: 'chapter_16_the_reveal_scene_2.png',
    timestamp: '2025-11-13T11:05:00.000Z'
  }
}
```

## Frontend Components

### Technology Stack
- **Framework**: React 18
- **Language**: TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS v4
- **WebSocket**: Native WebSocket API

### Project Structure
```
dashboard/
├── src/
│   ├── components/
│   │   ├── OverallProgress.tsx      # Progress bar + ETA
│   │   ├── PipelineVisualization.tsx # Phase timeline
│   │   ├── ChapterGrid.tsx          # Chapter status grid
│   │   ├── LogStream.tsx            # Real-time logs
│   │   └── ErrorBoundary.tsx        # Error handling
│   ├── hooks/
│   │   └── useWebSocket.ts          # WebSocket hook
│   ├── types/
│   │   └── dashboard.ts             # TypeScript types
│   ├── App.tsx                      # Main app component
│   └── main.tsx                     # Entry point
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

### 1. OverallProgress Component

**Purpose**: Display overall progress, ETA, and statistics

```typescript
interface ProgressStats {
  totalChapters: number;
  completedChapters: number;
  percent?: number;
  eta?: number;
  tokensUsed?: number;
  estimatedCost?: number;
}

function OverallProgress({ stats }: { stats: ProgressStats }) {
  const progress = stats.percent ||
    (stats.completedChapters / stats.totalChapters) * 100;

  const eta = stats.eta ? formatDuration(stats.eta) : 'Calculating...';

  return (
    <div className="progress-container">
      <div className="progress-bar" style={{ width: `${progress}%` }} />
      <div className="stats">
        <span>{stats.completedChapters} / {stats.totalChapters} chapters</span>
        <span>ETA: {eta}</span>
        {stats.tokensUsed && <span>{stats.tokensUsed.toLocaleString()} tokens</span>}
      </div>
    </div>
  );
}
```

### 2. PipelineVisualization Component

**Purpose**: Show current phase in processing pipeline

```typescript
const PHASES = [
  { id: 'parse', label: 'Parse', icon: '📖' },
  { id: 'analyze', label: 'Analyze', icon: '🔍' },
  { id: 'extract', label: 'Extract', icon: '📋' },
  { id: 'illustrate', label: 'Illustrate', icon: '🎨' }
];

function PipelineVisualization({ currentPhase }: { currentPhase: string }) {
  const currentIndex = PHASES.findIndex(p => p.id === currentPhase);

  return (
    <ol className="pipeline" role="list" aria-label="Processing pipeline">
      {PHASES.map((phase, index) => (
        <li
          key={phase.id}
          className={index <= currentIndex ? 'completed' : 'pending'}
          aria-current={index === currentIndex ? 'step' : undefined}
        >
          <span className="icon">{phase.icon}</span>
          <span className="label">{phase.label}</span>
        </li>
      ))}
    </ol>
  );
}
```

### 3. ChapterGrid Component

**Purpose**: Grid view of all chapters with status indicators

```typescript
type ChapterStatus = 'pending' | 'in-progress' | 'completed' | 'error';

interface ChapterState {
  number: number;
  title: string;
  status: ChapterStatus;
}

function ChapterGrid({ chapters }: { chapters: ChapterState[] }) {
  return (
    <div className="chapter-grid" role="grid" aria-label="Chapter status">
      {chapters.map((chapter) => (
        <div
          key={chapter.number}
          className={`chapter-cell status-${chapter.status}`}
          role="gridcell"
          aria-label={`Chapter ${chapter.number}: ${chapter.status}`}
        >
          <span className="number">{chapter.number}</span>
          <span className="title">{chapter.title}</span>
          <span className="status-icon">
            {getStatusIcon(chapter.status)}
          </span>
        </div>
      ))}

      {/* Legend */}
      <div className="legend">
        <span>⏳ Pending</span>
        <span>🔄 In Progress</span>
        <span>✓ Completed</span>
        <span>❌ Error</span>
      </div>
    </div>
  );
}
```

### 4. LogStream Component

**Purpose**: Real-time scrolling log display

```typescript
interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

function LogStream({ logs }: { logs: LogEntry[] }) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  return (
    <div
      className="log-stream"
      role="log"
      aria-live="polite"
      aria-atomic="false"
    >
      {logs.map((log, index) => (
        <div
          key={`${log.timestamp}-${index}`}
          className={`log-entry level-${log.level}`}
        >
          <time dateTime={log.timestamp}>
            {formatTime(log.timestamp)}
          </time>
          <span className="message">{log.message}</span>
        </div>
      ))}
      <div ref={logEndRef} />
    </div>
  );
}
```

### 5. useWebSocket Hook

**Purpose**: WebSocket connection with auto-reconnect

```typescript
function useWebSocket(url: string) {
  const [connected, setConnected] = useState(false);
  const [data, setData] = useState<DashboardState>(initialState);
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);

  const connect = useCallback(() => {
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setConnected(true);
      reconnectAttempt.current = 0;
    };

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message, setData);
    };

    ws.current.onclose = () => {
      setConnected(false);

      // Exponential backoff reconnect
      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000);
      reconnectAttempt.current++;

      setTimeout(() => {
        if (reconnectAttempt.current <= 10) {
          connect();
        }
      }, delay);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => ws.current?.close();
  }, [connect]);

  return { connected, data };
}
```

## Styling (Tailwind CSS v4)

### Theme Configuration
```javascript
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        background: '#111827',  // Dark gray
        surface: '#1f2937',     // Slightly lighter
        primary: '#3b82f6',     // Blue
        success: '#10b981',     // Green
        warning: '#f59e0b',     // Amber
        error: '#ef4444',       // Red
      }
    }
  }
}
```

### Dark Mode Design
- Background: `#111827` (dark gray-900)
- Text: `#f9fafb` (gray-50)
- Borders: `#374151` (gray-700)
- Accent: `#3b82f6` (blue-500)

### Responsive Grid
```css
.chapter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.5rem;
}

@media (min-width: 640px) {
  .chapter-grid {
    grid-template-columns: repeat(8, 1fr);
  }
}

@media (min-width: 1024px) {
  .chapter-grid {
    grid-template-columns: repeat(10, 1fr);
  }
}
```

## Accessibility (WCAG 2.1 Level AA)

### Semantic HTML
```typescript
<section aria-label="Overall progress">
  <h2>Progress</h2>
  <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
    {progress}%
  </div>
</section>
```

### ARIA Live Regions
```typescript
<div
  role="log"
  aria-live="polite"
  aria-atomic="false"
  aria-label="Processing logs"
>
  {logs.map(...)}
</div>
```

### Keyboard Navigation
```typescript
<button
  onClick={toggleAutoScroll}
  aria-pressed={autoScroll}
  tabIndex={0}
>
  {autoScroll ? 'Disable' : 'Enable'} Auto-scroll
</button>
```

## Performance Optimizations

### React Memoization
```typescript
export default React.memo(OverallProgress);

// Memoize expensive computations
const sortedChapters = useMemo(() => {
  return Object.values(chapters).sort((a, b) => a.number - b.number);
}, [chapters]);
```

### Log Buffer Limit
```typescript
// Prevent memory leak with large log streams
const MAX_LOGS = 1000;

setLogs((prev) => {
  const updated = [...prev, newLog];
  return updated.slice(-MAX_LOGS);  // Keep only last 1000
});
```

### Connection Status Toast
```typescript
// Show connection status changes
useEffect(() => {
  if (connected) {
    showToast('Connected to dashboard', 'success');
  } else {
    showToast('Connection lost. Reconnecting...', 'warning');
  }
}, [connected]);
```

## Build & Deployment

### Development
```bash
cd dashboard
npm install
npm run dev
# Opens: http://localhost:5173
```

### Production Build
```bash
cd dashboard
npm run build
# Output: dashboard/dist/

# Bundle size:
# - JS: 203.84 kB (63.53 kB gzipped)
# - CSS: 15.98 kB (4.02 kB gzipped)
```

### Integration with CLI
```bash
# CLI builds dashboard automatically
npm run build  # Builds both CLI and dashboard

# Dashboard served from: dashboard/dist/
# Accessed via: http://localhost:3000
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Requirements**:
- WebSocket support
- ES2020 JavaScript
- CSS Grid

## Usage

### Start Dashboard
```bash
imaginize --text --dashboard --file book.epub
# Dashboard: http://localhost:3000
```

### Custom Port
```bash
imaginize --text --dashboard --dashboard-port 8080 --file book.epub
# Dashboard: http://localhost:8080
```

### Network Access
```bash
imaginize --text --dashboard --dashboard-host 0.0.0.0 --file book.epub
# Dashboard: http://<your-ip>:3000
# Warning: No authentication, use with caution
```

---

**See Also:**
- [CLI Interface](./cli-interface.md)
- [Pipeline Architecture](./pipeline-architecture.md)
- [State Management](./state-management.md)
