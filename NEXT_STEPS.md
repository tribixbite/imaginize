# illustrate v2.0 - Next Steps to Completion

## Current Status: ~85% Complete ✅

All core infrastructure and phase orchestration is DONE. Remaining work is integration and testing.

---

## What's Left (3-4 hours of work)

### 1. Main CLI Refactor (Priority 1) - ~1.5 hours

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

### 2. Package.json Updates (Priority 2) - ~15 minutes

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

### 3. Bun Test Suite (Priority 3) - ~1.5 hours

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

### 4. Documentation Updates (Priority 4) - ~30 minutes

**README.md:**
- Add v2.0 features section
- Document all CLI flags
- Add provider configuration examples
- Update cost estimates
- Add troubleshooting for state issues

**WORKING.md:**
- Mark v2.0 as complete
- Add post-publication checklist

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

## Success Checklist

- [ ] `npm run build` succeeds
- [ ] `node bin/illustrate.js --help` shows all flags
- [ ] `node bin/illustrate.js --init-config` creates config
- [ ] `node bin/illustrate.js --text --chapters 1` generates Contents.md
- [ ] `.illustrate.state.json` created and valid
- [ ] `--continue` resumes from saved state
- [ ] `--force` regenerates content
- [ ] `bun test` all tests pass
- [ ] README.md updated
- [ ] No TypeScript errors
- [ ] No runtime errors

---

**Time Estimate:** 3-4 hours to completion

**Difficulty:** Medium (mostly integration work, core logic is done)

**Status:** Ready to implement!

---

Last Updated: 2025-11-02
Completion: 85% → 100% after these steps
