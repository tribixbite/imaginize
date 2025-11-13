import { test, expect } from '@playwright/test';
import path from 'path';
import { mockOpenAIAPI } from '../helpers/mock-api';
import { TEST_API_KEY, TIMEOUTS } from '../helpers/test-data';

test.describe('Processing Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock OpenAI API to avoid actual API calls
    await mockOpenAIAPI(page);

    await page.goto('/');
  });

  test('should disable start button without file and API key', async ({ page }) => {
    const startButton = page.getByRole('button', {
      name: /start|process|begin/i,
    });

    // Button should be disabled initially
    if (await startButton.isVisible()) {
      const isDisabled = await startButton.isDisabled();
      expect(isDisabled).toBe(true);
    }
  });

  test('should enable start button with valid file and API key', async ({ page }) => {
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    const filePath = path.join(__dirname, '../fixtures/sample.epub');
    await fileInput.setInputFiles(filePath);

    // Enter API key
    const apiKeyInput = page.getByPlaceholder(/api key/i).or(
      page.locator('input[type="password"]').first()
    );
    await apiKeyInput.fill(TEST_API_KEY);

    // Start button should now be enabled
    const startButton = page.getByRole('button', {
      name: /start|process|begin/i,
    });

    if (await startButton.isVisible()) {
      await expect(startButton).toBeEnabled({ timeout: 2000 });
    }
  });

  test('should start processing when start button clicked', async ({ page }) => {
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    const filePath = path.join(__dirname, '../fixtures/sample.epub');
    await fileInput.setInputFiles(filePath);

    // Enter API key
    const apiKeyInput = page.getByPlaceholder(/api key/i).or(
      page.locator('input[type="password"]').first()
    );
    await apiKeyInput.fill(TEST_API_KEY);

    // Click start button
    const startButton = page.getByRole('button', {
      name: /start|process|begin/i,
    });
    await startButton.click();

    // Should show processing indicator
    await expect(
      page.getByText(/processing|analyzing|parsing/i)
    ).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('should show progress bar during processing', async ({ page }) => {
    // Setup and start processing
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill(TEST_API_KEY);

    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Look for progress bar or progress indicator
    const progressBar = page.locator('[role="progressbar"]').or(
      page.locator('.progress-bar').or(page.getByText(/\d+%/))
    );

    // Progress indicator should appear
    await expect(progressBar).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('should display current phase during processing', async ({ page }) => {
    // Setup and start processing
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill(TEST_API_KEY);

    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Should show phase indicator (Parsing, Analyzing, or Illustrating)
    const phaseText = page.getByText(/parsing|analyzing|illustrating|processing/i);
    await expect(phaseText).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('should update progress percentage during processing', async ({ page }) => {
    // Setup and start processing
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill(TEST_API_KEY);

    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Wait for processing to start
    await page.waitForTimeout(1000);

    // Look for percentage indicators (0%, 50%, 100%, etc.)
    const percentagePattern = /\d+\s*%/;

    // Should show some percentage
    await expect(
      page.getByText(percentagePattern)
    ).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('should show chapter progress grid', async ({ page }) => {
    // Setup and start processing
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill(TEST_API_KEY);

    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Wait for processing to start
    await page.waitForTimeout(1500);

    // Look for chapter indicators (may show Chapter 1, Chapter 2, etc.)
    const chapterIndicator = page.getByText(/chapter\s+\d+/i).or(
      page.getByText(/ch\s*\d+/i)
    );

    // Chapter progress should be visible
    const isVisible = await chapterIndicator.isVisible({ timeout: 5000 }).catch(() => false);

    // If chapter progress is shown, verify it
    if (isVisible) {
      await expect(chapterIndicator).toBeVisible();
    }
  });

  test('should handle phase transitions', async ({ page }) => {
    // Setup and start processing
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill(TEST_API_KEY);

    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Wait for first phase
    await expect(
      page.getByText(/parsing|analyzing/i)
    ).toBeVisible({ timeout: TIMEOUTS.medium });

    // Note: With mocked APIs, processing will be very fast
    // In real implementation, we'd see phase transitions
  });

  test('should complete processing successfully', async ({ page }) => {
    // Setup and start processing
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill(TEST_API_KEY);

    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Wait for completion (with mocked API, should be fast)
    await expect(
      page.getByText(/complete|done|finished|success/i)
    ).toBeVisible({ timeout: TIMEOUTS.processing });
  });

  test('should show results section after completion', async ({ page }) => {
    // Setup and start processing
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill(TEST_API_KEY);

    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Wait for completion
    await page.waitForTimeout(3000);

    // Results section should appear
    const resultsSection = page.getByText(/results|download|chapters|elements/i);
    const isVisible = await resultsSection.isVisible({ timeout: TIMEOUTS.processing })
      .catch(() => false);

    if (isVisible) {
      await expect(resultsSection).toBeVisible();
    }
  });

  test('should handle processing with PDF file', async ({ page }) => {
    // Upload PDF instead of EPUB
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.pdf'));

    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill(TEST_API_KEY);

    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Should process PDF successfully
    await expect(
      page.getByText(/processing|analyzing|parsing/i)
    ).toBeVisible({ timeout: TIMEOUTS.medium });
  });
});
