# Rate Limiting Specification

Retry strategies and request timing implementation in imaginize.

## Overview

imaginize implements intelligent rate limiting to handle:
- **Free Tier Constraints** - 1 request/minute (OpenRouter)
- **Paid Tier Optimization** - Efficient batch processing
- **429 Error Handling** - Automatic retry with exponential backoff
- **Token Budget Management** - Track usage and costs

---

## Rate Limit Tiers

### Free Tier (OpenRouter)

**Constraints**:
- 1 request per minute per API key
- No burst allowance
- 429 errors after limit exceeded

**Strategy**:
- Sequential processing within batches
- 60-second delays between batches
- Batch size: 3 chapters (optimal)

**Example Timeline**:
```
00:00 - Chapter 1 (analyze)
00:60 - Chapter 2 (analyze)
01:20 - Chapter 3 (analyze)
02:20 - Chapter 1 (extract elements)
02:80 - Chapter 2 (extract elements)
03:40 - Chapter 3 (extract elements)
...
```

**Total Time** (10 chapters):
- Parse: 1 minute (local)
- Analyze: 10 minutes (1 req/chapter × 60s)
- Extract: 10 minutes (1 req/chapter × 60s)
- Illustrate: 50 minutes (5 scenes/chapter × 60s)
- **Total**: ~71 minutes

### Paid Tier (OpenAI)

**Constraints**:
- Rate limit depends on account tier
- Tier 1: 500 requests/minute
- Tier 2: 3,500 requests/minute
- Token-based limits also apply

**Strategy**:
- Parallel processing within batches
- 2-second delays between batches
- Batch size: 5 chapters (optimal)

**Example Timeline**:
```
00:00 - Chapters 1-5 (analyze, parallel)
00:02 - Chapters 6-10 (analyze, parallel)
00:04 - Chapters 1-5 (extract, parallel)
00:06 - Chapters 6-10 (extract, parallel)
...
```

**Total Time** (10 chapters):
- Parse: 1 minute (local)
- Analyze: 4 seconds (2 batches × 2s)
- Extract: 4 seconds (2 batches × 2s)
- Illustrate: 40 seconds (10 batches × 2s, 5 scenes/chapter)
- **Total**: ~2 minutes (35x faster than free tier)

---

## Implementation

### Exponential Backoff

