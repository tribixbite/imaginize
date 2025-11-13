# State Management Specification

## Overview

imaginize uses a persistent state management system to enable resume functionality, track processing progress, and coordinate multi-phase operations. The system is built around a versioned JSON state file with atomic write operations and automatic migration support.

## State File Location

### Primary State File
```
<output-directory>/.imaginize.state.json
```

**Example**:
```
imaginize_Impossible_Creatures/.imaginize.state.json
```

### State File Structure
```typescript
interface IllustrateState {
  version: number;                    // State schema version
  bookPath: string;                   // Absolute path to source file
  bookTitle: string;                  // Book title (from metadata)
  config: Partial<IllustrateConfig>;  // Configuration snapshot
  phases: {
    parse: PhaseState;
    analyze: PhaseState;
    extract: PhaseState;
    illustrate: PhaseState;
  };
  metadata: StateMetadata;
}
```

## State Schema

### Version 2 (Current)
```json
{
  "version": 2,
  "bookPath": "/path/to/book.epub",
  "bookTitle": "Impossible Creatures",
  "config": {
    "pagesPerImage": 10,
    "model": "google/gemini-2.0-flash-exp:free",
    "extractElements": true
  },
  "phases": {
    "parse": {
      "status": "completed",
      "completedAt": "2025-11-13T10:00:00.000Z",
      "chapters": {
        "1": { "status": "completed", "title": "Chapter 1" },
        "2": { "status": "completed", "title": "Chapter 2" }
      }
    },
    "analyze": {
      "status": "in-progress",
      "currentSubPhase": "pass2",
      "subPhases": {
        "pass1": {
          "status": "completed",
          "completedAt": "2025-11-13T11:00:00.000Z"
        },
        "pass2": {
          "status": "in-progress",
          "progress": 45,
          "total": 83
        }
      },
      "chapters": {
        "1": { "status": "completed", "pass1": true, "pass2": true },
        "45": { "status": "in-progress", "pass1": true, "pass2": false },
        "46": { "status": "pending", "pass1": false, "pass2": false }
      }
    },
    "extract": {
      "status": "not-started"
    },
    "illustrate": {
      "status": "not-started"
    }
  },
  "metadata": {
    "createdAt": "2025-11-13T09:00:00.000Z",
    "updatedAt": "2025-11-13T11:30:00.000Z",
    "lastPhase": "analyze",
    "totalChapters": 83,
    "processedChapters": 44
  }
}
```

## Phase State Schema

### PhaseStatus Enum
```typescript
type PhaseStatus =
  | 'not-started'   // Phase never started
  | 'in-progress'   // Currently processing
  | 'completed'     // Successfully completed
  | 'failed'        // Failed with error
  | 'skipped';      // Skipped (user choice)
```

### PhaseState Interface
```typescript
interface PhaseState {
  status: PhaseStatus;
  currentSubPhase?: SubPhase;           // Current sub-phase (analyze only)
  subPhases?: Partial<Record<SubPhase, {
    status: PhaseStatus;
    progress?: number;                   // Current progress count
    total?: number;                      // Total items to process
    completedAt?: string;                // ISO 8601 timestamp
    [key: string]: unknown;
  }>>;
  chapters?: Record<string, ChapterState>;  // Per-chapter state
  completedAt?: string;                     // ISO 8601 timestamp
  error?: string;                           // Error message if failed
}
```

### SubPhase (Analyze Only)
```typescript
type SubPhase = 'pass1' | 'pass2';

// Pass 1: Entity extraction
// Pass 2: Full scene analysis with enrichment
```

### ChapterState Interface
```typescript
interface ChapterState {
  status: PhaseStatus;
  title?: string;                       // Chapter title
  pass1?: boolean;                      // Pass 1 completed (analyze)
  pass2?: boolean;                      // Pass 2 completed (analyze)
  entityCount?: number;                 // Extracted entities (analyze)
  sceneCount?: number;                  // Visual scenes (analyze)
  imageCount?: number;                  // Generated images (illustrate)
  error?: string;                       // Error message if failed
}
```

## State Lifecycle

### 1. Initialization
```typescript
// src/lib/state-manager.ts
export async function initializeState(
  bookPath: string,
  bookTitle: string,
  config: Partial<IllustrateConfig>
): Promise<IllustrateState> {
  const state: IllustrateState = {
    version: STATE_VERSION,
    bookPath: path.resolve(bookPath),
    bookTitle,
    config,
    phases: {
      parse: { status: 'not-started' },
      analyze: { status: 'not-started' },
      extract: { status: 'not-started' },
      illustrate: { status: 'not-started' },
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastPhase: 'parse',
      totalChapters: 0,
      processedChapters: 0,
    },
  };

  await saveState(state, outputDir);
  return state;
}
```

