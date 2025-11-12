# Real-Time Progress Dashboard - Architecture

## Overview

Web-based dashboard for monitoring imaginize processing in real-time. Shows live progress, ETA calculations, and concurrent pipeline visualization.

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Process                         │
│  ┌─────────────────┐       ┌──────────────────┐           │
│  │  Main Pipeline  │──────>│ Progress Tracker │           │
│  │  (Phases 1-5)   │       │  (Event Emitter) │           │
│  └─────────────────┘       └────────┬─────────┘           │
│                                      │                      │
│                                      v                      │
│                            ┌──────────────────┐            │
│                            │  Express Server  │            │
│                            │  (Port 3000)     │            │
│                            └────────┬─────────┘            │
│                                     │                       │
│                         ┌───────────┴───────────┐          │
│                         │                       │          │
│                    ┌────v─────┐         ┌──────v──────┐   │
│                    │ WebSocket│         │  Static     │   │
│                    │  Server  │         │  React App  │   │
│                    └────┬─────┘         └─────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          │ WebSocket Connection
                          │
                   ┌──────v────────┐
                   │   Browser     │
                   │ (Dashboard UI)│
                   └───────────────┘
```

## Components

### 1. Progress Event System

**Location:** `src/lib/progress-tracker.ts`

**Enhancement:** Add EventEmitter capabilities

```typescript
import { EventEmitter } from 'events';

export class ProgressTracker extends EventEmitter {
  async log(message: string, level: 'info' | 'success' | 'warning' | 'error') {
    // Existing file logging
    // ...

    // NEW: Emit event for dashboard
    this.emit('progress', {
      timestamp: new Date().toISOString(),
      message,
      level,
      phase: this.currentPhase,
      chapter: this.currentChapter,
    });
  }

  async updateStats(stats: ProgressStats) {
    // Existing stats tracking
    // ...

    // NEW: Emit stats update
    this.emit('stats', stats);
  }
}
```

**Events Emitted:**
- `progress` - Log messages with context
- `stats` - Overall progress statistics
- `chapter-start` - Chapter processing started
- `chapter-complete` - Chapter processing completed
- `phase-start` - Phase started
- `phase-complete` - Phase completed
- `image-start` - Image generation started
- `image-complete` - Image generation completed

### 2. Dashboard Server

**Location:** `src/lib/dashboard/server.ts`

**Responsibilities:**
- Serve React dashboard app (static files)
- WebSocket server for real-time updates
- REST API for initial state
- Progress event subscription

```typescript
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import type { ProgressTracker } from '../progress-tracker.js';

export interface DashboardServerOptions {
  port?: number;
  host?: string;
}

export class DashboardServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private progressTracker: ProgressTracker;

  constructor(progressTracker: ProgressTracker, options: DashboardServerOptions = {}) {
    this.progressTracker = progressTracker;
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupRoutes();
    this.setupWebSocket();
    this.subscribeToProgress();
  }

  private setupRoutes() {
    // Serve static React app
    this.app.use(express.static('dist/dashboard'));

    // API: Get current state
    this.app.get('/api/state', (req, res) => {
      res.json(this.progressTracker.getState());
    });

    // API: Get manifest
    this.app.get('/api/manifest', (req, res) => {
      // Load and return manifest.json
    });
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws) => {
      // Send initial state on connection
      ws.send(JSON.stringify({
        type: 'initial-state',
        data: this.progressTracker.getState(),
      }));
    });
  }

  private subscribeToProgress() {
    // Forward all progress events to connected clients
    this.progressTracker.on('progress', (data) => {
      this.broadcast({ type: 'progress', data });
    });

    this.progressTracker.on('stats', (data) => {
      this.broadcast({ type: 'stats', data });
    });

    // ... other events
  }

  private broadcast(message: any) {
    const payload = JSON.stringify(message);
    this.wss.clients.forEach(client => {
      if (client.readyState === 1) { // OPEN
        client.send(payload);
      }
    });
  }

  async start(port: number = 3000, host: string = 'localhost') {
    return new Promise<void>((resolve) => {
      this.server.listen(port, host, () => {
        console.log(`Dashboard: http://${host}:${port}`);
        resolve();
      });
    });
  }

  async stop() {
    this.wss.close();
    this.server.close();
  }
}
```

### 3. React Dashboard UI

**Location:** `dashboard/` (separate directory, built to `dist/dashboard/`)

**Technology Stack:**
- React 18 with TypeScript
- Vite for bundling
- Tailwind CSS for styling
- WebSocket client for real-time updates

**Components:**

```typescript
// dashboard/src/App.tsx
import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';

interface ProgressState {
  phase: string;
  chapter?: number;
  progress: number;
  eta?: number;
  logs: LogEntry[];
  stats: Stats;
  pipeline: PipelineState;
}

export default function App() {
  const { state, connected } = useWebSocket('ws://localhost:3000');

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header connected={connected} />

      <main className="container mx-auto p-6">
        <OverallProgress state={state} />
        <PipelineVisualization pipeline={state.pipeline} />
        <ChapterGrid chapters={state.chapters} />
        <LogStream logs={state.logs} />
        <StatsPanel stats={state.stats} />
      </main>
    </div>
  );
}
```

**Key UI Components:**

1. **OverallProgress** - Top-level progress bar with ETA
2. **PipelineVisualization** - Shows concurrent phases (Pass 1 → Pass 2 → Illustrate)
3. **ChapterGrid** - Grid of chapters with status indicators
4. **LogStream** - Real-time log messages
5. **StatsPanel** - Performance metrics, token usage, costs

### 4. CLI Integration

**Location:** `src/index.ts`

**New CLI Flags:**
```typescript
.option('--dashboard', 'Start web dashboard for real-time progress monitoring')
.option('--dashboard-port <port>', 'Dashboard server port (default: 3000)')
.option('--dashboard-host <host>', 'Dashboard server host (default: localhost)')
```

**Integration Logic:**
```typescript
async function main() {
  // ... existing setup

  const progressTracker = new ProgressTracker(outputDir, options.verbose);

  // NEW: Start dashboard if requested
  let dashboardServer: DashboardServer | null = null;
  if (options.dashboard) {
    dashboardServer = new DashboardServer(progressTracker, {
      port: options.dashboardPort || 3000,
      host: options.dashboardHost || 'localhost',
    });

    await dashboardServer.start();
    console.log(`\n📊 Dashboard started: http://localhost:${options.dashboardPort || 3000}\n`);
  }

  // ... execute phases

  // Cleanup
  if (dashboardServer) {
    await dashboardServer.stop();
  }
}
```

## Data Flow

### 1. Progress Events

```
Phase Execution
      ↓
