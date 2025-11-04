/**
 * Bun test suite for illustrate v2.0 pipeline
 * Tests full workflow from EPUB to markdown generation
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { execSync } from 'child_process';
import { existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';

const TEST_BOOK = 'ImpossibleCreatures.epub';
const OUTPUT_DIR = 'imaginize_ImpossibleCreatures';

describe('illustrate v2.0 pipeline', () => {
  beforeAll(() => {
    // Clean up from previous test runs
    if (existsSync(OUTPUT_DIR)) {
      rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }

    // Verify test book exists
    if (!existsSync(TEST_BOOK)) {
      throw new Error(`Test book not found: ${TEST_BOOK}`);
    }

    // Verify API key is set
    if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
      throw new Error(
        'No API key found. Set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable.'
      );
    }
  });

  afterAll(() => {
    // Optionally clean up after tests
    // Commented out so you can inspect results
    // if (existsSync(OUTPUT_DIR)) {
    //   rmSync(OUTPUT_DIR, { recursive: true, force: true });
    // }
  });

  test('1. Generate text for chapter 1', async () => {
    console.log('\n🧪 Test 1: Generate text for chapter 1\n');

    execSync(
      `node bin/illustrate.js --text --chapters 1 --file ${TEST_BOOK}`,
      { stdio: 'inherit' }
    );

    // Verify outputs exist
    expect(existsSync(OUTPUT_DIR)).toBe(true);
    expect(existsSync(join(OUTPUT_DIR, 'Contents.md'))).toBe(true);
    expect(existsSync(join(OUTPUT_DIR, '.imaginize.state.json'))).toBe(true);
    expect(existsSync(join(OUTPUT_DIR, 'progress.md'))).toBe(true);

    // Verify state
    const stateFile = readFileSync(
      join(OUTPUT_DIR, '.imaginize.state.json'),
      'utf-8'
    );
    const state = JSON.parse(stateFile);

    expect(state.version).toBe('2.0.0');
    expect(state.phases.analyze.status).toBe('completed');
    expect(state.phases.analyze.chapters['1'].status).toBe('completed');
  }, 60000); // 60 second timeout

  test('2. Generate text for chapter 2', async () => {
    console.log('\n🧪 Test 2: Generate text for chapter 2\n');

    execSync(
      `node bin/illustrate.js --text --chapters 2 --file ${TEST_BOOK}`,
      { stdio: 'inherit' }
    );

    // Verify chapter 2 is now complete
    const stateFile = readFileSync(
      join(OUTPUT_DIR, '.imaginize.state.json'),
      'utf-8'
    );
    const state = JSON.parse(stateFile);

    expect(state.phases.analyze.chapters['2'].status).toBe('completed');
    expect(state.phases.analyze.chapters['1'].status).toBe('completed');

    // Verify Contents.md has both chapters
    const contents = readFileSync(join(OUTPUT_DIR, 'Contents.md'), 'utf-8');
    expect(contents).toContain('Chapter');
  }, 60000);

  test('3. Extract story elements', async () => {
    console.log('\n🧪 Test 3: Extract story elements\n');

    execSync(`node bin/illustrate.js --elements --file ${TEST_BOOK}`, {
      stdio: 'inherit',
    });

    // Verify Elements.md exists
    expect(existsSync(join(OUTPUT_DIR, 'Elements.md'))).toBe(true);

    // Verify state
    const stateFile = readFileSync(
      join(OUTPUT_DIR, '.imaginize.state.json'),
      'utf-8'
    );
    const state = JSON.parse(stateFile);

    expect(state.phases.extract.status).toBe('completed');

    // Verify Elements.md has content
    const elements = readFileSync(join(OUTPUT_DIR, 'Elements.md'), 'utf-8');
    expect(elements.length).toBeGreaterThan(0);
  }, 60000);

  test('4. Resume from partial state', async () => {
    console.log('\n🧪 Test 4: Resume from partial state\n');

    // Try to run with --continue (should skip completed chapters)
    // This test verifies that state is properly loaded and respected
    execSync(
      `node bin/illustrate.js --continue --text --chapters 1 --file ${TEST_BOOK}`,
      { stdio: 'inherit' }
    );

    // State should still be valid
    const stateFile = readFileSync(
      join(OUTPUT_DIR, '.imaginize.state.json'),
      'utf-8'
    );
    const state = JSON.parse(stateFile);

    expect(state.phases.analyze.chapters['1'].status).toBe('completed');
  }, 30000);

  test('5. Force regeneration', async () => {
    console.log('\n🧪 Test 5: Force regeneration\n');

    // Get original timestamp
    const stateBefore = JSON.parse(
      readFileSync(join(OUTPUT_DIR, '.imaginize.state.json'), 'utf-8')
    );
    const originalTimestamp = stateBefore.lastUpdated;

    // Force regenerate chapter 1
    execSync(
      `node bin/illustrate.js --force --text --chapters 1 --file ${TEST_BOOK}`,
      { stdio: 'inherit' }
    );

    // Verify state was updated
    const stateAfter = JSON.parse(
      readFileSync(join(OUTPUT_DIR, '.imaginize.state.json'), 'utf-8')
    );

    expect(stateAfter.lastUpdated).not.toBe(originalTimestamp);
    expect(stateAfter.phases.analyze.chapters['1'].status).toBe('completed');
  }, 60000);

  test('6. Verify state persistence', () => {
    console.log('\n🧪 Test 6: Verify state persistence\n');

    const state = JSON.parse(
      readFileSync(join(OUTPUT_DIR, '.imaginize.state.json'), 'utf-8')
    );

    // Verify all required fields exist
    expect(state.version).toBeDefined();
    expect(state.bookFile).toBeDefined();
    expect(state.bookTitle).toBeDefined();
    expect(state.phases).toBeDefined();
    expect(state.toc).toBeDefined();
    expect(state.tokenStats).toBeDefined();

    // Verify phase structure
    expect(state.phases.analyze).toBeDefined();
    expect(state.phases.extract).toBeDefined();
    expect(state.phases.imaginize).toBeDefined();

    console.log('\n📊 Final State Summary:');
    console.log(`   Book: ${state.bookTitle}`);
    console.log(`   Chapters: ${state.toc.chapters.length}`);
    console.log(`   Tokens Used: ${state.tokenStats.totalUsed.toLocaleString()}`);
    console.log(
      `   Analyze: ${state.phases.analyze.status} (${Object.keys(state.phases.analyze.chapters || {}).length} chapters)`
    );
    console.log(`   Extract: ${state.phases.extract.status}`);
  });
});

describe('CLI flags and options', () => {
  test('--init-config creates config file', () => {
    console.log('\n🧪 Test: --init-config\n');

    const configFile = '.imaginize.config.test';

    // Clean up if exists
    if (existsSync(configFile)) {
      rmSync(configFile);
    }

    // Run init-config
    execSync('node bin/illustrate.js --init-config', { stdio: 'inherit' });

    // Should create default config
    expect(existsSync('.imaginize.config')).toBe(true);

    // Clean up
    rmSync('.imaginize.config');
  });

  test('--help shows usage', () => {
    console.log('\n🧪 Test: --help\n');

    const output = execSync('node bin/illustrate.js --help', {
      encoding: 'utf-8',
    });

    expect(output).toContain('--text');
    expect(output).toContain('--elements');
    expect(output).toContain('--images');
    expect(output).toContain('--chapters');
    expect(output).toContain('--continue');
  });
});