### 2. State Loading
```typescript
export async function loadState(
  outputDir: string
): Promise<IllustrateState | null> {
  const statePath = path.join(outputDir, STATE_FILE);

  try {
    const content = await readFile(statePath, 'utf-8');
    const state = JSON.parse(content) as IllustrateState;

    // Validate and migrate if needed
    return migrateState(state);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;  // No state file exists
    }
    throw error;
  }
}
```

### 3. State Updates
```typescript
export async function updatePhaseStatus(
  state: IllustrateState,
  phase: Phase,
  status: PhaseStatus,
  outputDir: string
): Promise<void> {
  state.phases[phase].status = status;

  if (status === 'completed') {
    state.phases[phase].completedAt = new Date().toISOString();
  }

  state.metadata.updatedAt = new Date().toISOString();
  state.metadata.lastPhase = phase;

  await saveState(state, outputDir);
}

export async function updateChapterStatus(
  state: IllustrateState,
  phase: Phase,
  chapterNumber: number,
  chapterState: Partial<ChapterState>,
  outputDir: string
): Promise<void> {
  if (!state.phases[phase].chapters) {
    state.phases[phase].chapters = {};
  }

  const existing = state.phases[phase].chapters![chapterNumber] || {};
  state.phases[phase].chapters![chapterNumber] = {
    ...existing,
    ...chapterState,
  };

  state.metadata.updatedAt = new Date().toISOString();
  await saveState(state, outputDir);
}
```

### 4. Atomic Write Operations
```typescript
// Atomic write with temp file + rename
export async function saveState(
  state: IllustrateState,
  outputDir: string
): Promise<void> {
  const statePath = path.join(outputDir, STATE_FILE);
  const tempPath = `${statePath}.tmp`;

  // Write to temp file
  await writeFile(
    tempPath,
    JSON.stringify(state, null, 2),
    'utf-8'
  );

  // Atomic rename
  await rename(tempPath, statePath);
}
```

**Why Atomic Writes?**
- Prevents corruption if interrupted (Ctrl+C, crash)
- Ensures state file is always valid JSON
- No partial writes visible to readers

## State Migrations

### Migration System
```typescript
const STATE_VERSION = 2;

interface MigrationHandler {
  version: number;
  migrate: (state: unknown) => IllustrateState;
}

const MIGRATIONS: MigrationHandler[] = [
  {
    version: 1,
    migrate: (state: unknown): IllustrateState => {
      // No migration needed - version 1 schema
      return state as IllustrateState;
    },
  },
  {
    version: 2,
    migrate: (oldState: unknown): IllustrateState => {
      const old = oldState as StateV1;

      // Add subPhases to analyze phase
      return {
        ...old,
        version: 2,
        phases: {
          ...old.phases,
          analyze: {
            ...old.phases.analyze,
            subPhases: old.phases.analyze.subPhases || {
              pass1: { status: 'not-started' },
              pass2: { status: 'not-started' },
            },
          },
        },
      };
    },
  },
];

export function migrateState(state: IllustrateState): IllustrateState {
  let current = state;

  // Apply migrations in sequence
  while (current.version < STATE_VERSION) {
    const migration = MIGRATIONS.find(m => m.version === current.version + 1);
    if (!migration) {
      throw new Error(`No migration found for version ${current.version} → ${current.version + 1}`);
    }

    current = migration.migrate(current);
    current.version = migration.version;
  }

  return current;
}
```

## Resume Functionality

### Resume Detection
```typescript
export function canResume(state: IllustrateState | null): boolean {
  if (!state) return false;

  // Check if any phase is in-progress
  return Object.values(state.phases).some(
    phase => phase.status === 'in-progress'
  );
}

export function getResumePhase(state: IllustrateState): Phase {
  // Find first in-progress or not-started phase
  const phases: Phase[] = ['parse', 'analyze', 'extract', 'illustrate'];

  for (const phase of phases) {
    const status = state.phases[phase].status;
    if (status === 'in-progress' || status === 'not-started') {
      return phase;
    }
  }

  // All phases completed
  return 'illustrate';  // Default to last phase
}
```

### Resume Workflow
```bash
# Start processing
imaginize --text --images --file book.epub

# ... processing interrupted (Ctrl+C) ...

# Resume from last state
imaginize --continue

# System detects state file and resumes
```