ProgressTracker.log()
      ↓
EventEmitter.emit('progress', data)
      ↓
DashboardServer.subscribeToProgress()
      ↓
WebSocket.broadcast(data)
      ↓
React Dashboard receives update
      ↓
State updated, UI re-renders
```

### 2. Stats Updates

```
Phase completes chapter
      ↓
ProgressTracker.updateStats()
      ↓
Calculate: total chapters, completed, remaining, ETA
      ↓
EventEmitter.emit('stats', statsData)
      ↓
Broadcast to dashboard
      ↓
StatsPanel updates
```

## Implementation Plan

### Phase 1: Backend (Days 1-2)
1. Add EventEmitter to ProgressTracker
2. Create DashboardServer class
3. Implement WebSocket broadcasting
4. Add REST API endpoints
5. CLI flag integration

### Phase 2: Frontend (Days 2-3)
1. Setup Vite + React + TypeScript project
2. Create WebSocket hook
3. Build UI components:
   - OverallProgress
   - PipelineVisualization
   - ChapterGrid
   - LogStream
   - StatsPanel
4. Implement real-time state management

### Phase 3: Integration & Testing (Day 4)
1. Build dashboard → `dist/dashboard/`
2. Test with full book processing
3. Test concurrent pipeline visualization
4. Verify WebSocket reconnection
5. Test ETA accuracy

### Phase 4: Polish & Documentation (Day 5)
1. Error handling
2. Mobile responsiveness
3. Dark mode styling
4. Documentation updates
5. README with screenshots

## Dependencies

**New npm packages:**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.14.2"
  },
  "devDependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/ws": "^8.5.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.3.0"
  }
}
```

## Configuration

Add to `.imaginize.config`:
```yaml
# Dashboard options
dashboard:
  enabled: false  # Or use --dashboard flag
  port: 3000
  host: "localhost"
  autoOpen: true  # Auto-open browser
```

## ETA Calculation

```typescript
interface ETACalculator {
  totalChapters: number;
  completedChapters: number;
  startTime: number;

  calculate(): number {
    const elapsed = Date.now() - this.startTime;
    const avgTimePerChapter = elapsed / this.completedChapters;
    const remaining = this.totalChapters - this.completedChapters;
    return avgTimePerChapter * remaining;
  }

  format(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}
```

## Concurrent Pipeline Visualization

Show 3 parallel tracks:
```
Pass 1:  [====] 100% (10/10 chapters)
Pass 2:  [==-] 60% (6/10 chapters)
Illustrate: [=--] 30% (3/10 chapters)
```

With visual indicators:
- ✅ Complete
- 🔄 In Progress
- ⏳ Pending
- ❌ Error

## Security Considerations

1. **Local Only**: Dashboard binds to localhost by default
2. **No Authentication**: Not needed for local development tool
3. **CORS**: Disabled since same-origin
4. **WebSocket**: No sensitive data transmitted

## Future Enhancements

1. **Persistent History**: Save session history to SQLite
2. **Multiple Sessions**: Support monitoring multiple concurrent runs
3. **Export Reports**: Generate HTML/PDF reports
4. **Alerts**: Desktop notifications on completion
5. **API Mode**: Headless mode with JSON output for CI/CD

## File Structure

```
imaginize/
├── src/
│   ├── lib/
│   │   ├── progress-tracker.ts (enhanced with EventEmitter)
│   │   └── dashboard/
│   │       ├── server.ts
│   │       ├── eta-calculator.ts
│   │       └── types.ts
│   └── index.ts (CLI integration)
├── dashboard/ (React app source)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── OverallProgress.tsx
│   │   │   ├── PipelineVisualization.tsx
│   │   │   ├── ChapterGrid.tsx
│   │   │   ├── LogStream.tsx
│   │   │   └── StatsPanel.tsx
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts
│   │   └── types.ts
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── dist/
│   ├── lib/
│   └── dashboard/ (built React app)
└── docs/
    └── DASHBOARD_ARCHITECTURE.md (this file)
```

## Performance Impact

- **Memory**: +20-30MB for Express + WebSocket server
- **CPU**: Negligible (<1% overhead for event broadcasting)
- **Network**: Local WebSocket traffic only
- **Startup**: +100-200ms to start Express server

## Testing Strategy

1. **Unit Tests**: EventEmitter functionality in ProgressTracker
2. **Integration Tests**: WebSocket message flow
3. **Manual Tests**: Full book processing with dashboard open
4. **Concurrent Tests**: Verify pipeline visualization accuracy
5. **Stress Tests**: 50+ chapters, verify performance

---

**Status:** Architecture Complete - Ready for Implementation
**Estimated Effort:** 3-5 days
**Dependencies:** express, ws, react, vite, tailwindcss
**Breaking Changes:** None (dashboard is opt-in via --dashboard flag)