**Algorithm**:
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
      
      // Only retry on retryable errors
      if (!isRetryableError(error)) throw error;
      
      const delay = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 1000; // 0-1s jitter
      
      await sleep(delay + jitter);
    }
  }
  throw new Error('Max retries exceeded');
}
```

**Retry Delays**:
- Attempt 1: 2s + jitter
- Attempt 2: 4s + jitter
- Attempt 3: 8s + jitter
- Attempt 4: 16s + jitter
- Attempt 5: 32s + jitter

**Retryable Errors**:
- 429 - Too Many Requests
- 500 - Internal Server Error
- 502 - Bad Gateway
- 503 - Service Unavailable
- 504 - Gateway Timeout
- Network timeouts
- Connection errors

**Non-Retryable Errors**:
- 400 - Bad Request (client error)
- 401 - Unauthorized (invalid API key)
- 403 - Forbidden (insufficient permissions)
- 404 - Not Found (invalid endpoint)
- 422 - Unprocessable Entity (invalid input)

### Rate Limit Detection

**429 Response Handling**:
```typescript
async function handleRateLimitError(error: APIError): Promise<void> {
  if (error.status !== 429) return;
  
  // Check for Retry-After header
  const retryAfter = error.headers['retry-after'];
  
  if (retryAfter) {
    const delaySeconds = parseInt(retryAfter, 10);
    console.log(`⏳ Rate limited. Retrying after ${delaySeconds}s...`);
    await sleep(delaySeconds * 1000);
  } else {
    // Fallback: 60s delay for free tier
    console.log('⏳ Rate limited. Waiting 60s before retry...');
    await sleep(60000);
  }
}
```

**Retry-After Header**:
- Standard: Number of seconds to wait
- Example: `Retry-After: 60`
- Used by OpenAI and OpenRouter

### Batch Processing

**Sequential Batching (Free Tier)**:
```typescript
async function processBatchSequential(
  chapters: Chapter[],
  batchSize: number = 3,
  batchDelay: number = 60000
): Promise<void> {
  for (let i = 0; i < chapters.length; i += batchSize) {
    const batch = chapters.slice(i, i + batchSize);
    
    // Process chapters sequentially within batch
    for (const chapter of batch) {
      await processChapter(chapter);
      await sleep(60000); // 60s between each chapter
    }
    
    // No delay after last batch
    if (i + batchSize < chapters.length) {
      console.log(`⏳ Batch delay: ${batchDelay / 1000}s`);
      await sleep(batchDelay);
    }
  }
}
```

**Parallel Batching (Paid Tier)**:
```typescript
async function processBatchParallel(
  chapters: Chapter[],
  batchSize: number = 5,
  batchDelay: number = 2000
): Promise<void> {
  for (let i = 0; i < chapters.length; i += batchSize) {
    const batch = chapters.slice(i, i + batchSize);
    
    // Process chapters in parallel within batch
    await Promise.all(batch.map(chapter => processChapter(chapter)));
    
    // Delay between batches
    if (i + batchSize < chapters.length) {
      await sleep(batchDelay);
    }
  }
}
```

### Request Timing

**Free Tier Timing**:
```typescript
interface FreeTierConfig {
  requestDelay: 60000;      // 60s between requests
  batchSize: 3;             // 3 chapters per batch
  batchDelay: 60000;        // 60s between batches
  maxRetries: 5;            // Max retry attempts
  baseDelay: 2000;          // Initial backoff delay
}
```

**Paid Tier Timing**:
```typescript
interface PaidTierConfig {
  requestDelay: 0;          // No delay between requests
  batchSize: 5;             // 5 chapters per batch
  batchDelay: 2000;         // 2s between batches
  maxRetries: 3;            // Max retry attempts
  baseDelay: 1000;          // Initial backoff delay
}
```

---

## Error Handling

### 429 Too Many Requests

**Automatic Retry**:
1. Detect 429 status code
2. Extract Retry-After header
3. Wait specified duration
4. Retry request
5. Update retry counter

**User Feedback**:
```
⚠️  Rate limit reached

The API provider has rate-limited your requests.
Waiting 60 seconds before retry (attempt 2/5)...

Tip: Use OpenRouter for higher free tier limits
```

**State Preservation**:
- Save state before retry
- Resume from failed chapter
- Track retry attempts in state

### Timeout Errors

**Request Timeout**:
```typescript
const timeout = 300000; // 5 minutes

const response = await Promise.race([
  fetch(url, { signal: AbortSignal.timeout(timeout) }),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
]);
```

**Timeout Handling**:
- Treat as retryable error
- Exponential backoff applies
- Save state before timeout

---

## Token Budget Management

### Token Estimation

**Text Model Tokens**:
```typescript
function estimateTokens(text: string): number {
  // GPT-3.5/GPT-4: ~4 chars per token
  return Math.ceil(text.length / 4);
}
```

**Input Tokens** (per chapter):
- Chapter content: ~3,000 tokens
- System prompt: ~500 tokens
- Few-shot examples: ~1,000 tokens
- **Total**: ~4,500 tokens/request

**Output Tokens** (per chapter):
- Scene descriptions: ~2,000 tokens
- Element extraction: ~1,500 tokens
- **Total**: ~3,500 tokens/request

**Total Tokens** (per chapter):
- Input: ~4,500 tokens
- Output: ~3,500 tokens
- **Total**: ~8,000 tokens/chapter

### Cost Estimation

**OpenAI Pricing** (GPT-4o-mini):
- Input: $0.15 / 1M tokens
- Output: $0.60 / 1M tokens

**Per Chapter Cost**:
- Input: 4,500 × $0.15 / 1M = $0.000675
- Output: 3,500 × $0.60 / 1M = $0.002100
- **Total**: ~$0.0028/chapter

**10-Chapter Book**:
- Chapters: 10 × $0.0028 = $0.028
- Images: 50 scenes × $0.04 = $2.00
- **Total**: ~$2.03

**OpenRouter Pricing** (Free Tier):
- Text: Free (Claude 3.5 Sonnet)
- Images: Free (FLUX 1.1 Pro)
- **Total**: $0.00

### Token Tracking

**State File Tracking**:
```json
{
  "tokenStats": {
    "totalUsed": 125000,
    "byPhase": {
      "analyze": 45000,
      "extract": 35000,
      "illustrate": 45000
    },
    "estimatedCost": 2.03
  }
}
```

**Real-Time Tracking**:
```typescript
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

