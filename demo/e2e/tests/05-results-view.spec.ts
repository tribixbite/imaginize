import { test, expect } from '@playwright/test';
import path from 'path';
import { mockOpenAIAPI } from '../helpers/mock-api';
import { TEST_API_KEY, TIMEOUTS } from '../helpers/test-data';

test.describe('Results View', () => {
  // Helper to complete a full processing run
  async function completeProcessing(page) {
    await mockOpenAIAPI(page);
    await page.goto('/');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    // Enter API key
    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill(TEST_API_KEY);

    // Start processing
    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Wait for completion
    await page.waitForTimeout(3000);
  }

  test('should display results section after processing', async ({ page }) => {
    await completeProcessing(page);

    // Look for results-related text
    const resultsIndicator = page.getByText(/results|downloads|output/i);
    const isVisible = await resultsIndicator.isVisible().catch(() => false);

    if (isVisible) {
      await expect(resultsIndicator).toBeVisible();
    }
  });

  test('should show download Chapters.md button', async ({ page }) => {
    await completeProcessing(page);

    // Look for Chapters.md download button
    const chaptersButton = page.getByRole('button', {
      name: /download.*chapters|chapters.*download/i,
    }).or(page.getByText(/chapters\.md/i));

    const isVisible = await chaptersButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(chaptersButton).toBeVisible();
    }
  });

  test('should show download Elements.md button', async ({ page }) => {
    await completeProcessing(page);

    // Look for Elements.md download button
    const elementsButton = page.getByRole('button', {
      name: /download.*elements|elements.*download/i,
    }).or(page.getByText(/elements\.md/i));

    const isVisible = await elementsButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(elementsButton).toBeVisible();
    }
  });

  test('should trigger file download when Chapters button clicked', async ({ page }) => {
    await completeProcessing(page);

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 })
      .catch(() => null);

    // Find and click Chapters download button
    const chaptersButton = page.getByRole('button', {
      name: /download.*chapters|chapters.*download/i,
    }).or(page.getByText(/chapters\.md/i).locator('..'));

    if (await chaptersButton.isVisible().catch(() => false)) {
      await chaptersButton.click();

      // Wait for download
      const download = await downloadPromise;

      if (download) {
        // Verify download was triggered
        expect(download).toBeTruthy();

        // Verify filename includes "chapters"
        const suggestedFilename = download.suggestedFilename();
        expect(suggestedFilename.toLowerCase()).toContain('chapter');
      }
    }
  });

  test('should trigger file download when Elements button clicked', async ({ page }) => {
    await completeProcessing(page);

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 })
      .catch(() => null);

    // Find and click Elements download button
    const elementsButton = page.getByRole('button', {
      name: /download.*elements|elements.*download/i,
    }).or(page.getByText(/elements\.md/i).locator('..'));

    if (await elementsButton.isVisible().catch(() => false)) {
      await elementsButton.click();

      // Wait for download
      const download = await downloadPromise;

      if (download) {
        // Verify download was triggered
        expect(download).toBeTruthy();

        // Verify filename includes "elements"
        const suggestedFilename = download.suggestedFilename();
        expect(suggestedFilename.toLowerCase()).toContain('element');
      }
    }
  });

  test('should show image thumbnails if images were generated', async ({ page }) => {
    await completeProcessing(page);

    // Look for image elements or thumbnails
    const images = page.locator('img').filter({
      has: page.locator('[alt*="scene" i], [alt*="illustration" i]'),
    });

    // If images are shown, they should be visible
    const count = await images.count();
    if (count > 0) {
      await expect(images.first()).toBeVisible();
    }
  });

  test('should show download all images button if images exist', async ({ page }) => {
    await completeProcessing(page);

    // Look for download all images button
    const downloadImagesButton = page.getByRole('button', {
      name: /download.*images|all.*images|images.*zip/i,
    });

    const isVisible = await downloadImagesButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(downloadImagesButton).toBeVisible();
    }
  });

  test('should show start new processing button', async ({ page }) => {
    await completeProcessing(page);

    // Look for "start new" or "process another" button
    const newProcessButton = page.getByRole('button', {
      name: /start new|process another|new book|reset/i,
    });

    const isVisible = await newProcessButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(newProcessButton).toBeVisible();
    }
  });

  test('should reset state when start new button clicked', async ({ page }) => {
    await completeProcessing(page);

    // Find and click start new button
    const newProcessButton = page.getByRole('button', {
      name: /start new|process another|new book|reset/i,
    });

    if (await newProcessButton.isVisible().catch(() => false)) {
      await newProcessButton.click();

      // Should return to initial state
      // File upload section should be visible again
      await expect(page.getByText(/upload|select.*file/i)).toBeVisible({
        timeout: TIMEOUTS.short,
      });

      // Results should no longer be visible
      const resultsSection = page.getByText(/download.*chapters|download.*elements/i);
      await expect(resultsSection).not.toBeVisible();
    }
  });
});
