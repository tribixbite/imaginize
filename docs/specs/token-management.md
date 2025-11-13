# Token Management Specification

## Overview

imaginize implements comprehensive token management to optimize API usage, prevent context window overflow, and provide accurate cost estimates. The system includes token estimation, automatic chapter splitting, model-specific limits, and detailed usage tracking.

## Token Estimation

### Basic Algorithm
```typescript
// src/lib/token-counter.ts

/**
 * Estimate tokens in text using character-based approximation
 * Rule of thumb: ~4 characters per token for English text
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Remove extra whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();

  // Estimate: 4 characters per token
  return Math.ceil(normalized.length / 4);
}
```

**Accuracy**: ±5% for English prose

**Why Character-Based?**
- Fast (no external dependencies)
- Consistent across models
- Good enough for splitting decisions
- Actual token count from API response used for billing

### Advanced Estimation
```typescript
export function estimateTokensDetailed(text: string): TokenEstimate {
  const baseTokens = estimateTokens(text);

  // Adjust for special characters
  const specialChars = (text.match(/[^\w\s]/g) || []).length;
  const specialTokens = Math.ceil(specialChars * 0.3);

  // Adjust for code blocks (if present)
  const codeBlocks = text.match(/```[\s\S]*?```/g) || [];
  const codeTokens = codeBlocks.reduce((sum, block) => {
    return sum + Math.ceil(block.length / 3); // Code: ~3 chars/token
  }, 0);

  return {
    estimated: baseTokens + specialTokens + codeTokens,
    confidence: 0.95,
    method: 'character-based',
  };
}
```

## Model Token Limits

### Model Configuration
```typescript
interface ModelConfig {
  name: string;
  contextWindow: number;      // Maximum context tokens
  inputCost: number;          // USD per 1M input tokens
  outputCost: number;         // USD per 1M output tokens
  supportsImages: boolean;
}

const MODEL_LIMITS: Record<string, ModelConfig> = {
  'gpt-4o': {
    name: 'gpt-4o',
    contextWindow: 128000,
    inputCost: 2.50,
    outputCost: 10.00,
    supportsImages: false,
  },
  'gpt-4o-mini': {
    name: 'gpt-4o-mini',
    contextWindow: 128000,
    inputCost: 0.15,
    outputCost: 0.60,
    supportsImages: false,
  },
  'google/gemini-2.0-flash-exp:free': {
    name: 'google/gemini-2.0-flash-exp:free',
    contextWindow: 1000000,
    inputCost: 0.00,
    outputCost: 0.00,
    supportsImages: false,
  },
  'claude-3-5-sonnet': {
    name: 'claude-3-5-sonnet',
    contextWindow: 200000,
    inputCost: 3.00,
    outputCost: 15.00,
    supportsImages: false,
  },
};
```

### Context Window Calculation
```typescript
export function getMaxInputTokens(
  modelName: string,
  reservedOutputTokens: number = 4000,
  safetyMargin: number = 0.9
): number {
  const config = MODEL_LIMITS[modelName];
  if (!config) {
    throw new Error(`Unknown model: ${modelName}`);
  }

  // Available tokens = context - reserved - safety margin
  const available = config.contextWindow - reservedOutputTokens;
  return Math.floor(available * safetyMargin);
}
```

**Example**:
```typescript
// GPT-4o-mini
getMaxInputTokens('gpt-4o-mini', 4000, 0.9);
// => 111,600 tokens
// (128000 - 4000) * 0.9 = 111,600

// Gemini 2.0 Flash
getMaxInputTokens('google/gemini-2.0-flash-exp:free', 4000, 0.9);
// => 896,400 tokens
// (1000000 - 4000) * 0.9 = 896,400
```

## Token Safety Margin

### Configuration
```yaml
# .imaginize.config
tokenSafetyMargin: 0.9  # Use 90% of available context
```

**Default**: `0.9` (90%)

**Why Safety Margin?**
- Account for estimation errors (±5%)
- Leave room for prompt templates
- Prevent hard limits (API errors)
- Allow buffer for system messages

### Margin Recommendations
```
0.95 (95%) - Aggressive, risk of overflow
0.90 (90%) - Recommended, good balance
0.85 (85%) - Conservative, safer for large books
0.80 (80%) - Very conservative, for unknown content
```

## Chapter Splitting

### Auto-Split Threshold
```yaml
# .imaginize.config
pagesPerAutoChapter: 50  # Split chapters longer than 50 pages
```

**Default**: `50` pages (~12,500 tokens)