**Resume Output**:
```
📖 Resuming: Impossible Creatures

Previous session:
  ✓ Parse phase completed (83 chapters)
  ⏳ Analyze phase in-progress (44/83 chapters)
  ○ Extract phase not started
  ○ Illustrate phase not started

Resuming from: Analyze phase, chapter 45
```

### Force Regeneration
```bash
# Ignore state and regenerate everything
imaginize --force --text --file book.epub
```

**Force Behavior**:
- Deletes existing state file
- Re-processes all phases from scratch
- Overwrites existing output files
- Useful for:
  - Changing configuration
  - Fixing corrupted output
  - Updating to new version

## State Queries

### Chapter Progress
```typescript
export function getChapterProgress(
  state: IllustrateState,
  phase: Phase
): { completed: number; total: number; percent: number } {
  const chapters = state.phases[phase].chapters || {};
  const total = state.metadata.totalChapters;

  const completed = Object.values(chapters).filter(
    ch => ch.status === 'completed'
  ).length;

  return {
    completed,
    total,
    percent: total > 0 ? (completed / total) * 100 : 0,
  };
}
```

### Phase Status Summary
```typescript
export function getPhaseSummary(state: IllustrateState): string {
  const lines: string[] = [];

  for (const [name, phaseState] of Object.entries(state.phases)) {
    const icon = getPhaseIcon(phaseState.status);
    const label = name.charAt(0).toUpperCase() + name.slice(1);

    if (phaseState.status === 'in-progress' && phaseState.subPhases) {
      // Show sub-phase progress
      const subPhase = phaseState.currentSubPhase;
      const progress = phaseState.subPhases[subPhase!]?.progress || 0;
      const total = phaseState.subPhases[subPhase!]?.total || 0;

      lines.push(`${icon} ${label}: ${subPhase} (${progress}/${total})`);
    } else {
      lines.push(`${icon} ${label}: ${phaseState.status}`);
    }
  }

  return lines.join('\n');
}
```

## Concurrent State Coordination

### Manifest File (Concurrent Mode)
```
<output-directory>/.imaginize.manifest.json
```

**Purpose**: Coordinate concurrent processing across chapters

```typescript
interface ConcurrentManifest {
  version: number;
  totalChapters: number;
  chapters: {
    [chapterNumber: string]: ChapterManifest;
  };
  createdAt: string;
  updatedAt: string;
}

interface ChapterManifest {
  number: number;
  title: string;
  entityExtractionComplete: boolean;
  fullAnalysisComplete: boolean;
  imageGenerationComplete: boolean;
  entityCount?: number;
  sceneCount?: number;
  imageCount?: number;
}
```

**Usage**:
```typescript
// Check if chapter pass 1 complete before starting pass 2
async function canStartPass2(chapterNumber: number): Promise<boolean> {
  const manifest = await loadManifest(outputDir);
  return manifest.chapters[chapterNumber]?.entityExtractionComplete === true;
}

// Mark chapter pass 1 complete
async function markPass1Complete(chapterNumber: number): Promise<void> {
  const manifest = await loadManifest(outputDir);
  manifest.chapters[chapterNumber].entityExtractionComplete = true;
  manifest.updatedAt = new Date().toISOString();
  await saveManifest(manifest, outputDir);
}
```

**Coordination Example**:
```
Pass 1 (concurrent):
  - Process all chapters in parallel
  - Each chapter updates manifest on completion
  - No dependencies between chapters

Pass 2 (concurrent):
  - Wait for all chapters' pass 1 to complete
  - Then process all chapters in parallel
  - Each chapter reads Elements.md (from pass 1)
  - Updates manifest on completion

Illustrate (manifest-driven):
  - Read manifest to find all chapters with scenes
  - Process scenes in parallel (rate limit aware)
  - Update manifest as images complete
```

## Error Recovery

### Failed Chapter Tracking
```typescript
export async function markChapterFailed(
  state: IllustrateState,
  phase: Phase,
  chapterNumber: number,
  error: Error,
  outputDir: string
): Promise<void> {
  await updateChapterStatus(
    state,
    phase,
    chapterNumber,
    {
      status: 'failed',
      error: error.message,
    },
    outputDir
  );
}
```

### Resume After Errors
```typescript
export function getFailedChapters(
  state: IllustrateState,
  phase: Phase
): number[] {
  const chapters = state.phases[phase].chapters || {};

  return Object.entries(chapters)
    .filter(([_, ch]) => ch.status === 'failed')
    .map(([num, _]) => parseInt(num, 10));
}

// Retry failed chapters only
const failedChapters = getFailedChapters(state, 'analyze');
if (failedChapters.length > 0) {
  console.log(`⚠️  Retrying ${failedChapters.length} failed chapters...`);
  // ... retry logic
}
```

