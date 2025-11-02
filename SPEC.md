# illustrate - Technical Specification v2.0

## Overview
Production-ready AI-powered book illustration guide generator with granular phase control, multi-provider support, and robust state management.

---

## 1. Configuration System

### 1.1 Token Limit Management
**Q:** Should the tool calculate token estimates before making API calls?
**A:** Yes, with the following defaults:
- Default to current OpenAI standard limits
- Break down chapters for processing accordingly
- Track page count to token count ratio in progress.md
- Prevent repeat work/discovery
- Use high-context, cheap model by default for initial text processing
- Automatic splitting as needed with sane defaults

**Implementation:**
- Default model: High-context, cheap (e.g., `gpt-4o-mini` or free OpenRouter model)
- Default max tokens per request: 4096 for completion
- Context window: Model-specific (128k for gpt-4o, configurable)
- Token estimation: ~4 chars per token (conservative)
- Safety margin: 90% of max context to avoid edge cases

### 1.2 OpenRouter Integration
**Q:** How to support OpenRouter.ai?
**A:**
- Support OpenRouter's model routing syntax (e.g., `openai/gpt-4o`, `anthropic/claude-3.5-sonnet`)
- Model config includes context length param
- Per-phase model selection support

**Implementation:**
```yaml
# .illustrate.config
baseUrl: "https://openrouter.ai/api/v1"
apiKey: "sk-or-v1-..."
model:
  name: "anthropic/claude-3.5-sonnet"
  contextLength: 200000
  maxTokens: 4096
```

### 1.3 Provider Detection & Image Endpoint
**Q:** How to handle providers without image generation?
**A:**
- Detect provider from baseUrl automatically
- For providers without image support:
  - Offer to use OpenAI for images only
  - Prompt for API token if not found in env vars or CLI arg
  - Support provider-specific and dedicated 'for images' endpoint

**Implementation:**
```typescript
// Auto-detect from URL
openrouter.ai → 'openrouter'
api.openai.com → 'openai'
other → 'custom'

// Separate image endpoint
imageEndpoint: {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "sk-...",
  model: "dall-e-3"
}
```

**Environment Variables (Priority Order):**
1. CLI arguments (highest)
2. `OPENROUTER_API_KEY` (for text, preferred)
3. `OPENAI_API_KEY` (fallback/images)
4. Config file
5. Interactive prompt (last resort)

---

## 2. State Management

### 2.1 Progress File Schema
**Q:** How to track progress?
**A:** Dual-file system:
- `progress.md` - Human-readable markdown
- `.illustrate.state.json` - Machine-readable state

**Granularity:** High enough to resume without repeating API calls
- Chapter-level status
- Concept-level status per chapter
- Element-level status
- Token count tracking per section
- Page-to-token ratio calculation

**Navigation:** Machine-readable ToC/navigation system to avoid eating entire context when resuming

**State JSON Schema:**
```json
{
  "version": "2.0.0",
  "bookFile": "ImpossibleCreatures.epub",
  "bookTitle": "Impossible Creatures",
  "totalPages": 342,
  "avgTokensPerPage": 285,
  "phases": {
    "parse": {
      "status": "completed",
      "completedAt": "2025-11-02T10:30:00Z"
    },
    "analyze": {
      "status": "in_progress",
      "chapters": {
        "1": {
          "status": "completed",
          "concepts": 3,
          "tokensUsed": 8234,
          "completedAt": "2025-11-02T10:35:00Z"
        },
        "2": {
          "status": "in_progress",
          "concepts": 1,
          "tokensUsed": 3421
        }
      }
    },
    "extract": { "status": "pending" },
    "illustrate": { "status": "pending" }
  },
  "toc": {
    "chapters": [
      { "number": 1, "title": "Beginning", "pages": "1-15" },
      { "number": 2, "title": "Discovery", "pages": "16-32" }
    ]
  },
  "tokenStats": {
    "totalUsed": 11655,
    "estimatedRemaining": 234000
  }
}
```