### Splitting Algorithm
```typescript
export function splitChapterIntoChunks(
  chapterText: string,
  maxTokensPerChunk: number,
  overlapTokens: number = 200
): string[] {
  const totalTokens = estimateTokens(chapterText);

  // No split needed
  if (totalTokens <= maxTokensPerChunk) {
    return [chapterText];
  }

  // Split by paragraphs (preserve narrative flow)
  const paragraphs = chapterText.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    // Paragraph too large for one chunk
    if (paraTokens > maxTokensPerChunk) {
      // Save current chunk
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
        currentTokens = 0;
      }

      // Split paragraph by sentences
      chunks.push(...splitParagraph(para, maxTokensPerChunk));
      continue;
    }

    // Would exceed limit - start new chunk
    if (currentTokens + paraTokens > maxTokensPerChunk) {
      chunks.push(currentChunk);

      // Add overlap from previous chunk
      const overlap = getOverlap(currentChunk, overlapTokens);
      currentChunk = overlap + para + '\n\n';
      currentTokens = estimateTokens(currentChunk);
    } else {
      // Add to current chunk
      currentChunk += para + '\n\n';
      currentTokens += paraTokens;
    }
  }

  // Add final chunk
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}
```

**Features**:
- Preserves paragraph boundaries
- Maintains narrative flow
- Adds overlap between chunks for context
- Splits paragraphs by sentences if too large

### Overlap Strategy
```typescript
function getOverlap(text: string, targetTokens: number): string {
  const paragraphs = text.split(/\n\n+/);

  // Take last N paragraphs that fit in targetTokens
  let overlap = '';
  let tokens = 0;

  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const para = paragraphs[i];
    const paraTokens = estimateTokens(para);

    if (tokens + paraTokens > targetTokens) {
      break;
    }

    overlap = para + '\n\n' + overlap;
    tokens += paraTokens;
  }

  return overlap;
}
```

**Overlap Tokens**: `200` (default)

**Purpose**: Provide context continuity between chunks

## Token Counting

### Per-Phase Token Usage

#### Parse Phase
```typescript
// No API calls - no tokens used
```

#### Analyze Phase
```typescript
interface AnalyzeTokens {
  pass1: {
    inputTokens: number;      // Chapter text + prompt
    outputTokens: number;     // Entity JSON
    totalTokens: number;
  };
  pass2: {
    inputTokens: number;      // Chapter text + entities + prompt
    outputTokens: number;     // Scene descriptions JSON
    totalTokens: number;
  };
  total: number;
}

// Example for 83-chapter book
{
  pass1: {
    inputTokens: 1_250_000,   // ~15k per chapter
    outputTokens: 83_000,     // ~1k per chapter
    totalTokens: 1_333_000
  },
  pass2: {
    inputTokens: 1_500_000,   // ~18k per chapter (includes entities)
    outputTokens: 166_000,    // ~2k per chapter
    totalTokens: 1_666_000
  },
  total: 2_999_000            // ~3M tokens total
}
```

#### Extract Phase
```typescript
// Reads chapters from disk - no API calls
// Or minimal API calls for entity extraction (same as pass1)
```

#### Illustrate Phase
```typescript
interface IllustrateTokens {
  promptTokens: number;       // Image prompt tokens
  sceneCount: number;         // Number of images generated
  totalTokens: number;
}

// Example for 64 scenes
{
  promptTokens: 32_000,       // ~500 per scene
  sceneCount: 64,
  totalTokens: 32_000
}
```

### Actual Token Counting
```typescript
// Extract from API response
function extractTokenUsage(response: OpenAI.ChatCompletion): TokenUsage {
  return {
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
    totalTokens: response.usage?.total_tokens || 0,
  };
}

// Track across all requests
class TokenTracker {
  private totalInput = 0;
  private totalOutput = 0;

  record(usage: TokenUsage): void {
    this.totalInput += usage.inputTokens;
    this.totalOutput += usage.outputTokens;
  }

  getTotal(): TokenUsage {
    return {
      inputTokens: this.totalInput,
      outputTokens: this.totalOutput,
      totalTokens: this.totalInput + this.totalOutput,
    };
  }
}
```

## Cost Calculation

### Per-Request Cost
```typescript
function calculateRequestCost(
  usage: TokenUsage,
  model: ModelConfig
): number {
  const inputCost = (usage.inputTokens / 1_000_000) * model.inputCost;
  const outputCost = (usage.outputTokens / 1_000_000) * model.outputCost;

  return inputCost + outputCost;
}
```

### Cost Examples

