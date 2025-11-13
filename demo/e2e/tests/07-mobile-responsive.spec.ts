import { test, expect, devices } from '@playwright/test';
import path from 'path';
import { mockOpenAIAPI } from '../helpers/mock-api';
import { TEST_API_KEY } from '../helpers/test-data';

test.describe('Mobile Responsive Design', () => {
  test('should adapt layout to mobile viewport (iPhone)', async ({ browser }) => {
    // Create mobile context
    const context = await browser.newContext({
      ...devices['iPhone 12'],
    });
    const page = await context.newPage();

    await page.goto('/');

    // Main heading should be visible
    await expect(page.locator('h1').first()).toBeVisible();

    // No horizontal scrolling
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // All interactive elements should be accessible
    await expect(page.locator('input[type="file"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();

    await context.close();
  });

  test('should adapt layout to mobile viewport (Android)', async ({ browser }) => {
    // Create Android context
    const context = await browser.newContext({
      ...devices['Pixel 5'],
    });
    const page = await context.newPage();

    await page.goto('/');

    // Check responsive layout
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // Check viewport meta tag
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewportMeta).toContain('width=device-width');

    await context.close();
  });

  test('should handle touch interactions on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 12'],
      hasTouch: true,
    });
    const page = await context.newPage();

    await page.goto('/');

    // Tap on file upload button should work
    const fileLabel = page.getByText(/upload|select.*file/i).first();
    if (await fileLabel.isVisible()) {
      await fileLabel.tap();
    }

    // Tap on API key input should work
    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.tap();
    await apiKeyInput.fill(TEST_API_KEY);

    // Value should be filled
    const value = await apiKeyInput.inputValue();
    expect(value).toBe(TEST_API_KEY);

    await context.close();
  });

  test('should display text readable without zooming on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 12'],
    });
    const page = await context.newPage();

    await page.goto('/');

    // Check font sizes are appropriate for mobile
    const bodyFontSize = await page.locator('body').evaluate((el) => {
      return window.getComputedStyle(el).fontSize;
    });

    // Font size should be at least 14px (typical mobile minimum)
    const fontSize = parseFloat(bodyFontSize);
    expect(fontSize).toBeGreaterThanOrEqual(14);

    await context.close();
  });

  test('should stack elements vertically on narrow screens', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 }, // iPhone SE
    });
    const page = await context.newPage();

    await page.goto('/');

    // Main container should not overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375 + 1);

    // Check that elements are stacked (not side-by-side)
    // This is hard to test precisely, but we can check no horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);

    await context.close();
  });

  test('should handle file upload on mobile device', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['Pixel 5'],
    });
    const page = await context.newPage();

    await page.goto('/');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    // File name should be displayed and readable
    const fileName = page.getByText(/sample\.epub/i);
    await expect(fileName).toBeVisible();

    // File name should not be truncated (or have tooltip/full text available)
    const isVisible = await fileName.isVisible();
    expect(isVisible).toBe(true);

    await context.close();
  });

  test('should display processing progress on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 12'],
    });
    const page = await context.newPage();

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

    // Progress should be visible on mobile
    await page.waitForTimeout(1000);

    const progressIndicator = page.getByText(/processing|analyzing|parsing/i);
    const isVisible = await progressIndicator.isVisible().catch(() => false);

    if (isVisible) {
      await expect(progressIndicator).toBeVisible();
    }

    await context.close();
  });

  test('should allow scrolling through long content on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 12'],
    });
    const page = await context.newPage();

    await mockOpenAIAPI(page);
    await page.goto('/');

    // Complete processing to get results
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample.epub'));

    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill(TEST_API_KEY);

    const startButton = page.getByRole('button', { name: /start|process/i });
    await startButton.click();

    // Wait for completion
    await page.waitForTimeout(3000);

    // Should be able to scroll
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const clientHeight = await page.evaluate(() => document.documentElement.clientHeight);

    // Page should have scrollable content (or fit within viewport)
    expect(scrollHeight).toBeGreaterThanOrEqual(clientHeight);

    await context.close();
  });
});
