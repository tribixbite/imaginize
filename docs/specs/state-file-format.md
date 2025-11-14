# State File Format Specification

This document specifies the format and schema of `.imaginize.state.json`, which tracks processing state and enables resume functionality.

## Overview

The state file (`.imaginize.state.json`) is a JSON file that tracks:
- Book metadata and processing configuration
- Phase completion status (parse, analyze, extract, illustrate)
- Chapter-level progress within each phase
- Token usage statistics
- Table of contents
- Element extraction status

**Location**: `illustrate_BOOKNAME/.imaginize.state.json`

**Format**: JSON with UTF-8 encoding

**Version**: 2.0.0 (current)

---

## JSON Schema

### Root Object: IllustrateState

```typescript
interface IllustrateState {
  version: string;
  bookFile: string;
  bookTitle: string;
  totalPages: number;
  avgTokensPerPage?: number;
  phases: {
    parse: PhaseState;
    analyze: PhaseState;
    extract: PhaseState;
    illustrate: PhaseState;
  };
  toc: {
    chapters: Array<{
      number: number;
      title: string;
      pages: string;
      tokenCount?: number;
    }>;
  };
  tokenStats: {
    totalUsed: number;
    estimatedRemaining?: number;
  };
  elements?: Array<{
    type: string;
    name: string;
    status: PhaseStatus;
    imageUrl?: string;
  }>;
  lastUpdated: string;
}
```

### PhaseState

```typescript
interface PhaseState {
  status: PhaseStatus;
  currentSubPhase?: SubPhase;
  subPhases?: Partial<
    Record<
      SubPhase,
      {
        status: PhaseStatus;
        [key: string]: unknown;
      }
    >
  >;
  chapters?: Record<string, ChapterState>;
  completedAt?: string;
  error?: string;
}
```

### ChapterState

```typescript
interface ChapterState {
  status: PhaseStatus;
  concepts?: number;
  tokensUsed?: number;
  completedAt?: string;
  error?: string;
  imageUrl?: string;
}
```

### PhaseStatus

```typescript
type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
```

### SubPhase

```typescript
type SubPhase = 'plan' | 'estimate' | 'prepare' | 'execute' | 'save';
```

---

## Field Descriptions

### IllustrateState Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | State file format version (e.g., "2.0.0") |
| `bookFile` | string | Yes | Path to source book file (EPUB/PDF) |
| `bookTitle` | string | Yes | Book title from metadata |
| `totalPages` | number | Yes | Total page count |
| `avgTokensPerPage` | number | No | Running average of tokens per page |
| `phases` | object | Yes | Status of all 4 processing phases |
| `toc` | object | Yes | Table of contents with chapters |
| `tokenStats` | object | Yes | Token usage tracking |
| `elements` | array | No | Extracted story elements |
| `lastUpdated` | string | Yes | ISO 8601 timestamp of last update |

### PhaseState Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | PhaseStatus | Yes | Overall phase status |
| `currentSubPhase` | SubPhase | No | Current sub-phase if in progress |
| `subPhases` | object | No | Status of each sub-phase |
| `chapters` | object | No | Per-chapter status (keyed by chapter number) |
| `completedAt` | string | No | ISO 8601 timestamp of completion |
| `error` | string | No | Error message if phase failed |

### ChapterState Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | PhaseStatus | Yes | Chapter processing status |
| `concepts` | number | No | Number of visual concepts extracted |
| `tokensUsed` | number | No | Tokens consumed for this chapter |
| `completedAt` | string | No | ISO 8601 timestamp of completion |
| `error` | string | No | Error message if chapter failed |
| `imageUrl` | string | No | URL/path to generated image |

---

## Example State File

### Fresh Initialization

```json
{
  "version": "2.0.0",
  "bookFile": "~/books/TheHobbit.epub",
  "bookTitle": "The Hobbit",
  "totalPages": 310,
  "phases": {
    "parse": { "status": "pending" },
    "analyze": { "status": "pending" },
    "extract": { "status": "pending" },
    "illustrate": { "status": "pending" }
  },
  "toc": { "chapters": [] },
  "tokenStats": { "totalUsed": 0 },
  "lastUpdated": "2025-11-14T03:45:33.123Z"
}
```

### Parse Phase Completed

```json
{
  "version": "2.0.0",
  "bookFile": "~/books/TheHobbit.epub",
  "bookTitle": "The Hobbit",
  "totalPages": 310,
  "phases": {
    "parse": {
      "status": "completed",
      "completedAt": "2025-11-14T03:45:45.456Z"
    },
    "analyze": { "status": "pending" },
    "extract": { "status": "pending" },
    "illustrate": { "status": "pending" }
  },
  "toc": {
    "chapters": [
      {
        "number": 1,
        "title": "An Unexpected Party",
        "pages": "1-15"
      },
      {
        "number": 2,
        "title": "Roast Mutton",
        "pages": "16-32"
      },
      {
        "number": 3,
        "title": "A Short Rest",
        "pages": "33-45"
      }
    ]
  },
  "tokenStats": { "totalUsed": 0 },
  "lastUpdated": "2025-11-14T03:45:45.456Z"
}
```