#### OpenRouter Free Tier
```typescript
// Model: google/gemini-2.0-flash-exp:free
// Cost: $0.00 per 1M tokens (input + output)

// 83-chapter book
Analyze phase:
  Pass 1: 1,333,000 tokens × $0.00 = $0.00
  Pass 2: 1,666,000 tokens × $0.00 = $0.00
  Total: $0.00

Illustrate phase:
  64 images × $0.00 = $0.00

Total cost: $0.00
```

#### OpenAI GPT-4o-mini
```typescript
// Model: gpt-4o-mini
// Input: $0.15 per 1M tokens
// Output: $0.60 per 1M tokens

// 83-chapter book
Analyze phase:
  Pass 1 input:  1,250,000 tokens × $0.15 / 1M = $0.188
  Pass 1 output:    83,000 tokens × $0.60 / 1M = $0.050
  Pass 2 input:  1,500,000 tokens × $0.15 / 1M = $0.225
  Pass 2 output:   166,000 tokens × $0.60 / 1M = $0.100
  Subtotal: $0.563

Illustrate phase (DALL-E 3):
  64 images × $0.040 (standard) = $2.560

Total cost: $3.12
```

#### OpenAI GPT-4o (Best Quality)
```typescript
// Model: gpt-4o
// Input: $2.50 per 1M tokens
// Output: $10.00 per 1M tokens

// 83-chapter book
Analyze phase:
  Pass 1 input:  1,250,000 tokens × $2.50 / 1M = $3.125
  Pass 1 output:    83,000 tokens × $10.00 / 1M = $0.830
  Pass 2 input:  1,500,000 tokens × $2.50 / 1M = $3.750
  Pass 2 output:   166,000 tokens × $10.00 / 1M = $1.660
  Subtotal: $9.365

Illustrate phase (DALL-E 3 HD):
  64 images × $0.080 (hd) = $5.120

Total cost: $14.49
```

### Cost Tracking
```typescript
interface CostBreakdown {
  analyze: {
    pass1: { input: number; output: number; total: number };
    pass2: { input: number; output: number; total: number };
    total: number;
  };
  illustrate: {
    images: number;
    total: number;
  };
  grandTotal: number;
}

function generateCostReport(
  tokenUsage: TokenUsage,
  imageCount: number,
  config: IllustrateConfig
): CostBreakdown {
  const textModel = resolveModelConfig(config.model, config);
  const imageModel = config.imageEndpoint?.model || 'dall-e-3';

  const analyzePass1Cost = calculateCost(tokenUsage.pass1, textModel);
  const analyzePass2Cost = calculateCost(tokenUsage.pass2, textModel);

  const imageUnitCost = getImageCost(imageModel, config.imageQuality);
  const imageTotalCost = imageCount * imageUnitCost;

  return {
    analyze: {
      pass1: analyzePass1Cost,
      pass2: analyzePass2Cost,
      total: analyzePass1Cost.total + analyzePass2Cost.total,
    },
    illustrate: {
      images: imageCount,
      total: imageTotalCost,
    },
    grandTotal: analyzePass1Cost.total + analyzePass2Cost.total + imageTotalCost,
  };
}
```

## Usage Tracking

### Progress Tracker Integration
```typescript
// src/lib/progress-tracker.ts

class ProgressTracker extends EventEmitter {
  private tokenUsage: {
    analyze: { pass1: TokenUsage; pass2: TokenUsage };
    illustrate: TokenUsage;
  };

  recordTokens(phase: Phase, subPhase: SubPhase, usage: TokenUsage): void {
    if (phase === 'analyze') {
      this.tokenUsage.analyze[subPhase].inputTokens += usage.inputTokens;
      this.tokenUsage.analyze[subPhase].outputTokens += usage.outputTokens;
      this.tokenUsage.analyze[subPhase].totalTokens += usage.totalTokens;
    }

    // Emit stats event
    this.emit('stats', {
      tokensUsed: this.getTotalTokens(),
      estimatedCost: this.getEstimatedCost(),
    });
  }

  getTotalTokens(): number {
    return (
      this.tokenUsage.analyze.pass1.totalTokens +
      this.tokenUsage.analyze.pass2.totalTokens +
      this.tokenUsage.illustrate.totalTokens
    );
  }
}
```

### Real-Time Display
```
## Analyze Phase

✓ Pass 1: Entity extraction (83/83 chapters)
  ↳ Tokens: 1,333,000 (input: 1,250,000 | output: 83,000)
  ↳ Cost: $0.188

⏳ Pass 2: Full analysis (45/83 chapters, 54.2%)
  ↳ Tokens: 950,000 (estimated total: 1,666,000)
  ↳ Cost: $0.195 (estimated total: $0.325)
  ↳ ETA: 8m 32s

Total tokens so far: 2,283,000
Estimated total cost: $0.513
```

