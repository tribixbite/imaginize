# System Architecture

## Overview

imaginize is a CLI tool that processes EPUB and PDF files to generate visual scene descriptions and story element catalogs using AI. The architecture follows a phase-based pipeline with state management for resume/continue functionality.

## High-Level Architecture

```
┌─────────────────┐
│   CLI Layer     │ - Commander.js interface
│  (src/index.ts) │ - Argument parsing & validation
└────────┬────────┘
         │
         ├──────────────────────────┬─────────────────────────┐
         │                          │                         │
┌────────▼────────┐      ┌─────────▼────────┐    ┌──────────▼─────────┐
│ Configuration   │      │ State Manager    │    │ Progress Tracker   │
│   (config.ts)   │      │ (state-manager)  │    │ (progress-tracker) │
└─────────────────┘      └──────────────────┘    └────────────────────┘
         │                          │                         │
         │                          │                         │
┌────────▼────────────────────────────────────────────────────▼────────┐
│                          Processing Pipeline                          │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐ │
│  │  Parse   │  →   │ Analyze  │  →   │ Extract  │  →   │Illustrate│ │
│  │ (epub/pdf)│     │ (Pass1/2)│      │(elements)│      │ (images) │ │
│  └──────────┘      └──────────┘      └──────────┘      └──────────┘ │
└───────────────────────────────────────────────────────────────────────┘
         │                          │                         │
         ├──────────────────────────┼─────────────────────────┤
         │                          │                         │
┌────────▼────────┐      ┌─────────▼────────┐    ┌──────────▼─────────┐
│   AI Services   │      │  File System     │    │   Dashboard API    │
│  (OpenAI SDK)   │      │  (Atomic Write)  │    │   (WebSocket)      │
└─────────────────┘      └──────────────────┘    └────────────────────┘
```

## Core Components

### 1. CLI Layer (`src/index.ts`)
- Entry point for all commands
- Argument parsing with Commander.js
- File selection and validation
- Phase orchestration
- Error handling and reporting

**Key Responsibilities:**
- Parse command-line arguments
- Load configuration
- Initialize state manager
- Route to appropriate phase
- Handle --continue and --force flags

### 2. Configuration System (`src/lib/config.ts`)
- Cosmiconfig-based configuration loading
- Environment variable override
- Provider detection (OpenAI, OpenRouter)
- Multi-endpoint support (text + image)
- Default model selection

**Configuration Sources (priority order):**
1. CLI arguments
2. Project `.imaginize.config`
3. Home directory `.imaginize.config`
4. Environment variables
5. Defaults

### 3. State Management (`src/lib/state-manager.ts`)
- Persistent state in `.imaginize.state.json`
- Phase-level progress tracking
- Chapter-level status tracking
- Resume/continue functionality
- State version management

**State Structure:**
```typescript
{
  version: "2.0.0",
  bookFile: string,
  bookTitle: string,
  totalPages: number,
  phases: {
    analyze: PhaseState,
    extract: PhaseState,
    illustrate: PhaseState
  },
  createdAt: string,
  lastUpdated: string
}
```

### 4. Progress Tracking (`src/lib/progress-tracker.ts`)
- Real-time progress.md logging
- Event emission for dashboard
- Statistics tracking (ETA, completion %)
- Thread-safe append operations
- Emoji-based log levels

**Event Types:**
- initialized, progress, chapter-start, chapter-complete
- phase-start, stats, image-complete

### 5. Processing Phases

#### Phase 1: Parse (`src/lib/epub-parser.ts`, `src/lib/pdf-parser.ts`)
- Extract book metadata
- Parse chapter structure
- Detect content sections
- Filter front matter
- Estimate page counts

#### Phase 2: Analyze (`src/lib/phases/analyze-phase-v2.ts`)
- **Pass 1**: Fast entity extraction (all chapters)
- **Pass 2**: Full analysis with entity enrichment (per chapter)
- Generate visual scene descriptions
- Extract mood and lighting
- Cross-reference characters

#### Phase 3: Extract (`src/lib/phases/extract-phase.ts`)
- Extract story elements from entities
- Deduplicate and merge descriptions
- Generate Elements.md catalog
- Track character appearances

#### Phase 4: Illustrate (`src/lib/phases/illustrate-phase-v2.ts`)
- Generate image prompts from scenes
- Apply style guide consistency
- Include character descriptions
- Batch process images
- Save to PNG files

### 6. AI Integration (`src/lib/ai-analyzer.ts`)
- OpenAI SDK wrapper
- Multi-provider support (OpenAI, OpenRouter, custom)
- Retry logic with exponential backoff
- Rate limit handling (65s wait for free tier)
- Token counting and estimation

### 7. Dashboard System
**Backend** (`src/lib/dashboard-server.ts`):
- Express HTTP server
- WebSocket server for real-time updates
- REST API endpoints (`/api/state`, `/api/health`)
- Event subscription from ProgressTracker

**Frontend** (`dashboard/`):
- React 18 + TypeScript + Vite
- Tailwind CSS v4 dark theme
- Real-time WebSocket updates
- 5 UI components (Progress, Pipeline, ChapterGrid, LogStream, App)