### Analyze Phase In Progress

```json
{
  "version": "2.0.0",
  "bookFile": "~/books/TheHobbit.epub",
  "bookTitle": "The Hobbit",
  "totalPages": 310,
  "avgTokensPerPage": 842.5,
  "phases": {
    "parse": {
      "status": "completed",
      "completedAt": "2025-11-14T03:45:45.456Z"
    },
    "analyze": {
      "status": "in_progress",
      "currentSubPhase": "execute",
      "chapters": {
        "1": {
          "status": "completed",
          "concepts": 5,
          "tokensUsed": 12638,
          "completedAt": "2025-11-14T03:48:12.789Z"
        },
        "2": {
          "status": "in_progress",
          "concepts": 3,
          "tokensUsed": 8924
        },
        "3": {
          "status": "pending"
        }
      }
    },
    "extract": { "status": "pending" },
    "illustrate": { "status": "pending" }
  },
  "toc": {
    "chapters": [
      {
        "number": 1,
        "title": "An Unexpected Party",
        "pages": "1-15",
        "tokenCount": 12638
      },
      {
        "number": 2,
        "title": "Roast Mutton",
        "pages": "16-32"
      },
      {
        "number": 3,
        "title": "A Short Rest",
        "pages": "33-45"
      }
    ]
  },
  "tokenStats": {
    "totalUsed": 21562,
    "estimatedRemaining": 253000
  },
  "lastUpdated": "2025-11-14T03:50:33.123Z"
}
```

### All Phases Completed

```json
{
  "version": "2.0.0",
  "bookFile": "~/books/TheHobbit.epub",
  "bookTitle": "The Hobbit",
  "totalPages": 310,
  "avgTokensPerPage": 895.3,
  "phases": {
    "parse": {
      "status": "completed",
      "completedAt": "2025-11-14T03:45:45.456Z"
    },
    "analyze": {
      "status": "completed",
      "chapters": {
        "1": {
          "status": "completed",
          "concepts": 5,
          "tokensUsed": 12638,
          "completedAt": "2025-11-14T03:48:12.789Z"
        },
        "2": {
          "status": "completed",
          "concepts": 6,
          "tokensUsed": 14823,
          "completedAt": "2025-11-14T03:52:45.123Z"
        },
        "3": {
          "status": "completed",
          "concepts": 4,
          "tokensUsed": 10892,
          "completedAt": "2025-11-14T03:56:01.456Z"
        }
      },
      "completedAt": "2025-11-14T03:56:01.456Z"
    },
    "extract": {
      "status": "completed",
      "completedAt": "2025-11-14T04:02:15.789Z"
    },
    "illustrate": {
      "status": "completed",
      "chapters": {
        "1": {
          "status": "completed",
          "tokensUsed": 75000,
          "imageUrl": "./images/chapter_1_scene_1.png",
          "completedAt": "2025-11-14T04:18:33.123Z"
        },
        "2": {
          "status": "completed",
          "tokensUsed": 82000,
          "imageUrl": "./images/chapter_2_scene_1.png",
          "completedAt": "2025-11-14T04:25:45.456Z"
        },
        "3": {
          "status": "completed",
          "tokensUsed": 68000,
          "imageUrl": "./images/chapter_3_scene_1.png",
          "completedAt": "2025-11-14T04:32:12.789Z"
        }
      },
      "completedAt": "2025-11-14T04:32:12.789Z"
    }
  },
  "toc": {
    "chapters": [
      {
        "number": 1,
        "title": "An Unexpected Party",
        "pages": "1-15",
        "tokenCount": 87638
      },
      {
        "number": 2,
        "title": "Roast Mutton",
        "pages": "16-32",
        "tokenCount": 96823
      },
      {
        "number": 3,
        "title": "A Short Rest",
        "pages": "33-45",
        "tokenCount": 78892
      }
    ]
  },
  "tokenStats": {
    "totalUsed": 263353,
    "estimatedRemaining": 0
  },
  "elements": [
    {
      "type": "character",
      "name": "Bilbo Baggins",
      "status": "completed",
      "imageUrl": "./images/bilbo_baggins.png"
    },
    {
      "type": "character",
      "name": "Gandalf",
      "status": "completed",
      "imageUrl": "./images/gandalf.png"
    },
    {
      "type": "place",
      "name": "Bag End",
      "status": "completed",
      "imageUrl": "./images/bag_end.png"
    }
  ],
  "lastUpdated": "2025-11-14T04:32:12.789Z"
}
```

### Phase with Error

