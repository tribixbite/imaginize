# AI Integration Specification

## Overview

imaginize integrates with multiple AI providers through the OpenAI SDK interface, supporting text generation, image generation, and vision analysis. The system includes automatic retry logic, rate limit handling, and provider-specific optimizations.

## Supported Providers

### 1. OpenRouter
**Endpoint**: `https://openrouter.ai/api/v1`
**API Key Format**: `sk-or-v1-...`

**Advantages**:
- 100% free tier available
- Multiple model options
- Automatic model routing
- Pay-as-you-go pricing

**Recommended Models**:
```yaml
# Text Generation (Free)
model: "google/gemini-2.0-flash-exp:free"
# Rate limit: 1 req/min
# Context: 1M tokens
# Cost: $0.00

# Image Generation (Free)
imageEndpoint:
  model: "google/gemini-2.5-flash-image"
# Resolution: 1024x1024
# Cost: $0.00
```

**Configuration**:
```yaml
apiKey: "sk-or-..."
baseUrl: "https://openrouter.ai/api/v1"
model: "google/gemini-2.0-flash-exp:free"
imageEndpoint:
  model: "google/gemini-2.5-flash-image"
```

### 2. OpenAI
**Endpoint**: `https://api.openai.com/v1`
**API Key Format**: `sk-...`

**Advantages**:
- Highest quality models
- Fast response times
- No rate limits (paid tier)
- Best image quality (DALL-E 3)

**Recommended Models**:
```yaml
# Text Generation
model: "gpt-4o-mini"
# Context: 128k tokens
# Cost: $0.15 input / $0.60 output per 1M tokens

# Best Quality
model: "gpt-4o"
# Context: 128k tokens
# Cost: $2.50 input / $10.00 output per 1M tokens

# Image Generation
imageEndpoint:
  model: "dall-e-3"
# Resolution: 1024x1024, 1792x1024, 1024x1792
# Quality: standard ($0.040), hd ($0.080)
```

**Configuration**:
```yaml
apiKey: "sk-..."
baseUrl: "https://api.openai.com/v1"
model: "gpt-4o-mini"
imageEndpoint:
  model: "dall-e-3"
imageQuality: "hd"
```

### 3. Local LLMs
**Endpoints**: Ollama, LM Studio, LocalAI, etc.
**API Key**: Optional (depends on setup)

**Supported Models**:
- Any OpenAI-compatible endpoint
- Llama, Mistral, Mixtral, etc.
- Text-only (no image generation)

**Configuration**:
```yaml
baseUrl: "http://localhost:1234/v1"
model: "llama3-8b-instruct"
imageEndpoint:
  apiKey: "sk-..."  # Use OpenAI/OpenRouter for images
  baseUrl: "https://api.openai.com/v1"
  model: "dall-e-3"
```

**Advantages**:
- No API costs for text
- Full privacy (local processing)
- Unlimited requests
- Custom fine-tuned models

**Limitations**:
- No native image generation
- Slower than cloud APIs
- Requires local GPU/CPU resources

## API Integration Architecture

### OpenAI SDK Integration
```typescript
import OpenAI from 'openai';

// Initialize client
const client = new OpenAI({
  apiKey: config.apiKey,
  baseURL: config.baseUrl,
});

// Text generation
const response = await client.chat.completions.create({
  model: config.model,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  temperature: 0.7,
  max_tokens: 4000,
});

// Image generation
const imageResponse = await client.images.generate({
  model: config.imageEndpoint.model,
  prompt: enhancedPrompt,
  n: 1,
  size: '1024x1024',
  quality: 'standard',
});
```

### Provider-Specific Handling

#### OpenRouter Image Generation
```typescript
// OpenRouter uses different response format
const response = await client.chat.completions.create({
  model: 'google/gemini-2.5-flash-image',
  messages: [{ role: 'user', content: prompt }],
  modalities: ['image', 'text'],  // Required for OpenRouter
  n: 1,
});

// Extract image URL from response
const imageUrl = response.choices[0]?.message?.images?.[0]?.image_url?.url;
```

#### GPT-4 Vision Analysis
```typescript
// Style guide analysis
const response = await client.chat.completions.create({
  model: 'gpt-4-vision-preview',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Analyze the visual style...' },
      { type: 'image_url', image_url: { url: imageUrl } }
    ]
  }],
  max_tokens: 1000,
});
```

## Retry Logic & Error Handling

### Exponential Backoff
```typescript
// src/lib/retry-utils.ts
interface RetryOptions {
  maxRetries: number;      // Default: 10
  initialTimeout: number;   // Default: 2000ms
  maxTimeout: number;      // Default: 120000ms
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let timeout = options.initialTimeout;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Check if retryable
      if (!isRetryableError(error) || attempt === options.maxRetries) {
        throw error;
      }

      // Rate limit: wait 65s
      if (isRateLimitError(error)) {
        await sleep(65000);
      } else {
        await sleep(timeout);
        timeout = Math.min(timeout * 2, options.maxTimeout);
      }
    }
  }
}
```