function trackTokens(usage: TokenUsage): void {
  state.tokenStats.totalUsed += usage.totalTokens;
  state.tokenStats.byPhase[currentPhase] += usage.totalTokens;
  
  // Update cost estimate
  const inputCost = usage.inputTokens * 0.15 / 1_000_000;
  const outputCost = usage.outputTokens * 0.60 / 1_000_000;
  state.tokenStats.estimatedCost += inputCost + outputCost;
}
```

---

## Monitoring and Logging

### Progress Tracking

**Console Output**:
```
📊 Progress: Analyze Phase
   ├─ Chapter 1/10 ✅ (4,234 tokens)
   ├─ Chapter 2/10 ✅ (3,892 tokens)
   ├─ Chapter 3/10 ⏳ (retrying after rate limit)
   └─ ...

⏱️  Estimated Time: 8 minutes remaining
💰 Token Usage: 12,450 / ~80,000 estimated ($0.15)
```

### Error Logging

**Log File**: `illustrate_BOOKNAME/error.log`

**Error Entry**:
```
[2025-11-14 15:30:45] ERROR - Rate Limit Exceeded
  Phase: analyze
  Chapter: 3
  Status: 429
  Retry-After: 60s
  Attempt: 2/5
  Action: Waiting 60s before retry
```

---

## Configuration

### Rate Limit Settings

**Config File** (`.imaginize.config`):
```json
{
  "rateLimit": "free",
  "concurrent": false,
  "maxConcurrency": 3,
  "requestDelay": 60000,
  "batchDelay": 60000,
  "maxRetries": 5
}
```

**CLI Flags**:
```bash
# Free tier
imaginize book.epub --rate-limit free

# Paid tier
imaginize book.epub --rate-limit paid

# Custom delays
imaginize book.epub --request-delay 2000 --batch-delay 5000

# Max retries
imaginize book.epub --max-retries 10
```

---

## Best Practices

### Free Tier Optimization

1. **Use Concurrent Mode**:
   ```bash
   imaginize book.epub --concurrent --max-concurrency 3
   ```
   - Process 3 chapters in parallel
   - Each with 60s delays
   - 3x faster than sequential

2. **Resume from Failures**:
   ```bash
   imaginize --continue
   ```
   - Don't restart from beginning
   - Resume from last successful chapter

3. **Retry Failed Chapters**:
   ```bash
   imaginize --retry-failed
   ```
   - Only retry failed chapters
   - Skip successful ones

### Paid Tier Optimization

1. **Increase Batch Size**:
   ```bash
   imaginize book.epub --max-concurrency 10
   ```
   - Process more chapters in parallel
   - Faster completion

2. **Reduce Delays**:
   ```bash
   imaginize book.epub --batch-delay 1000
   ```
   - Minimize time between batches
   - Ensure no rate limiting

3. **Monitor Token Usage**:
   ```bash
   imaginize book.epub --track-tokens
   ```
   - Real-time cost estimates
   - Budget management

---

## Related Documentation

- [Error Recovery](./error-recovery.md) - Error handling strategies
- [Concurrent Processing](./concurrent-processing.md) - Parallel execution
- [Provider Detection](./provider-detection.md) - API configuration

---

**Status**: Complete ✅
**Last Updated**: 2025-11-14
**Free Tier**: 1 req/min (60s delays)
**Paid Tier**: 500+ req/min (2s delays)
