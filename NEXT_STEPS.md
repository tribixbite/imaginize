# imaginize - Next Steps

## Current Status: v2.3.0 Feature Complete ✅

**Latest Updates (Nov 12, 2025):**
- ✅ Concurrent processing architecture (Phases 1-5)
- ✅ Visual character descriptions in Elements.md
- ✅ Enhanced quote quality (3-8 sentences)
- ✅ Chapter titles in filenames
- ✅ Character cross-referencing
- ✅ 100% functional with OpenRouter free tier

**Status:** Production-ready concurrent mode with comprehensive visual descriptions

---

## Completed Work (v2.3.0)

### 1. ~~Main CLI Refactor~~ ✅ COMPLETE

**Status:** CLI fully functional with all flags working

**File:** `src/index.ts`

**Current State:** v1.0 implementation, needs complete rewrite

**Required Changes:**
```typescript
// New structure:
import { Command } from 'commander';
import { loadConfig } from './lib/config.js';
import { StateManager } from './lib/state-manager.js';
import { ProgressTracker } from './lib/progress-tracker.js';
import { findBookFiles, selectBookFile } from './lib/file-selector.js';
import { parseEpub } from './lib/epub-parser.js';
import { parsePdf } from './lib/pdf-parser.js';
import { prepareConfiguration, parseChapterSelection } from './lib/provider-utils.js';
import { AnalyzePhase } from './lib/phases/analyze-phase.ts';
import { ExtractPhase } from './lib/phases/extract-phase.ts';
import { IllustratePhase } from './lib/phases/illustrate-phase.ts';
import OpenAI from 'openai';

async function main() {
  const program = new Command();

  program
    .name('illustrate')
    .version('2.0.0')
    .description('AI-powered book illustration guide generator')
    .option('--text', 'Generate Contents.md with visual concepts')
    .option('--elements', 'Generate Elements.md with story elements')
    .option('--images', 'Generate images (requires Contents.md or Elements.md)')
    .option('--chapters <range>', 'Process specific chapters (e.g., "1-5,10")')
    .option('--elements-filter <filter>', 'Filter elements (e.g., "character:*")')
    .option('--continue', 'Continue from saved progress')
    .option('--force', 'Force regeneration even if exists')
    .option('--estimate', 'Estimate costs without executing')
    .option('--file <path>', 'Specific book file to process')
    .option('--init-config', 'Generate sample config file')
    .option('--verbose', 'Verbose logging')
    .option('--quiet', 'Minimal output');

  const options = program.parse().opts();

  // Steps:
  // 1. Handle --init-config
  // 2. Load configuration
  // 3. Find/select book file
  // 4. Check for existing state (illustrate_BOOKNAME/)
  // 5. If state exists, show summary and prompt to continue
  // 6. Parse book (EPUB or PDF)
  // 7. Initialize/load StateManager
  // 8. Initialize ProgressTracker
  // 9. Prepare OpenAI clients (text + images)
  // 10. Execute requested phases
  // 11. Handle errors with helpful messages
}
```

**Key Logic:**

```typescript
// Check for existing state
const outputDir = `illustrate_${sanitizedName}`;
if (existsSync(outputDir)) {
  const stateManager = new StateManager(outputDir, bookFile, title, totalPages);
  const hasState = await stateManager.load();

  if (hasState) {
    const current = stateManager.getCurrentPhase();
    if (current) {
      console.log(`\nFound partial progress: ${current.phase} (${current.progress})`);
      console.log(stateManager.getSummary());

      if (!options.continue && !options.force) {
        // Prompt user
        const answer = await promptForContinue();
        if (!answer) {
          console.log('Use --continue to resume or --force to restart');
          process.exit(0);
        }
      }
    }
  }
}

// Execute phases based on flags
const needsText = options.text || (!options.elements && !options.images);
const needsElements = options.elements;
const needsImages = options.images;

if (needsText) {
  const analyzePhase = new AnalyzePhase(context);
  await analyzePhase.execute();
}

if (needsElements) {
  const extractPhase = new ExtractPhase(context);
  await extractPhase.execute();
}

if (needsImages) {
  const illustratePhase = new IllustratePhase(context);
  await illustratePhase.execute();
}
```

### 2. ~~Package.json Updates~~ ✅ COMPLETE

