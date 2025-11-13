/**
 * Tests for ManifestManager - Thread-safe manifest operations
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { ManifestManager } from '../../lib/concurrent/manifest-manager.js';
import { unlink, mkdir } from 'fs/promises';
import { join } from 'path';

const TEST_DIR = join(process.cwd(), '.test-locks');
const MANIFEST_PATH = join(TEST_DIR, '.imaginize.manifest.json');

describe('ManifestManager', () => {
  let manager: ManifestManager;

  beforeEach(async () => {
    // Ensure test directory exists
    try {
      await mkdir(TEST_DIR, { recursive: true });
    } catch {
      // Ignore if exists
    }

    // Clean up manifest file
    try {
      await unlink(MANIFEST_PATH);
    } catch {
      // Ignore
    }

    // Clean up lock
    try {
      await unlink(`${MANIFEST_PATH}.lock`);
    } catch {
      // Ignore
    }

    manager = new ManifestManager(MANIFEST_PATH);
  });

  afterEach(async () => {
    // Clean up
    try {
      await unlink(MANIFEST_PATH);
    } catch {
      // Ignore
    }
    try {
      await unlink(`${MANIFEST_PATH}.lock`);
    } catch {
      // Ignore
    }
  });

  test('loads default manifest if file does not exist', async () => {
    const manifest = await manager.load();

    expect(manifest.version).toBe('3.0.0');
    expect(manifest.elements_md_status).toBe('pending');
    expect(manifest.analyze_complete).toBe(false);
    expect(manifest.illustrate_complete).toBe(false);
    expect(Object.keys(manifest.chapters).length).toBe(0);
  });

  test('initializes manifest with chapters', async () => {
    await manager.initialize('TestBook', [1, 2, 3]);

    const manifest = await manager.load();

    expect(manifest.book_id).toBe('TestBook');
    expect(Object.keys(manifest.chapters).length).toBe(3);
    expect(manifest.chapters['1'].status).toBe('pending');
    expect(manifest.chapters['2'].status).toBe('pending');
    expect(manifest.chapters['3'].status).toBe('pending');
  });

  test('update modifies manifest atomically', async () => {
    await manager.initialize('TestBook', [1]);

    await manager.update((m) => {
      m.elements_md_status = 'complete';
    });

    const manifest = await manager.load();
    expect(manifest.elements_md_status).toBe('complete');
  });

  test('update updates timestamp', async () => {
    await manager.initialize('TestBook', [1]);

    const before = await manager.load();
    const timestamp1 = before.last_updated;

    // Wait a bit to ensure timestamp changes
    await new Promise((resolve) => setTimeout(resolve, 10));

    await manager.update((m) => {
      m.elements_md_status = 'complete';
    });

    const after = await manager.load();
    const timestamp2 = after.last_updated;

    expect(timestamp2).not.toBe(timestamp1);
  });

  test('updateChapter sets chapter status', async () => {
    await manager.initialize('TestBook', [1]);

    await manager.updateChapter(1, 'analyzed', {
      analyzed_at: '2025-01-01T00:00:00.000Z',
      concepts: 3,
    });

    const manifest = await manager.load();

    expect(manifest.chapters['1'].status).toBe('analyzed');
    expect(manifest.chapters['1'].analyzed_at).toBe('2025-01-01T00:00:00.000Z');
    expect(manifest.chapters['1'].concepts).toBe(3);
  });

  test('updateElementsStatus updates status', async () => {
    await manager.initialize('TestBook', [1]);

    await manager.updateElementsStatus('complete');

    const manifest = await manager.load();
    expect(manifest.elements_md_status).toBe('complete');
  });

  test('markAnalyzeComplete sets flag', async () => {
    await manager.initialize('TestBook', [1]);

    await manager.markAnalyzeComplete();

    const manifest = await manager.load();
    expect(manifest.analyze_complete).toBe(true);
  });

  test('markIllustrateComplete sets flag', async () => {
    await manager.initialize('TestBook', [1]);

    await manager.markIllustrateComplete();

    const manifest = await manager.load();
    expect(manifest.illustrate_complete).toBe(true);
  });

  test('getChaptersByStatus filters correctly', async () => {
    await manager.initialize('TestBook', [1, 2, 3]);

    await manager.updateChapter(1, 'analyzed');
    await manager.updateChapter(2, 'analyzed');
    await manager.updateChapter(3, 'pending');

    const analyzed = await manager.getChaptersByStatus('analyzed');

    expect(analyzed).toEqual([1, 2]);
  });

  test('getChaptersByStatus returns sorted array', async () => {
    await manager.initialize('TestBook', [10, 5, 15]);

    await manager.updateChapter(10, 'analyzed');
    await manager.updateChapter(5, 'analyzed');
    await manager.updateChapter(15, 'analyzed');

    const analyzed = await manager.getChaptersByStatus('analyzed');

    expect(analyzed).toEqual([5, 10, 15]); // Sorted
  });

  test('exists returns false for non-existent file', () => {
    expect(manager.exists()).toBe(false);
  });

  test('exists returns true after initialization', async () => {
    await manager.initialize('TestBook', [1]);

    expect(manager.exists()).toBe(true);
  });

  test('concurrent updates serialize correctly', async () => {
    await manager.initialize('TestBook', [1, 2, 3]);

    // Concurrent updates to different chapters
    await Promise.all([
      manager.updateChapter(1, 'analyzed', { concepts: 1 }),
      manager.updateChapter(2, 'analyzed', { concepts: 2 }),
      manager.updateChapter(3, 'analyzed', { concepts: 3 }),
    ]);

    const manifest = await manager.load();

    // All updates should be present
    expect(manifest.chapters['1'].status).toBe('analyzed');
    expect(manifest.chapters['1'].concepts).toBe(1);
    expect(manifest.chapters['2'].status).toBe('analyzed');
    expect(manifest.chapters['2'].concepts).toBe(2);
    expect(manifest.chapters['3'].status).toBe('analyzed');
    expect(manifest.chapters['3'].concepts).toBe(3);
  });

  test('update with async updater works', async () => {
    await manager.initialize('TestBook', [1]);

    await manager.update(async (m) => {
      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, 10));
      m.elements_md_status = 'complete';
    });

    const manifest = await manager.load();
    expect(manifest.elements_md_status).toBe('complete');
  });

  test('waitForElementsReady resolves when status is complete', async () => {
    await manager.initialize('TestBook', [1]);

    // Update status in background
    setTimeout(async () => {
      await manager.updateElementsStatus('complete');
    }, 100);

    // Should resolve within timeout
    await manager.waitForElementsReady(1000, 5000);

    const manifest = await manager.load();
    expect(manifest.elements_md_status).toBe('complete');
  });

  test('waitForElementsReady times out if not ready', async () => {
    await manager.initialize('TestBook', [1]);

    let errorThrown = false;
    try {
      // Short timeout, Elements.md never becomes ready
      await manager.waitForElementsReady(100, 500);
    } catch (error: any) {
      errorThrown = true;
      expect(error.message).toContain('Elements.md not ready');
    }

    expect(errorThrown).toBe(true);
  });
});