### Final Report
```typescript
// Written to progress.md
## Token Usage Summary

### Analyze Phase
- **Pass 1 (Entity Extraction)**
  - Input tokens: 1,250,000
  - Output tokens: 83,000
  - Total: 1,333,000 tokens
  - Cost: $0.188

- **Pass 2 (Full Analysis)**
  - Input tokens: 1,500,000
  - Output tokens: 166,000
  - Total: 1,666,000 tokens
  - Cost: $0.325

- **Analyze Total**: 2,999,000 tokens ($0.513)

### Illustrate Phase
- **Image Generation**
  - Prompt tokens: 32,000
  - Images generated: 64
  - Cost: $2.560

### Grand Total
- **Total tokens**: 3,031,000
- **Total cost**: $3.07
- **Model**: gpt-4o-mini + dall-e-3
- **Processing time**: 2h 15m
```

## Token Optimization Strategies

### 1. Use Cheaper Models for Simple Tasks
```yaml
# Use free/cheap model for entity extraction (pass 1)
model: "google/gemini-2.0-flash-exp:free"

# Use expensive model only for final analysis (pass 2)
# (future feature - per-phase model selection)
```

### 2. Adjust pagesPerImage
```yaml
# More scenes/images = higher cost
pagesPerImage: 5   # More granular, higher cost

# Fewer scenes/images = lower cost
pagesPerImage: 15  # Less granular, lower cost
```

**Cost Impact**:
```
pagesPerImage: 5  → ~128 images → $5.12 (DALL-E 3)
pagesPerImage: 10 → ~64 images  → $2.56 (DALL-E 3)
pagesPerImage: 15 → ~43 images  → $1.72 (DALL-E 3)
```

### 3. Use Local LLM for Text
```yaml
# Local LLM for text (no cost)
baseUrl: "http://localhost:1234/v1"
model: "local-llama-3-8b"

# Cloud API only for images
imageEndpoint:
  apiKey: "sk-..."
  baseUrl: "https://api.openai.com/v1"
  model: "dall-e-3"
```

**Cost Savings**: ~$0.50 per book (text analysis)

### 4. Free Tier for Everything
```yaml
# 100% free tier
apiKey: "sk-or-..."
model: "google/gemini-2.0-flash-exp:free"
imageEndpoint:
  model: "google/gemini-2.5-flash-image"
```

**Cost**: $0.00 per book

**Trade-off**: Rate limits (1 req/min), slower processing

## Token Limits Error Handling

### Detection
```typescript
function isTokenLimitError(error: unknown): boolean {
  const err = error as RetryableError;

  // Check error message
  const message = err.message?.toLowerCase() || '';
  return (
    message.includes('maximum context length') ||
    message.includes('context_length_exceeded') ||
    message.includes('token limit')
  );
}
```

### Recovery Strategy
```typescript
async function handleTokenLimitError(
  chapterText: string,
  maxTokens: number
): Promise<string[]> {
  console.warn('⚠️  Chapter exceeds token limit, splitting...');

  // Split into smaller chunks
  const chunks = splitChapterIntoChunks(
    chapterText,
    Math.floor(maxTokens * 0.8),  // 80% of limit for safety
    200  // Overlap tokens
  );

  console.log(`   Split into ${chunks.length} chunks`);
  return chunks;
}
```

### User Warning
```
⚠️  Warning: Chapter 42 is very long (25,000 tokens)

This chapter will be automatically split into 3 chunks for processing.
Results will be merged automatically.

To avoid splitting, consider:
  - Using a model with larger context (e.g., Gemini 2.0: 1M tokens)
  - Increasing tokenSafetyMargin in config
```

## Performance Impact

### Token Estimation Overhead
- **Per-chapter**: <1ms
- **Full book (83 chapters)**: ~50ms
- **Negligible** compared to API latency (1-5s per request)

### Splitting Overhead
- **Per-chapter**: 5-10ms
- **Rare**: Only when chapter exceeds limit (<5% of chapters)
- **Worth it**: Prevents API errors, maintains processing flow

---

**See Also:**
- [AI Integration](./ai-integration.md) - API usage and retry logic
- [Configuration](./configuration.md) - tokenSafetyMargin setting
- [Cost Optimization](./cost-optimization.md) - Reduce API costs
