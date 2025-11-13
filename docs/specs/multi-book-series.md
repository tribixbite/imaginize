# Multi-Book Series Support Specification

## Overview

imaginize supports multi-book series by sharing character descriptions, story elements, and visual style across books. This ensures consistency when processing multiple books in a series like Harry Potter, Lord of the Rings, or The Chronicles of Narnia.

## Architecture

```
Series Directory Structure:
─────────────────────────────────────────────────────────────
series-root/
├── .imaginize.series.json          # Series configuration
├── .series-elements-memory.json    # Shared elements across all books
├── Elements.md                      # Series-wide element catalog
│
├── book-1/
│   ├── input.epub
│   ├── .imaginize.config           # Book-specific config
│   ├── output/
│   │   ├── Chapters.md
│   │   ├── Elements.md             # Book 1 elements (subset of series)
│   │   ├── .elements-memory.json   # Book 1 memory
│   │   └── images/
│   └── ...
│
└── book-2/
    ├── input.epub
    ├── .imaginize.config
    ├── output/
    │   ├── Chapters.md
    │   ├── Elements.md             # Book 2 elements (subset of series)
    │   ├── .elements-memory.json
    │   └── images/
    └── ...
```

## Configuration

### Series Configuration File

**`.imaginize.series.json`** (in series root directory):

```json
{
  "version": 1,
  "name": "Harry Potter",
  "description": "Seven-book fantasy series",
  "books": [
    {
      "id": "book-1",
      "title": "Harry Potter and the Philosopher's Stone",
      "path": "./book-1",
      "order": 1,
      "status": "completed"
    },
    {
      "id": "book-2",
      "title": "Harry Potter and the Chamber of Secrets",
      "path": "./book-2",
      "order": 2,
      "status": "in_progress"
    }
  ],
  "sharedElements": {
    "enabled": true,
    "mode": "progressive",
    "mergeStrategy": "enrich"
  },
  "visualStyle": {
    "inheritFromBook": "book-1",
    "allowVariations": false
  },
  "createdAt": "2025-11-13T...",
  "lastUpdated": "2025-11-13T..."
}
```

### Book Configuration

**`.imaginize.config`** (in each book directory):

```yaml
# Standard book configuration
model: "openai/gpt-4"
imageModel: "openai/dall-e-3"

# Series integration (optional)
series:
  enabled: true
  seriesRoot: "../"  # Path to series root directory
  bookId: "book-1"   # Must match ID in .imaginize.series.json
```

## Shared Elements Management

### Progressive Element Discovery

Elements are progressively discovered across books:

1. **Book 1 Processing**:
   - Extract elements: Harry, Hermione, Hogwarts, wand
   - Save to `book-1/output/.elements-memory.json`
   - Export to series: `.series-elements-memory.json`
   - Generate series catalog: `Elements.md`

2. **Book 2 Processing**:
   - Import existing elements from series memory
   - Use existing descriptions for Harry, Hermione, etc.
   - Discover new elements: Dobby, Chamber of Secrets
   - Enrich existing elements with new details
   - Merge back to series memory
   - Update series catalog

### Element Merge Strategies

#### 1. Enrich Mode (Default)
- Keep base description from first appearance
- Append new details to enrichments
- Track which book contributed which detail

```json
{
  "name": "Harry Potter",
  "type": "character",
  "baseDescription": "Young wizard with lightning scar, dark hair, green eyes",
  "firstAppearance": {
    "bookId": "book-1",
    "chapter": 1
  },
  "enrichments": [
    {
      "detail": "Patronus is a stag",
      "sourceBook": "book-3",
      "sourceChapter": 12,
      "addedAt": "2025-11-13T..."
    },
    {
      "detail": "Gryffindor seeker",
      "sourceBook": "book-1",
      "sourceChapter": 9,
      "addedAt": "2025-11-13T..."
    }
  ]
}
```

#### 2. Union Mode
- Combine all descriptions from all books
- Merge without deduplication
- Useful for evolving characters

#### 3. Override Mode
- Later books override earlier descriptions
- Use when character descriptions need correction

### Series Elements Memory

**`.series-elements-memory.json`** structure:

```json
{
  "version": 1,
  "seriesName": "Harry Potter",
  "lastUpdated": "2025-11-13T...",
  "entities": {
    "Harry Potter": {
      "name": "Harry Potter",
      "type": "character",
      "baseDescription": "Young wizard with lightning scar",
      "firstAppearance": {
        "bookId": "book-1",
        "bookTitle": "Philosopher's Stone",
        "chapter": 1
      },
      "appearances": [
        {
          "bookId": "book-1",
          "chapters": [1, 2, 3, 4, 5]
        },
        {
          "bookId": "book-2",
          "chapters": [1, 2, 3]
        }
      ],
      "enrichments": [
        {
          "detail": "Gryffindor seeker",
          "sourceBook": "book-1",
          "sourceChapter": 9,
          "addedAt": "2025-11-13T..."
        }
      ],
      "lastUpdated": "2025-11-13T..."
    }
  },
  "statistics": {
    "totalEntities": 42,
    "totalEnrichments": 156,
    "booksProcessed": 2
  }
}
```

## Implementation

### 1. Series Manager Module

**`src/lib/concurrent/series-manager.ts`**:

```typescript
export interface SeriesConfig {
  version: number;
  name: string;
  description?: string;
  books: BookInfo[];
  sharedElements: {
    enabled: boolean;
    mode: 'progressive' | 'manual';
    mergeStrategy: 'enrich' | 'union' | 'override';
  };
  visualStyle?: {
    inheritFromBook?: string;
    allowVariations?: boolean;
  };
  createdAt: string;
  lastUpdated: string;
}

export interface BookInfo {
  id: string;
  title: string;
  path: string;
  order: number;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

export function createSeriesManager(seriesRoot: string) {
  // Load series configuration
  async function loadConfig(): Promise<SeriesConfig | null>

  // Initialize new series
  async function initializeSeries(config: Partial<SeriesConfig>): Promise<void>

  // Add book to series
  async function addBook(bookInfo: BookInfo): Promise<void>

  // Update book status
  async function updateBookStatus(
    bookId: string,
    status: BookInfo['status']
  ): Promise<void>

  // Get series statistics
  function getStats(): SeriesStats
}
```

### 2. Series Elements Manager

**`src/lib/concurrent/series-elements.ts`**:

```typescript
export function createSeriesElementsManager(seriesRoot: string) {
  // Load series-wide elements
  async function loadSeriesElements(): Promise<Map<string, EntityMemory>>

  // Import elements from series to book
  async function importToBook(
    bookId: string,
    bookOutputDir: string
  ): Promise<{ imported: number; entities: string[] }>

  // Export elements from book to series
  async function exportFromBook(
    bookId: string,
    bookOutputDir: string
  ): Promise<{ exported: number; entities: string[] }>

  // Merge book elements into series
  async function mergeElements(
    bookId: string,
    bookElements: Map<string, EntityMemory>,
    strategy: 'enrich' | 'union' | 'override'
  ): Promise<{ added: number; updated: number; enriched: number }>

  // Generate series-wide Elements.md
  async function generateSeriesCatalog(): Promise<void>
}
```

### 3. Integration with Analysis Phase

Modify **`src/lib/phases/analyze-phase-v2.ts`**:

```typescript
export class AnalyzePhaseV2 extends BasePhase {
  private elementsMemory: ReturnType<typeof createElementsMemory>;
  private seriesManager?: ReturnType<typeof createSeriesManager>;
  private seriesElements?: ReturnType<typeof createSeriesElementsManager>;

  async execute(options: AnalyzeOptions): Promise<void> {
    // Check for series configuration
    const seriesConfig = await this.detectSeriesConfig();

    if (seriesConfig) {
      // Initialize series managers
      this.seriesManager = createSeriesManager(seriesConfig.seriesRoot);
      this.seriesElements = createSeriesElementsManager(seriesConfig.seriesRoot);

      // Import existing series elements before Pass 1
      const imported = await this.seriesElements.importToBook(
        seriesConfig.bookId,
        this.context.outputDir
      );

      if (imported.imported > 0) {
        await progressTracker.log(
          `📚 Series: Imported ${imported.imported} elements from series (${imported.entities.join(', ')})`,
          'success'
        );
      }
    }

    // Run normal Pass 1 and Pass 2
    await this.runPass1();
    await this.runPass2();

    // Export elements back to series after Pass 2
    if (this.seriesElements) {
      const exported = await this.seriesElements.exportFromBook(
        seriesConfig!.bookId,
        this.context.outputDir
      );

      if (exported.exported > 0) {
        await progressTracker.log(
          `📚 Series: Exported ${exported.exported} elements to series`,
          'success'
        );
      }

      // Regenerate series catalog
      await this.seriesElements.generateSeriesCatalog();
    }
  }
}
```