## State File Examples

### Minimal State (Fresh Start)
```json
{
  "version": 2,
  "bookPath": "/path/to/book.epub",
  "bookTitle": "Example Book",
  "config": {
    "pagesPerImage": 10,
    "model": "gpt-4o-mini"
  },
  "phases": {
    "parse": { "status": "not-started" },
    "analyze": { "status": "not-started" },
    "extract": { "status": "not-started" },
    "illustrate": { "status": "not-started" }
  },
  "metadata": {
    "createdAt": "2025-11-13T09:00:00.000Z",
    "updatedAt": "2025-11-13T09:00:00.000Z",
    "lastPhase": "parse",
    "totalChapters": 0,
    "processedChapters": 0
  }
}
```

### Mid-Processing State
```json
{
  "version": 2,
  "bookPath": "/path/to/book.epub",
  "bookTitle": "Example Book",
  "config": {
    "pagesPerImage": 10,
    "model": "google/gemini-2.0-flash-exp:free"
  },
  "phases": {
    "parse": {
      "status": "completed",
      "completedAt": "2025-11-13T10:00:00.000Z",
      "chapters": {
        "1": { "status": "completed", "title": "Chapter 1" },
        "2": { "status": "completed", "title": "Chapter 2" },
        "3": { "status": "completed", "title": "Chapter 3" }
      }
    },
    "analyze": {
      "status": "in-progress",
      "currentSubPhase": "pass2",
      "subPhases": {
        "pass1": {
          "status": "completed",
          "progress": 3,
          "total": 3,
          "completedAt": "2025-11-13T11:00:00.000Z"
        },
        "pass2": {
          "status": "in-progress",
          "progress": 1,
          "total": 3
        }
      },
      "chapters": {
        "1": {
          "status": "completed",
          "title": "Chapter 1",
          "pass1": true,
          "pass2": true,
          "entityCount": 8,
          "sceneCount": 2
        },
        "2": {
          "status": "in-progress",
          "title": "Chapter 2",
          "pass1": true,
          "pass2": false,
          "entityCount": 5
        },
        "3": {
          "status": "pending",
          "title": "Chapter 3",
          "pass1": true,
          "pass2": false,
          "entityCount": 6
        }
      }
    },
    "extract": { "status": "not-started" },
    "illustrate": { "status": "not-started" }
  },
  "metadata": {
    "createdAt": "2025-11-13T09:00:00.000Z",
    "updatedAt": "2025-11-13T11:30:00.000Z",
    "lastPhase": "analyze",
    "totalChapters": 3,
    "processedChapters": 1
  }
}
```

## State Validation

### Schema Validation
```typescript
export function validateState(state: IllustrateState): boolean {
  // Required fields
  if (!state.version || !state.bookPath || !state.bookTitle) {
    return false;
  }

  // Phase statuses
  const validStatuses: PhaseStatus[] = [
    'not-started',
    'in-progress',
    'completed',
    'failed',
    'skipped',
  ];

  for (const phase of Object.values(state.phases)) {
    if (!validStatuses.includes(phase.status)) {
      return false;
    }
  }

  return true;
}
```

### State Repair
```typescript
export function repairState(state: IllustrateState): IllustrateState {
  // Fix missing metadata
  if (!state.metadata) {
    state.metadata = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastPhase: 'parse',
      totalChapters: 0,
      processedChapters: 0,
    };
  }

  // Fix missing chapter states
  for (const phase of Object.values(state.phases)) {
    if (!phase.chapters) {
      phase.chapters = {};
    }
  }

  return state;
}
```

## Performance Considerations

### Write Frequency
- **Every chapter completion**: Update chapter state
- **Every phase transition**: Update phase status
- **Every 10 chapters**: Update progress metadata (batched)

### Read Frequency
- **On startup**: Load state once
- **On resume**: Load state once
- **During processing**: Read from in-memory state object (no disk I/O)

### State File Size
- **Small books (10 chapters)**: ~5 KB
- **Medium books (50 chapters)**: ~25 KB
- **Large books (200 chapters)**: ~100 KB

**Optimization**: State files remain small even for large books (<100 KB).

---

**See Also:**
- [CLI Interface](./cli-interface.md) - Resume and force options
- [Pipeline Architecture](./pipeline-architecture.md) - Phase coordination
- [Concurrent Processing](./concurrent-processing.md) - Manifest usage