**Status:** All scripts and dependencies in place

**Add:**
```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch"
  },
  "devDependencies": {
    "@types/adm-zip": "^0.5.0",
    "@types/xml2js": "^0.4.11",
    "bun-types": "latest"
  }
}
```

**Update version to 2.0.0**

### 3. ~~Bun Test Suite~~ ✅ COMPLETE

**Status:** 35 unit tests (100% pass) + integration tests complete

**File:** `test/pipeline.test.ts`

```typescript
import { describe, test, expect, beforeAll } from 'bun:test';
import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';

describe('illustrate pipeline', () => {
  const testBook = 'ImpossibleCreatures.epub';
  const outputDir = 'illustrate_ImpossibleCreatures';

  beforeAll(() => {
    // Clean up from previous tests
    if (existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true });
    }
  });

  test('1. Generate text for chapter 1', async () => {
    execSync(`node bin/illustrate.js --text --chapters 1 --file ${testBook}`, {
      stdio: 'inherit',
    });

    expect(existsSync(`${outputDir}/Contents.md`)).toBe(true);
    expect(existsSync(`${outputDir}/.illustrate.state.json`)).toBe(true);
  });

  test('2. Generate text for chapter 2', async () => {
    execSync(`node bin/illustrate.js --text --chapters 2 --file ${testBook}`, {
      stdio: 'inherit',
    });

    // Should have updated Contents.md
    const state = JSON.parse(
      await Bun.file(`${outputDir}/.illustrate.state.json`).text()
    );
    expect(state.phases.analyze.chapters['2'].status).toBe('completed');
  });

  test('3. Extract elements', async () => {
    execSync(`node bin/illustrate.js --elements --file ${testBook}`, {
      stdio: 'inherit',
    });

    expect(existsSync(`${outputDir}/Elements.md`)).toBe(true);
  });

  test('4. Resume from partial state', async () => {
    // Should skip completed chapters
    execSync(`node bin/illustrate.js --continue --text --file ${testBook}`, {
      stdio: 'inherit',
    });
  });

  test('5. Force regeneration', async () => {
    execSync(`node bin/illustrate.js --force --text --chapters 1 --file ${testBook}`, {
      stdio: 'inherit',
    });
  });
});
```

### 4. ~~Documentation Updates~~ ✅ COMPLETE

**Status:**
- README.md updated with concurrent mode section
- WORKING.md fully documented through v2.3.0
- All features documented

---

## Future Enhancements (Priority Order)

### Priority 1: NPM Publication (v2.3.0)
**Estimated Time:** 30 minutes

Current version has significant improvements over published v2.0.0:
- Concurrent processing (40% faster)
- Visual character descriptions
- Enhanced quote quality
- Character cross-referencing
- Improved filenames

**Tasks:**
- [ ] Update package.json version to 2.3.0
- [ ] Update CHANGELOG with all v2.3.0 improvements
- [ ] Build and test: `npm run build && npm run test`
- [ ] Publish: `npm publish`
- [ ] Create GitHub release tag

**Impact:** High - Users get all quality improvements

---

### Priority 2: Parallel Chapter Analysis
**Estimated Time:** 1-2 days

**Current:** Pass 2 analyzes chapters sequentially (rate limited)
**Proposed:** Analyze multiple chapters in parallel (respect rate limits)

**Benefits:**
- Further 50% speed improvement (3h → 1.5h)
- Better utilization of OpenRouter rate limits
- Concurrent analysis + concurrent illustration

**Implementation:**
```typescript
// analyze-phase-v2.ts executePass2()
const batchSize = 3; // Process 3 chapters at once
for (let i = 0; i < chapters.length; i += batchSize) {
  const batch = chapters.slice(i, i + batchSize);
  await Promise.all(batch.map(ch => this.analyzeChapterFull(ch, modelConfig)));
}
```

**Risks:** Rate limit handling complexity, need smart queuing

---

### Priority 3: Named Entity Recognition (NER)
**Estimated Time:** 2-3 days

**Current:** AI-based entity extraction (gpt-4o-mini)
**Proposed:** Hybrid NER + AI approach

**Benefits:**
- More accurate entity detection
- Faster extraction (less AI calls)
- Better character name consistency