## CLI Commands

### Initialize Series

```bash
imaginize series init --name "Harry Potter" --dir ./harry-potter-series

# Interactive prompts:
# > Series name: Harry Potter
# > Description (optional): Seven-book fantasy series
# > First book path: ./book-1
# > First book title: Harry Potter and the Philosopher's Stone
```

### Add Book to Series

```bash
cd harry-potter-series
imaginize series add-book --path ./book-2 --title "Chamber of Secrets"
```

### Process Series Book

```bash
cd harry-potter-series/book-2
imaginize process input.epub --series
# Automatically detects series configuration
# Imports elements from series
# Processes book
# Exports new/enriched elements back to series
```

### Series Statistics

```bash
cd harry-potter-series
imaginize series stats

# Output:
# 📚 Series: Harry Potter
# Books: 7 (2 completed, 1 in progress, 4 pending)
# Total Elements: 156
# Characters: 42
# Creatures: 18
# Places: 32
# Items: 64
# Total Enrichments: 487
```

## Visual Style Inheritance

**Note**: Requires base visual style system to be implemented first.

When configured, books in a series can inherit visual style from a previous book:

```json
{
  "visualStyle": {
    "inheritFromBook": "book-1",
    "allowVariations": false
  }
}
```

This ensures:
- Consistent art style across entire series
- Character appearances remain consistent
- No need to re-bootstrap style for each book
- Optional variations for mood shifts (dark books, flashbacks, etc.)

## Backward Compatibility

Single-book workflows remain unchanged:
- No series configuration = normal single-book mode
- Series features are opt-in
- Existing projects unaffected

## Benefits

### For Users
- **Character Consistency**: Descriptions shared across books
- **Time Savings**: No need to re-describe recurring characters
- **Visual Consistency**: Inherit style from previous books
- **Progressive Enrichment**: Elements get richer with each book

### For Development
- **Builds on ElementsMemory**: Reuses existing enrichment system
- **Modular Design**: Series features are optional
- **Thread-Safe**: Uses existing file locking mechanisms
- **Scalable**: Handles series of any size

## Testing Strategy

### Unit Tests
- Series configuration loading and validation
- Element merging strategies (enrich, union, override)
- Import/export operations
- Conflict resolution

### Integration Tests
- Two-book series workflow
- Progressive element discovery
- Cross-book enrichment
- Series catalog generation

### Manual Tests
- Real-world series (e.g., first 3 Harry Potter books)
- Verify character consistency
- Check enrichment tracking
- Validate series Elements.md

## Migration Path

### For Existing Single Books
If users want to convert existing processed books to a series:

```bash
imaginize series convert --books ./book-1/output,./book-2/output --name "My Series"
```

This will:
1. Create series configuration
2. Import elements from each book
3. Merge into series memory
4. Generate series catalog

## Future Enhancements

### Cross-Book Analysis
- Detect character evolution across books
- Track plot threads spanning multiple books
- Generate series-wide character arcs

### Smart Element Resolution
- AI-powered conflict resolution for descriptions
- Automatic character name variants (Harry/Potter/Harry Potter)
- Entity relationship mapping

### Series Dashboard
- Visual progress tracking
- Element timeline view
- Character appearance heatmap
- Cross-book statistics

## Performance Considerations

### Memory Usage
- Series memory scales with number of unique elements
- Typical series: 100-200 unique elements
- Memory footprint: <1MB per series

### Processing Time
- Import/export adds ~1-2 seconds per book
- Negligible compared to AI processing time
- Catalog generation: <1 second

### Disk Usage
- `.series-elements-memory.json`: ~100KB per 100 elements
- Series `Elements.md`: ~50KB per 100 elements
- Total overhead: <500KB for typical series

## Summary

Multi-book series support enables:
- ✅ Shared character and element descriptions
- ✅ Progressive enrichment across books
- ✅ Series-wide element catalog
- ✅ Visual style inheritance (when base system implemented)
- ✅ Backward compatible with single-book workflows
- ✅ Thread-safe for concurrent processing
- ✅ Builds on existing ElementsMemory system

**Status**: Specification complete, implementation next.
