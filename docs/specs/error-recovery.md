# Error Recovery Specification

Comprehensive error handling and recovery strategies in imaginize.

## Overview

imaginize implements multi-layered error recovery:
- **Automatic Retry** - Rate limits, network errors
- **State Persistence** - Resume from failures
- **Graceful Degradation** - Continue on non-critical errors
- **Error Reporting** - Detailed logs and user feedback

---

## Error Categories

### 1. API Errors

**Rate Limits (429)**:
- Automatic retry with exponential backoff
- Max retries: 5
- Base delay: 2s → 4s → 8s → 16s → 32s
- Free tier: 60s delays between batches

**Authentication (401)**:
- Immediate failure
- User prompt to check API key
- No automatic retry

**Server Errors (500, 502, 503)**:
- Automatic retry (max 3)
- Exponential backoff
- Skip after max retries, continue processing

### 2. File Errors

**Missing Files**:
- Book file not found → fail early with clear message
- State file missing → create new state
- Output directory missing → auto-create

**Corrupt Files**:
- Invalid EPUB → detailed error, suggest re-download
- Invalid PDF → detailed error, check file integrity
- Invalid state JSON → prompt to delete and restart

### 3. Processing Errors

**Chapter Failures**:
- Mark chapter as failed in state
- Continue with remaining chapters
- `--retry-failed` flag to retry only failed chapters

**Timeout Errors**:
- Default timeout: 300s (5 minutes)
- Configurable via `timeout` setting
- Save state before timeout, resume after

---

## Retry Strategy

### Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 2000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
}
```

### Rate Limit Handling

```typescript
if (error.status === 429) {
  const retryAfter = error.headers['retry-after'] || 60;
  console.log(`Rate limited. Retrying after ${retryAfter}s`);
  await sleep(retryAfter * 1000);
  return retry();
}
```

---

## State Recovery

### Resume from Failure

**Workflow**:
1. Load `.imaginize.state.json`
2. Identify incomplete phases
3. Check chapter-level failures
4. Resume from first incomplete/failed item

**Commands**:
```bash
# Resume from saved state
imaginize --continue

# Retry only failed chapters
imaginize --retry-failed

# Skip failed chapters, continue with rest
imaginize --skip-failed

# Clear error flags and retry
imaginize --clear-errors --retry-failed
```

### Error State Tracking

**ChapterState with errors**:
```json
{
  "chapters": {
    "3": {
      "status": "failed",
      "error": "Rate limit exceeded. Retry after 60 seconds.",
      "tokensUsed": 12500
    }
  }
}
```

---

## Graceful Degradation

### Non-Critical Failures

**Continue Processing**:
- Failed chapter analysis → skip chapter, continue with others
- Failed element extraction → log warning, continue
- Failed image generation → log error, continue with text

**Partial Results**:
- Generate Contents.md with available chapters
- Generate Elements.md with extracted elements
- User can manually add failed chapters later

---

## Error Messages

### User-Friendly Messages

**API Key Missing**:
```
❌ Error: No API key configured

Please set your OpenAI/OpenRouter API key:
  1. Create .imaginize.config file
  2. Set OPENAI_API_KEY environment variable
  3. Use --api-key flag

Run: imaginize --init-config for sample configuration
```

**Rate Limit**:
```
⚠️  Rate limit reached

The API provider has rate-limited your requests.
Waiting 60 seconds before retry (attempt 2/5)...

Tip: Use OpenRouter for higher free tier limits
```

**Chapter Failure**:
```
❌ Chapter 3 failed: Rate limit exceeded

Continuing with remaining chapters...
Progress saved. Use --retry-failed to retry this chapter later.
```

---

## Logging

### Progress Logs

**File**: `illustrate_BOOKNAME/progress.md`

**Error Entries**:
```markdown
### 2025-11-14 15:30:45 - ERROR

**Phase**: analyze
**Chapter**: 3
**Error**: Rate limit exceeded (429)
**Action**: Automatic retry in 60s
```

---

## Related Documentation

- [State Management](./state-management.md) - State persistence
- [CLI Interface](./cli-interface.md) - Error recovery flags
- [Rate Limiting](./rate-limiting.md) - Retry implementation

---

**Status**: Complete ✅
**Last Updated**: 2025-11-14