### Rate Limit Detection
```typescript
function isRateLimitError(error: unknown): boolean {
  const err = error as RetryableError;

  // Check HTTP 429 status
  if (err.status === 429 || err.code === 429) {
    return true;
  }

  // Check error message
  const message = err.message?.toLowerCase() || '';
  return message.includes('rate limit') ||
         message.includes('too many requests') ||
         message.includes('free-models-per-min');
}
```

### Retryable Errors
```typescript
function isRetryableError(error: unknown): boolean {
  const err = error as RetryableError;

  // HTTP status codes
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  if (err.status && retryableStatuses.includes(err.status)) {
    return true;
  }

  // Network errors
  const retryableCodes = [
    'ECONNRESET', 'ENOTFOUND', 'ESOCKETTIMEDOUT',
    'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH'
  ];
  if (typeof err.code === 'string' && retryableCodes.includes(err.code)) {
    return true;
  }

  return false;
}
```

### Rate Limit Handling

**Free Tier (OpenRouter)**:
- Rate limit: 1 request/minute
- Detection: 429 status or "free-models-per-min" message
- Strategy: Wait 65 seconds (slightly > 60s limit)
- Max retries: 10
- Auto-resume: Yes

**Example Output**:
```
⏳ Rate limit hit for analyze chapter 11. Waiting 65s before retry 1/10...
⏳ Retry 1/10 in 60s...
⏳ Retry 1/10 in 30s...
✓ Chapter 11 completed after retry
```

**Paid Tier**:
- Rate limit: Much higher (varies by model)
- Retry delay: 2s exponential backoff
- Max retries: 3
- Rarely hits limits

## Prompt Engineering

### System Prompts

#### Analysis Phase - Entity Extraction (Pass 1)
```typescript
const systemPrompt = `You are analyzing a book chapter to extract story elements.

ENTITY TYPES:
- Characters: People in the story
- Creatures: Animals, monsters, magical beings
- Places: Locations, settings, buildings
- Items: Important objects, artifacts, tools

REQUIREMENTS:
- Extract 5-15 entities per chapter
- VISUAL descriptions only (age, appearance, clothing)
- Physical details: hair, eyes, build, clothing colors
- Creature details: size, color, teeth, claws, fur
- Brief but vivid (1-2 sentences per entity)

OUTPUT FORMAT:
{
  "entities": [
    {
      "name": "Christopher",
      "type": "character",
      "description": "A young boy with tall, gangly build, wearing a long navy wool overcoat..."
    }
  ]
}`;
```

#### Analysis Phase - Full Analysis (Pass 2)
```typescript
const systemPrompt = `You are analyzing a book chapter for illustration.

You have access to a catalog of entities (characters, creatures, places, items) from this book. Cross-reference these entities in your visual descriptions.

REQUIREMENTS:
- Extract 1-3 visual scenes suitable for illustration
- Include 3-8 sentence quotes (50-150 words) with full context
- Identify mood (tense, whimsical, ominous, peaceful, etc.)
- Identify lighting (sunrise, night with moonlight, stormy afternoon, etc.)
- Cross-reference characters with entity catalog

ENTITY CATALOG:
[entities from Elements.md]

OUTPUT FORMAT:
{
  "concepts": [
    {
      "quote": "[3-8 sentence quote from book]",
      "description": "[Standalone visual description for illustration]",
      "mood": "tense",
      "lighting": "late afternoon, golden hour",
      "entities": ["Christopher", "Black Doglike Creature"]
    }
  ]
}`;
```

#### Illustrate Phase - Image Generation
```typescript
const imagePrompt = `GENRE: Fantasy
STYLE: ${styleGuide || 'Detailed digital illustration'}
MOOD: ${concept.mood}
LIGHTING: ${concept.lighting}

SCENE: ${concept.description}

CHARACTERS:
${characterDescriptions}

TECHNICAL REQUIREMENTS:
- High detail, professional illustration quality
- 1024x1024 resolution
- No text overlays in image
- Consistent with previous scenes
- ${styleGuide ? 'Match established visual style' : 'Establish visual style'}`;
```

### Prompt Optimization

**Token Reduction**:
- Entity extraction: Use cheap model (gpt-4o-mini)
- Full analysis: Include only relevant entities
- Image prompts: Focus on visual details only

**Quality Improvement**:
- Explicit requirements (3-8 sentences, 50-150 words)
- Examples in system prompts
- Structured output format (JSON)
- Cross-reference entity catalog

## Token Management

### Estimation
```typescript
// Rough estimation: ~4 characters per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Model-specific limits
const MODEL_LIMITS = {
  'gpt-4o-mini': 128000,
  'gpt-4o': 128000,
  'google/gemini-2.0-flash-exp:free': 1000000,
  'claude-3-5-sonnet': 200000,
};
```

