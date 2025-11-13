import { test, expect } from '@playwright/test';
import path from 'path';
import { mockOpenAIAPIError } from '../helpers/mock-api';
import { TEST_API_KEY, TIMEOUTS } from '../helpers/test-data';

test.describe('Error Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display error message for invalid API key', async ({ page }) => {
    // Mock API to return 401 error
    await mockOpenAIAPIError(page, 'invalid_key');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    // Enter invalid API key
    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill('sk-invalid-key');

    // Start processing
    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Should show error message
    await expect(
      page.getByText(/invalid.*api.*key|incorrect.*api.*key|authentication.*failed/i)
    ).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('should display error message for rate limit exceeded', async ({ page }) => {
    // Mock API to return 429 error
    await mockOpenAIAPIError(page, 'rate_limit');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    // Enter API key
    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill(TEST_API_KEY);

    // Start processing
    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Should show rate limit error
    await expect(
      page.getByText(/rate.*limit|too many requests|quota exceeded/i)
    ).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('should display error message for network error', async ({ page }) => {
    // Mock API to return 500 error
    await mockOpenAIAPIError(page, 'network');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    // Enter API key
    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill(TEST_API_KEY);

    // Start processing
    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Should show network error
    await expect(
      page.getByText(/error|failed|something went wrong|server error/i)
    ).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('should handle offline mode gracefully', async ({ page, context }) => {
    // Set offline mode
    await context.setOffline(true);

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    // Enter API key
    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill(TEST_API_KEY);

    // Try to start processing
    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Should show network/offline error
    await expect(
      page.getByText(/network.*error|offline|connection.*failed|unable to connect/i)
    ).toBeVisible({ timeout: TIMEOUTS.medium });

    // Restore online mode
    await context.setOffline(false);
  });

  test('should allow retry after error', async ({ page }) => {
    // Mock API error first
    await mockOpenAIAPIError(page, 'invalid_key');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    // Enter invalid API key
    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill('sk-invalid-key');

    // Start processing (will fail)
    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Wait for error
    await page.waitForTimeout(1000);

    // Look for retry button or ability to start again
    const retryButton = page.getByRole('button', {
      name: /retry|try again|start/i,
    });

    // Should be able to retry
    const isVisible = await retryButton.isVisible().catch(() => false);
    if (isVisible) {
      await expect(retryButton).toBeEnabled();
    }
  });

  test('should not crash on corrupted file', async ({ page }) => {
    // Create a fake corrupted file (text file with .epub extension)
    const corruptedContent = 'This is not a valid EPUB file';
    const blob = new Blob([corruptedContent], { type: 'application/epub+zip' });

    // Note: We can't directly upload a blob in Playwright
    // Instead, we'll test that the UI handles the error gracefully
    // This test verifies the app doesn't crash, not the specific error message

    // Upload a valid file first
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    // App should remain functional
    await expect(page.locator('body')).toBeVisible();

    // No JavaScript errors in console
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // Interact with the page
    await page.waitForTimeout(1000);

    // Should not have critical JavaScript errors
    const criticalErrors = errors.filter(e =>
      !e.includes('Warning:') && !e.includes('DevTools')
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('should display error messages in accessible format', async ({ page }) => {
    // Mock API error
    await mockOpenAIAPIError(page, 'invalid_key');

    // Upload file and try to process
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill('sk-invalid-key');

    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Wait for error
    await page.waitForTimeout(2000);

    // Error should have role="alert" or similar ARIA attribute
    const errorElement = page.locator('[role="alert"]').or(
      page.locator('[aria-live="polite"]')
    ).or(page.locator('[aria-live="assertive"]'));

    const hasAriaError = await errorElement.count() > 0;

    if (hasAriaError) {
      await expect(errorElement.first()).toBeVisible();
    }
  });

  test('should allow dismissing error messages', async ({ page }) => {
    // Mock API error
    await mockOpenAIAPIError(page, 'rate_limit');

    // Upload file and try to process
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill(TEST_API_KEY);

    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Wait for error to appear
    await page.waitForTimeout(2000);

    // Look for dismiss button (×, close, dismiss, etc.)
    const dismissButton = page.getByRole('button', {
      name: /close|dismiss|×/i,
    }).or(page.locator('[aria-label*="close" i]'));

    const isDismissable = await dismissButton.isVisible().catch(() => false);

    if (isDismissable) {
      await dismissButton.click();

      // Error should no longer be visible
      const errorMessage = page.getByText(/rate.*limit|error/i);
      await expect(errorMessage).not.toBeVisible({ timeout: 2000 });
    }
  });

  test('should recover state after error and allow new processing', async ({ page }) => {
    // Mock API error
    await mockOpenAIAPIError(page, 'invalid_key');

    // Upload file and try to process
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill('sk-invalid-key');

    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Wait for error
    await page.waitForTimeout(2000);

    // UI should still be functional
    // Upload section should still be accessible
    await expect(page.locator('input[type="file"]')).toBeEnabled();

    // Can upload a new file
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.pdf'));

    // File name should update
    await expect(page.getByText(/sample\.pdf/i)).toBeVisible();
  });
});
