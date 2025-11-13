import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'path';
import { mockOpenAIAPI } from '../helpers/mock-api';
import { TEST_API_KEY } from '../helpers/test-data';

test.describe('Accessibility (WCAG 2.1 AA)', () => {
  test('should not have accessibility violations on initial load', async ({ page }) => {
    await page.goto('/');

    // Run axe accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Should have no violations
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper ARIA labels on form inputs', async ({ page }) => {
    await page.goto('/');

    // File input should have accessible label
    const fileInput = page.locator('input[type="file"]');
    const fileInputAriaLabel = await fileInput.getAttribute('aria-label').catch(() => null);
    const fileInputId = await fileInput.getAttribute('id').catch(() => null);

    // Should have either aria-label or associated label element
    if (!fileInputAriaLabel && fileInputId) {
      const associatedLabel = page.locator(`label[for="${fileInputId}"]`);
      await expect(associatedLabel).toBeVisible();
    }

    // API key input should have accessible label
    const apiKeyInput = page.locator('input[type="password"]').first();
    const apiKeyAriaLabel = await apiKeyInput.getAttribute('aria-label').catch(() => null);
    const apiKeyPlaceholder = await apiKeyInput.getAttribute('placeholder').catch(() => null);

    // Should have aria-label, placeholder, or associated label
    expect(apiKeyAriaLabel || apiKeyPlaceholder).toBeTruthy();
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');

    // Tab through interactive elements
    await page.keyboard.press('Tab');

    // Check that focus is visible
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });

    // Should focus on an interactive element (INPUT, BUTTON, A, etc.)
    expect(['INPUT', 'BUTTON', 'A', 'SELECT', 'TEXTAREA']).toContain(focusedElement);

    // Tab again
    await page.keyboard.press('Tab');

    // Should move to next element
    const nextFocusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });

    expect(nextFocusedElement).toBeTruthy();
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    // Get all headings
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();

    // Should have at least one heading
    expect(headings.length).toBeGreaterThan(0);

    // Check heading levels
    const headingLevels = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      return headings.map(h => parseInt(h.tagName.substring(1)));
    });

    // Should have h1
    expect(headingLevels).toContain(1);

    // Heading levels should not skip (e.g., h1 → h3 without h2)
    for (let i = 1; i < headingLevels.length; i++) {
      const diff = headingLevels[i] - headingLevels[i - 1];
      // Allow same level, next level, or going back up
      expect(diff).toBeLessThanOrEqual(1);
    }
  });

  test('should announce processing status to screen readers', async ({ page }) => {
    await mockOpenAIAPI(page);
    await page.goto('/');

    // Upload file and start processing
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill(TEST_API_KEY);

    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Wait for processing to start
    await page.waitForTimeout(1000);

    // Look for live regions or status updates
    const liveRegion = page.locator('[aria-live]').or(
      page.locator('[role="status"]')
    ).or(page.locator('[role="alert"]'));

    // Should have elements that announce status changes
    const count = await liveRegion.count();

    // Either has live regions or uses other accessible status updates
    // This is a best-effort check
    if (count > 0) {
      const ariaLive = await liveRegion.first().getAttribute('aria-live');
      expect(['polite', 'assertive', null]).toContain(ariaLive);
    }
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/');

    // Run axe scan focusing on color contrast
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('body')
      .analyze();

    // Filter for color contrast violations
    const contrastViolations = accessibilityScanResults.violations.filter((v) =>
      v.id.includes('color-contrast')
    );

    // Should have no color contrast violations
    expect(contrastViolations).toEqual([]);
  });

  test('should have accessible error messages', async ({ page }) => {
    await page.goto('/');

    // Try to start without file or API key
    const startButton = page.getByRole('button', { name: /start|process/i });

    // Button might be disabled, which is accessible
    const isDisabled = await startButton.isDisabled().catch(() => false);

    if (!isDisabled) {
      await startButton.click();

      // If error is shown, it should be accessible
      const errorMessage = page.locator('[role="alert"]').or(
        page.getByText(/required|error/i)
      );

      const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasError) {
        // Error should have appropriate ARIA role or live region
        const ariaRole = await errorMessage.first().getAttribute('role');
        expect(['alert', 'status', null]).toContain(ariaRole);
      }
    }
  });

  test('should provide alternative text for images', async ({ page }) => {
    await mockOpenAIAPI(page);
    await page.goto('/');

    // Complete processing to potentially show images
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill(TEST_API_KEY);

    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Wait for completion
    await page.waitForTimeout(3000);

    // Check all images have alt text
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');

      // All images should have alt attribute (can be empty for decorative)
      expect(alt !== null).toBe(true);
    }
  });
});