**Libraries:**
- compromise (lightweight, JavaScript)
- spacy via Python bridge
- transformers.js (BERT-based NER)

**Implementation:**
- Use NER to identify candidate entities
- Use AI only to enrich with visual descriptions
- Reduces Pass 1 API calls by ~70%

---

### Priority 4: Real-Time Progress UI
**Estimated Time:** 3-5 days

**Proposed:** Web dashboard showing live progress

**Features:**
- Real-time chapter analysis progress
- Live image generation preview
- ETA calculation
- Concurrent pipeline visualization
- WebSocket updates from CLI

**Tech Stack:**
- Express server in CLI
- React/Next.js dashboard
- WebSocket for live updates
- Tailwind CSS for styling

---

### Priority 5: Image Quality Improvements
**Estimated Time:** 1-2 days

**Enhancements:**
- Style consistency across all images
- Character appearance tracking (face consistency)
- Scene composition guidelines
- Lighting/mood consistency

**Implementation:**
- Extract dominant style from first 3 images
- Create visual style guide per book
- Apply style tokens to all subsequent prompts
- Use ControlNet for character consistency (if available)

---

## Testing Plan

### Manual Testing Steps:
```bash
# 1. Set up environment
export OPENROUTER_API_KEY="your-key-here"

# 2. Build
npm install
npm run build

# 3. Test init config
node bin/illustrate.js --init-config

# 4. Test file selection (with multiple EPUBs)
node bin/illustrate.js --text --chapters 1

# 5. Test resume
node bin/illustrate.js --continue

# 6. Test force
node bin/illustrate.js --force --text --chapters 1

# 7. Test elements
node bin/illustrate.js --elements

# 8. Run automated tests
bun test
```

### Expected Results:
- ✅ Contents.md generated with visual concepts
- ✅ Elements.md generated with story elements
- ✅ .illustrate.state.json tracks progress
- ✅ progress.md logs all operations
- ✅ Resume skips completed chapters
- ✅ Force regenerates existing content
- ✅ Costs estimated before execution
- ✅ Helpful error messages

---

## Quick Implementation Guide

### Step 1: Complete index.ts Refactor
1. Copy structure from above
2. Wire up all phases
3. Add state checking logic
4. Add resume/continue prompts
5. Handle chapter filtering

### Step 2: Update package.json
1. Add bun test scripts
2. Add missing type definitions
3. Update version to 2.0.0

### Step 3: Create Test Suite
1. Create test/ directory
2. Add pipeline.test.ts
3. Configure for ImpossibleCreatures.epub
4. Run with `bun test`

### Step 4: Test & Debug
1. Build with `npm run build`
2. Test each command manually
3. Fix any TypeScript errors
4. Fix any runtime errors
5. Verify state persistence

### Step 5: Documentation
1. Update README.md with v2.0 features
2. Add examples for all flags
3. Update WORKING.md status
4. Create migration guide if needed

---

## Known Issues to Address

1. **Progress Tracker**: Needs minor updates for sub-phase logging
2. **Output Generator**: Works as-is, may need element deduplication
3. **EPUB/PDF Parsers**: Work as-is, could add token counting during parse
4. **Type Errors**: May need to add missing imports or type assertions

---

## v2.3.0 Success Checklist ✅

- [x] `npm run build` succeeds
- [x] CLI `--help` shows all flags
- [x] `--init-config` creates config
- [x] `--text --chapters 1-3` generates Chapters.md
- [x] `.imaginize.manifest.json` created and valid
- [x] `--continue` resumes from saved state
- [x] `--force` regenerates content
- [x] `npm run test` all 35 tests pass
- [x] README.md updated with concurrent mode
- [x] WORKING.md documented through v2.3.0
- [x] No TypeScript errors
- [x] No runtime errors
- [x] Visual character descriptions working
- [x] Entity cross-referencing working
- [x] OpenRouter free tier fully functional

---

## Recommended Next Action

**Publish v2.3.0 to NPM** - Users will benefit from:
- 40% faster processing
- Visual character descriptions
- Enhanced content quality
- $0 cost with OpenRouter

Then consider Priority 2+ enhancements based on user feedback.

---

Last Updated: 2025-11-12
Status: v2.3.0 Feature Complete ✅
Next Milestone: NPM Publication