```json
{
  "version": "2.0.0",
  "bookFile": "~/books/TheHobbit.epub",
  "bookTitle": "The Hobbit",
  "totalPages": 310,
  "phases": {
    "parse": {
      "status": "completed",
      "completedAt": "2025-11-14T03:45:45.456Z"
    },
    "analyze": {
      "status": "failed",
      "chapters": {
        "1": {
          "status": "completed",
          "concepts": 5,
          "tokensUsed": 12638,
          "completedAt": "2025-11-14T03:48:12.789Z"
        },
        "2": {
          "status": "failed",
          "error": "Rate limit exceeded. Retry after 60 seconds."
        }
      },
      "error": "Chapter 2 failed: Rate limit exceeded"
    },
    "extract": { "status": "pending" },
    "illustrate": { "status": "pending" }
  },
  "toc": {
    "chapters": [
      {
        "number": 1,
        "title": "An Unexpected Party",
        "pages": "1-15",
        "tokenCount": 12638
      },
      {
        "number": 2,
        "title": "Roast Mutton",
        "pages": "16-32"
      }
    ]
  },
  "tokenStats": {
    "totalUsed": 12638,
    "estimatedRemaining": 261715
  },
  "lastUpdated": "2025-11-14T03:50:00.000Z"
}
```

---

## State Transitions

### Phase Status Flow

```
pending → in_progress → completed
                     ↘ failed
```

### Resume Behavior

When running `imaginize --continue`:
1. Load existing `.imaginize.state.json`
2. Check `version` field (must match current version)
3. Identify incomplete phases (`status !== 'completed'`)
4. Resume from first incomplete phase
5. Skip completed chapters within incomplete phases

### Force Regeneration

When running `imaginize --force`:
1. Load existing state for metadata
2. Reset all phase statuses to `pending`
3. Clear chapter-level status
4. Preserve `bookFile`, `bookTitle`, `totalPages`
5. Reset `tokenStats.totalUsed` to 0

---

## File Operations

### Atomic Writes

State file uses atomic write pattern to prevent corruption:
1. Write to temporary file: `.imaginize.state.json.tmp`
2. Rename temporary file to final name (atomic operation)
3. Prevents partial writes if process crashes

### Concurrent Access

In concurrent mode:
- Multiple processes may read state file simultaneously
- Only one process writes at a time (atomic rename)
- State Manager uses file locking via atomic writes

---

## Version Migration

### Version Check

On load, state file version is validated:

```typescript
if (this.state.version !== STATE_VERSION) {
  throw new Error(
    `State version mismatch. Found ${this.state.version}, expected ${STATE_VERSION}. Run: npx imaginize --migrate`
  );
}
```

### Migration Process

When running `imaginize --migrate`:
1. Load old state file
2. Transform schema to new version
3. Backup old state: `.imaginize.state.json.v1.0.0.backup`
4. Write new state file with updated version

### Breaking Changes

**v1.0.0 → v2.0.0:**
- Added `currentSubPhase` to PhaseState
- Added `subPhases` tracking
- Added `elements` array to root
- Renamed `.illustrate.state.json` to `.imaginize.state.json`

---

## Validation

### Required Fields

State file must have:
- ✅ `version` (string matching current version)
- ✅ `bookFile` (non-empty string)
- ✅ `bookTitle` (non-empty string)
- ✅ `totalPages` (positive integer)
- ✅ `phases` object with all 4 phases
- ✅ `toc.chapters` (array, may be empty)
- ✅ `tokenStats.totalUsed` (non-negative integer)
- ✅ `lastUpdated` (valid ISO 8601 timestamp)

### Phase Validation

Each phase must have:
- ✅ `status` (valid PhaseStatus value)
- ✅ If `status === 'completed'`, must have `completedAt`
- ✅ If `status === 'failed'`, should have `error`
- ✅ Chapter statuses consistent with phase status

### Data Integrity

- ✅ `totalPages` matches chapter page ranges
- ✅ `tokenStats.totalUsed` sums to chapter `tokensUsed`
- ✅ `toc.chapters` array sorted by chapter number
- ✅ `avgTokensPerPage` calculated correctly
- ✅ No duplicate chapter numbers

---

## Error Handling

### Invalid State File

When state file is corrupted or invalid:
- Parse error: Prompt user to delete and restart
- Version mismatch: Prompt user to run `--migrate`
- Missing required fields: Fail with specific error message

### Recovery

Users can:
1. **Delete state file** - Start fresh (loses progress)
2. **Run migration** - Upgrade to new version
3. **Manual edit** - Fix JSON syntax errors (advanced)

---

## Related Files

- [State Management](./state-management.md) - StateManager class implementation
- [CLI Interface](./cli-interface.md) - `--continue` and `--force` flags
- [Pipeline Architecture](./pipeline-architecture.md) - Phase execution flow

---

**Status**: Complete ✅
**Last Updated**: 2025-11-14
**Version**: 2.7.0+