### 2.2 Resume Behavior
**Q:** How to handle resuming partial progress?
**A:**
- Do NOT redo or repeat stored progress
- If discrepancy discovered (e.g., progress says chapters 1-5 done but they're empty):
  - Prompt user to run `--force` with `--chapters` filter
  - Restrict to only missing content
- Schema mismatch: Alert user to update and use `--migrate` command
- Continue: Skip completed API calls, use cached results
- No re-validation unless `--force` flag used

**Implementation:**
1. Check for `illustrate_*` folder
2. Check for `progress.md` and `.illustrate.state.json`
3. If found and partial:
   - Display current phase/step
   - Ask: "Continue from [phase: analyze, chapter 2/10]? (y/n)"
   - If yes: Load state, resume from last incomplete task
   - If no: Offer `--force` to restart or exit

---

## 3. Command Structure

### 3.1 Phase-Based Commands

**Phases:**
1. **parse** - Extract text from EPUB/PDF
2. **analyze** - Generate Contents.md (quotes/concepts per chapter)
3. **extract** - Generate Elements.md (characters/places/items)
4. **illustrate** - Generate images

**Commands:**
```bash
# Full pipeline (all phases)
npx illustrate

# Specific phases
npx illustrate --text              # analyze phase only
npx illustrate --elements          # extract phase only
npx illustrate --images            # illustrate phase only

# Combined
npx illustrate --text --elements   # both phases
```

### 3.2 Chapter Selection
**Q:** How does `--chapters 2,4` work?
**A:**
- Chapter 1 = first chapter (NOT index 0)
- Support ranges: `--chapters 1-5,10`
- If no chapters detected: Use page numbers as chapters
  - Default: 50 pages per auto-chapter (configurable via `pagesPerAutoChapter`)
  - Token-aware: Adjust based on tokens-per-page ratio

**Examples:**
```bash
# Specific chapters
npx illustrate --text --chapters 2,4

# Range
npx illustrate --text --chapters 1-5

# Mixed
npx illustrate --text --chapters 1-3,7,10-12

# Images for specific chapters
npx illustrate --images --chapters 2,4
# Error if Contents.md missing quotes → suggests:
# "Run: npx illustrate --text --chapters 2,4"
```

### 3.3 Element Selection
**Q:** How to select specific elements?
**A:**
- Strip whitespace, convert to lowercase for matching
- Support wildcards: `--elements "character:*"` for all characters
- Case-insensitive with fuzzy search tolerance

**Examples:**
```bash
# Specific elements
npx illustrate --images --elements "aria, dragon"

# Wildcards
npx illustrate --images --elements "character:*"
npx illustrate --images --elements "*:dragon*"  # any type containing "dragon"

# Mixed
npx illustrate --elements "character:aria, place:*"
```

**Element Syntax:**
- `name` - Match any type
- `type:name` - Match specific type
- `type:*` - All of type
- `*:pattern` - Any type matching pattern

### 3.4 Multi-File Selection
**Q:** How to handle multiple EPUB files?
**A:** Interactive numbered list with file metadata

**Implementation:**
```
Multiple book files found:

1. ImpossibleCreatures.epub (26 MB, modified: 2025-11-02)
2. AnotherBook.epub (15 MB, modified: 2025-10-15)
3. ThirdBook.epub (32 MB, modified: 2025-09-01)

Select a file to process (1-3): _
```

---

## 4. Error Handling & Recovery

### 4.1 Retry Logic
**Q:** How to handle API failures?
**A:**
- Save partial results after each successful call
- Retry default: Once per call
- Increased timeout on retry
- Exponential backoff
- Always alert user on full failure with error details

**Implementation:**
```typescript
maxRetries: 1                    // default
retryTimeout: 5000              // 5s initial
retryBackoff: exponential       // 5s, 10s, 20s...
savePartial: true               // after each success
```

**Error Message Format:**
```
❌ Error: Failed to analyze chapter 3 after 2 attempts

API Error: Rate limit exceeded (429)
Last retry delay: 10000ms

Partial progress saved. You can:
1. Wait and run: npx illustrate --continue
2. Skip this chapter: npx illustrate --text --chapters 1-2,4-10
3. Use different model: npx illustrate --model "gpt-4o-mini"
```

### 4.2 Validation & Force
**Q:** How to handle inconsistent state?
**A:**
```bash
# State says done but Contents.md is empty
⚠️  Warning: State mismatch detected
Progress shows chapters 1-5 completed, but Contents.md is missing data.

Run: npx illustrate --force --text --chapters 1-5
```

---

## 5. Testing Strategy

### 5.1 Test Framework
**Q:** Which test framework?
**A:** Bun test system

**Test File:** `test/pipeline.test.ts`

### 5.2 Test Scope
**Q:** Real API or mocked?
**A:**
- Real API calls
- Default to `OPENROUTER_API_KEY` env var
- Use high-quality free model for text
- Use free image model if available
- Test only a couple chapters to minimize cost

**Free Models (OpenRouter):**
- Text: `meta-llama/llama-3.2-3b-instruct:free`
- Text (better): `google/gemini-flash-1.5:free`
- Images: `black-forest-labs/flux-schnell:free` (if supported)

### 5.3 Test Pipeline
**Q:** What to test?
**A:** Full pipeline with ImpossibleCreatures.epub:

```typescript
describe('illustrate pipeline', () => {
  test('1. Generate text for 1 chapter', async () => {
    // npx illustrate --text --chapters 1
  });

  test('2. Generate text for 2 chapters', async () => {
    // npx illustrate --text --chapters 1-2
  });

  test('3. Extract specific targeted element', async () => {
    // npx illustrate --elements
    // Then verify element extraction
  });

  test('4. Generate images for 1 chapter', async () => {
    // npx illustrate --images --chapters 1
  });

  test('5. Generate image for an element', async () => {
    // npx illustrate --images --elements "character:*" --limit 1
  });

  test('6. Resume from partial state', async () => {
    // Interrupt mid-process, resume with --continue
  });

  test('7. Force regeneration', async () => {
    // npx illustrate --force --text --chapters 1
  });
});
```

---

## 6. Sub-Phase Planning

### 6.1 Phase Breakdown
Each phase has granular sub-phases:

**Phase: analyze** (--text)
1. **plan** - Calculate token count, structure API calls
2. **estimate** - Determine which model to use
3. **prepare** - Generate context needed for API calls
4. **execute** - Make API calls with retry logic
5. **save** - Update Contents.md and state

**Phase: extract** (--elements)
1. **plan** - Determine text chunks to analyze
2. **execute** - Extract elements with API
3. **deduplicate** - Merge similar elements
4. **save** - Update Elements.md and state

**Phase: illustrate** (--images)
1. **validate** - Check if text/elements exist
2. **plan** - List what needs images
3. **check_provider** - Verify image generation support
4. **execute** - Generate images with retry
5. **save** - Update markdown with image URLs

### 6.2 Progress Tracking Per Sub-Phase
```json
{
  "phases": {
    "analyze": {
      "status": "in_progress",
      "currentSubPhase": "execute",
      "subPhases": {
        "plan": { "status": "completed", "tokensEstimated": 45000 },
        "estimate": { "status": "completed", "modelSelected": "gpt-4o-mini" },
        "prepare": { "status": "completed" },
        "execute": { "status": "in_progress", "progress": "3/10" },
        "save": { "status": "pending" }
      }
    }
  }
}
```

---

## 7. Additional Features

### 7.1 Model Defaults

**Text Analysis (High-Context, Cheap):**
- Primary: Free OpenRouter model if `OPENROUTER_API_KEY` set
- Fallback: `gpt-4o-mini` if `OPENAI_API_KEY` set
- Context: 128k+ preferred
- Cost: < $0.10 per 1M tokens ideal

**Image Generation:**
- Primary: Free OpenRouter/Together model if available
- Fallback: `dall-e-3` if OpenAI key provided
- Prompt user if no image-capable endpoint found

### 7.2 CLI Flags Summary

```bash
# Phase selection
--text                    # Analyze and generate Contents.md
--elements                # Extract and generate Elements.md
--images                  # Generate images

# Filtering
--chapters 1,2,5-10      # Specific chapters/ranges
--elements "name,type:*"  # Element selection with wildcards
--limit N                 # Limit number of items (for testing)

# Control
--continue                # Resume from saved state
--force                   # Regenerate even if exists
--migrate                 # Migrate old state to new schema

# Config override
--model "provider/model"  # Override model
--api-key "sk-..."       # Override API key
--image-key "sk-..."     # Separate image API key

# Output
--output-dir "custom/"   # Override output directory
--verbose                # Detailed logging
--quiet                  # Minimal output

# Utilities
--init-config            # Generate .illustrate.config
--estimate               # Estimate costs without running
--help                   # Show help
```

### 7.3 Config File Example (Full)

```yaml
# Text analysis (primary)
baseUrl: "https://openrouter.ai/api/v1"
apiKey: "${OPENROUTER_API_KEY}"  # env var reference
model:
  name: "google/gemini-flash-1.5:free"
  contextLength: 1000000
  maxTokens: 8192
  inputCostPer1M: 0.0
  outputCostPer1M: 0.0

# Image generation (separate)
imageEndpoint:
  baseUrl: "https://api.openai.com/v1"
  apiKey: "${OPENAI_API_KEY}"
  model:
    name: "dall-e-3"
    supportsImages: true

# Processing
pagesPerImage: 10
pagesPerAutoChapter: 50
extractElements: true
generateElementImages: false

# Performance
maxConcurrency: 3
tokenSafetyMargin: 0.9
maxRetries: 1
retryTimeout: 5000

# Output
outputPattern: "illustrate_{name}"
imageSize: "1024x1024"
imageQuality: "standard"
```

---

## 8. Implementation Priority

### Phase 1: Core Infrastructure (Current Sprint)
1. ✅ Updated types with ModelConfig, provider detection
2. ⏳ State management system (.illustrate.state.json)
3. ⏳ Token counting and estimation
4. ⏳ Provider detection and configuration
5. ⏳ Chapter/element parsing and selection

### Phase 2: Command System
6. ⏳ Phase-based CLI (--text, --elements, --images)
7. ⏳ Multi-file selection UI
8. ⏳ Resume/continue logic
9. ⏳ Force and validation

### Phase 3: Robustness
10. ⏳ Retry logic with exponential backoff
11. ⏳ Sub-phase planning and tracking
12. ⏳ Error handling and user guidance

### Phase 4: Testing
13. ⏳ Bun test suite setup
14. ⏳ Pipeline tests (7 test cases)
15. ⏳ Integration with ImpossibleCreatures.epub

### Phase 5: Documentation
16. ⏳ Update README with all new features
17. ⏳ Update WORKING.md with progress
18. ⏳ Add examples and troubleshooting

---

## 9. Questions Answered Summary

| # | Question | Answer |
|---|----------|--------|
| 1 | Token limit management? | Yes, with estimation, tracking, auto-splitting |
| 2 | OpenRouter support? | Yes, full syntax + model config support |
| 3 | Provider detection? | Yes, auto-detect + separate image endpoint |
| 4 | Progress schema? | Dual: progress.md (human) + .illustrate.state.json (machine) |
| 5 | Resume behavior? | No redo, cache results, prompt on discrepancy |
| 6 | Chapter selection? | 1-indexed, ranges, auto-chapters if needed |
| 7 | Element selection? | Wildcards, case-insensitive, fuzzy |
| 8 | Multi-file? | Numbered list with metadata |
| 9 | Test scope? | Real API, free models, Bun test |
| 10 | Test file? | Use real ImpossibleCreatures.epub |
| 11 | Phases? | parse, analyze, extract, illustrate |
| 12 | Error recovery? | Partial save, retry once, detailed errors |

---

**Document Version:** 2.0.0
**Last Updated:** 2025-11-02
**Status:** Specification Complete - Implementation In Progress
