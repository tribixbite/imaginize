# Parallel Processing Specification

Multi-process concurrent execution and batch processing in imaginize.

## Overview

imaginize supports parallel chapter processing with:
- **Batch Processing** - Process multiple chapters concurrently
- **Manifest Coordination** - Avoid duplicate work across processes
- **Atomic Operations** - Safe concurrent file access
- **Performance Gains** - 50-70% faster with parallel batch 3

---

## Architecture

### Concurrent Mode

**Flag**: `--concurrent`

**Process Model**:
- Spawn N worker processes (default: 3)
- Each process claims chapters from shared manifest
- Coordinate via `.imaginize.manifest.json`
- Atomic file locking for state writes

### Batch Configuration

```typescript
interface ConcurrentConfig {
  maxConcurrency: number;  // Default: 3
  batchSize: number;       // Chapters per batch
  rateLimit: 'free' | 'paid';  // Tier-specific delays
}
```

---

## Implementation

### Manifest Manager

**File**: `.imaginize.manifest.json`

**Schema**:
```json
{
  "version": "2.0.0",
  "bookFile": "path/to/book.epub",
  "totalChapters": 19,
  "chapters": {
    "1": {
      "status": "completed",
      "claimedBy": "process-1",
      "claimedAt": "2025-11-14T10:30:00Z",
      "completedAt": "2025-11-14T10:32:15Z"
    },
    "2": {
      "status": "in_progress",
      "claimedBy": "process-2",
      "claimedAt": "2025-11-14T10:30:05Z"
    },
    "3": {
      "status": "pending"
    }
  }
}
```

### Atomic File Operations

**Lock Acquisition**:
```typescript
async function acquireLock(lockPath: string, timeout: number = 30000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      await writeFile(lockPath, process.pid.toString(), { flag: 'wx' });
      return; // Lock acquired
    } catch (error) {
      // Lock exists, wait and retry
      await sleep(100);
    }
  }
  
  throw new Error('Failed to acquire lock: timeout');
}
```

**Atomic Write**:
```typescript
async function atomicWriteJSON(path: string, data: unknown): Promise<void> {
  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, JSON.stringify(data, null, 2));
  await rename(tempPath, path); // Atomic operation
}
```

---

## Performance Benchmarks

### Parallel vs Sequential

**Test Case**: 10 chapters, 5 concepts each

| Mode | Time | Speedup |
|------|------|---------|
| Sequential | 12m 30s | 1.0x |
| Parallel (batch 2) | 7m 45s | 1.61x |
| Parallel (batch 3) | 6m 15s | 2.0x |
| Parallel (batch 5) | 5m 50s | 2.14x |

**Optimal**: Batch size 3 for free tier, 5 for paid tier

### Benchmark Data

From `src/test/benchmarks/`:
- State file write: 650μs avg (1,543 ops/sec)
- State file read: 234μs avg (4,280 ops/sec)
- Manifest update: ~450μs avg (atomic write)

---

## Rate Limiting

### Free Tier

**Constraints**:
- 1 request per minute per chapter
- 60s delays between batches
- Sequential within batch

**Strategy**:
```typescript
// Batch of 3 chapters
await Promise.all([
  processChapter(1),
  processChapter(2),
  processChapter(3),
]);
await sleep(60000); // 60s delay before next batch
```

### Paid Tier

**Constraints**:
- Higher rate limits (flexible)
- 2s delays between batches
- Parallel within batch

**Strategy**:
```typescript
// Batch of 5 chapters
await Promise.all([
  processChapter(1),
  processChapter(2),
  processChapter(3),
  processChapter(4),
  processChapter(5),
]);
await sleep(2000); // 2s delay before next batch
```

---

## Error Handling

### Process Failures

**Stuck Chapter Timeout**:
- Default: 5 minutes per chapter
- Mark as failed if timeout
- Release lock for retry

**Process Crash**:
- Stale lock detection (>10 minutes)
- Auto-release stale locks
- Resume from manifest state

---

## Related Documentation

- [Concurrent Processing](./concurrent-processing.md) - Implementation details
- [Benchmarks](../../src/test/benchmarks/README.md) - Performance data
- [Manifest Format](./manifest-format.md) - Coordination schema

---

**Status**: Complete ✅
**Last Updated**: 2025-11-14
**Performance**: 50-70% faster with batch 3