### Chapter Splitting
```typescript
// Auto-split chapters exceeding token limits
if (estimatedTokens > maxTokens * tokenSafetyMargin) {
  const chunks = splitChapterIntoChunks(
    chapterText,
    maxTokensPerChunk,
    overlapTokens
  );

  // Process each chunk separately
  const results = await Promise.all(
    chunks.map(chunk => analyzeChunk(chunk))
  );

  // Merge results
  return mergeChunkResults(results);
}
```

### Cost Tracking
```typescript
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

function calculateCost(usage: TokenUsage, model: ModelConfig): number {
  const inputCost = (usage.inputTokens / 1_000_000) * model.inputCost;
  const outputCost = (usage.outputTokens / 1_000_000) * model.outputCost;
  return inputCost + outputCost;
}
```

## Performance Optimization

### Concurrent Requests
```typescript
// Batch processing with controlled concurrency
const batchSize = modelStr.includes('free') ? 1 : 3;

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  await Promise.all(batch.map(item => processItem(item)));

  // Inter-batch delay (rate limit management)
  if (i + batchSize < items.length) {
    await sleep(2000);
  }
}
```

### Caching
```typescript
// Cache entity catalog to avoid repeated parsing
let cachedElements: BookElement[] | null = null;

async function getElements(): Promise<BookElement[]> {
  if (cachedElements) {
    return cachedElements;
  }

  cachedElements = await parseElementsFile();
  return cachedElements;
}
```

### Request Deduplication
```typescript
// Avoid duplicate requests for same content
const requestCache = new Map<string, Promise<any>>();

async function cachedRequest(key: string, fn: () => Promise<any>) {
  if (requestCache.has(key)) {
    return requestCache.get(key);
  }

  const promise = fn();
  requestCache.set(key, promise);

  try {
    return await promise;
  } finally {
    requestCache.delete(key);
  }
}
```

## Error Messages

### User-Friendly Errors
```typescript
function formatRetryError(
  error: Error,
  context: string,
  attempts: number
): string {
  const err = error as RetryableError;

  return `
❌ Error: Failed to ${context} after ${attempts} attempt(s)

${err.status ? `HTTP Status: ${err.status}\n` : ''}
${err.code ? `Error Code: ${err.code}\n` : ''}
Message: ${err.message}

Suggestions:
- Check API key is valid
- Ensure sufficient API credits
- Verify network connection
- Try again with --force flag
  `.trim();
}
```

### Common Error Scenarios

**Invalid API Key**:
```
❌ Error: Invalid API key
HTTP Status: 401

Suggestions:
- Set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable
- Or add apiKey to .imaginize.config
- Get API key from https://openrouter.ai or https://platform.openai.com
```

**Insufficient Credits**:
```
❌ Error: Insufficient credits
HTTP Status: 402

Suggestions:
- Add credits to your OpenAI account
- Or use OpenRouter free tier: OPENROUTER_API_KEY
```

**Model Not Found**:
```
❌ Error: Model not available
Message: Model 'gpt-5' does not exist

Suggestions:
- Check model name in .imaginize.config
- Use 'gpt-4o-mini' or 'gpt-4o' for OpenAI
- Use 'google/gemini-2.0-flash-exp:free' for OpenRouter
```

## Provider-Specific Features

### OpenRouter
**Site Name/URL** (for rankings):
```typescript
const client = new OpenAI({
  apiKey: config.apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/tribixbite/imaginize',
    'X-Title': 'imaginize - AI Book Illustration Tool'
  }
});
```

**Free Model Detection**:
```typescript
const isFreeModel = modelName.includes(':free') ||
                    modelName.includes('free-');

if (isFreeModel) {
  maxConcurrency = 1;  // Respect rate limits
  retryDelay = 65000;  // 65s for rate limits
}
```

### OpenAI
**Organization ID** (for multi-org accounts):
```typescript
const client = new OpenAI({
  apiKey: config.apiKey,
  organization: process.env.OPENAI_ORG_ID,
});
```

**Function Calling** (structured output):
```typescript
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  functions: [{
    name: 'extract_entities',
    parameters: {
      type: 'object',
      properties: {
        entities: {
          type: 'array',
          items: { ... }
        }
      }
    }
  }],
  function_call: { name: 'extract_entities' }
});
```

## Testing & Validation

### API Connection Test
```bash
# Test OpenRouter connection
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"

# Test OpenAI connection
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Model Availability
```typescript
async function validateModel(client: OpenAI, modelName: string): Promise<boolean> {
  try {
    const models = await client.models.list();
    return models.data.some(m => m.id === modelName);
  } catch (error) {
    console.warn('Could not validate model availability:', error);
    return true;  // Assume valid
  }
}
```

---

**See Also:**
- [Configuration System](./configuration.md)
- [Token Management](./token-management.md)
- [Pipeline Architecture](./pipeline-architecture.md)
- [Error Recovery](./error-recovery.md)