## Data Flow

### Sequential Processing (Default)
```
CLI → Parse EPUB → Analyze All → Extract Elements → Illustrate All → Done
      ↓           ↓              ↓                  ↓
   Book Data  Chapters.md    Elements.md        PNG Images
```

### Concurrent Processing (`--concurrent` flag)
```
CLI → Parse → Analyze Pass1 (all) → Generate Elements.md
                    ↓                       ↓
            Analyze Pass2 (per chapter) ← Elements Lookup
                    ↓                       ↓
            Update Manifest (analyzed)  Illustrate Worker (polls)
                    ↓                       ↓
            Next Chapter...           Claim → Generate → Complete
```

## File System Structure

### Input
```
project/
├── book.epub                  # Source book
└── .imaginize.config          # Optional configuration
```

### Output
```
project/
├── imaginize_BookTitle/
│   ├── .imaginize.state.json       # Resume state
│   ├── .imaginize.manifest.json    # Concurrent coordination
│   ├── progress.md                 # Processing log
│   ├── Contents.md                 # Visual concepts per chapter
│   ├── Chapters.md                 # Full scene descriptions
│   ├── Elements.md                 # Story element catalog
│   ├── style-guide.json            # Visual style consistency
│   ├── character-registry.json     # Character appearances
│   └── chapter_N_scene_M.png       # Generated images
```

## Concurrency Model

### Thread-Safe Operations
1. **FileLock** (`src/lib/concurrent/file-lock.ts`)
   - POSIX-compliant directory-based locks
   - Atomic mkdir operation
   - Timeout and retry logic

2. **AtomicWrite** (`src/lib/concurrent/atomic-write.ts`)
   - Temp file + atomic rename pattern
   - Prevents partial writes on crash
   - JSON convenience wrapper

3. **ManifestManager** (`src/lib/concurrent/manifest-manager.ts`)
   - Centralized state coordination
   - Per-chapter status tracking
   - Elements.md readiness flag

### State Machine
```
pending → analyzed → illustration_inprogress → illustration_complete
```

## Extension Points

### Custom AI Providers
```typescript
// config.ts
baseUrl: 'http://localhost:1234/v1'  // Local LLM
model: 'local-model-name'
```

### Custom Prompts
Modify prompt templates in:
- `analyze-phase-v2.ts` - Scene analysis
- `extract-phase.ts` - Entity extraction
- `illustrate-phase-v2.ts` - Image generation

### Event Hooks
Subscribe to ProgressTracker events:
```typescript
progressTracker.on('chapter-complete', (data) => {
  // Custom logic
});
```

## Performance Characteristics

### Sequential Mode
- **Time**: ~5h for 83-chapter book
- **Parallelism**: None
- **Memory**: Low (~100MB)
- **Best For**: Free tier, low-resource systems

### Concurrent Mode
- **Time**: ~3h for 83-chapter book (40% faster)
- **Parallelism**: 1-3 workers
- **Memory**: Moderate (~200MB)
- **Best For**: Paid tier, faster processing

### Parallel Analysis
- **Time**: ~1.5-2h for 83-chapter book (additional 50% speedup)
- **Parallelism**: Up to 3 concurrent API calls
- **Memory**: Moderate (~200MB)
- **Best For**: Paid tier with higher rate limits

## Security Considerations

1. **API Keys**: Never committed to git, loaded from env or config
2. **File System**: All operations in project directory only
3. **Network**: HTTPS for API calls, WSS for dashboard
4. **Input Validation**: Sanitize filenames, validate file types
5. **Rate Limiting**: Automatic backoff prevents API abuse

## Error Handling

### Levels
1. **Retry**: Transient errors (network, rate limits)
2. **Skip**: Non-critical errors (single chapter failure)
3. **Abort**: Critical errors (invalid API key, file not found)

### Recovery
- State persisted after each phase
- Manifest tracks per-chapter status
- Stuck chapter timeout (30min)
- Automatic resume with `--continue`

## Dependencies

### Runtime
- Node.js 18+ (Bun supported for tests)
- OpenAI SDK for AI integration
- Express + WebSocket for dashboard
- Commander.js for CLI

### Build
- TypeScript 5.4+
- ESLint + Prettier
- Bun for testing

### Bundle
- Production bundle: 192.9 kB compressed
- Dashboard bundle: 65.58 kB gzipped
- Zero npm vulnerabilities

## Monitoring & Observability

### Logs
- `progress.md`: Human-readable processing log
- `console`: Real-time CLI output
- Dashboard: Real-time WebSocket updates

### Metrics
- Token usage tracking
- Cost estimation
- Processing time per phase
- Chapter completion rate
- ETA calculation

### Health Checks
- Dashboard `/api/health` endpoint
- TypeScript compilation (CI)
- ESLint validation (CI)
- Test suite (CI)
- npm audit (CI)

---

**See Also:**
- [Pipeline Architecture](./pipeline-architecture.md)
- [Concurrent Processing](./concurrent-processing.md)
- [State Management](./state-management.md)
- [Dashboard System](./dashboard.md)
