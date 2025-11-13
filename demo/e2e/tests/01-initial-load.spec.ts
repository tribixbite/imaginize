import { test, expect } from '@playwright/test';

test.describe('Initial Page Load', () => {
  test('should load demo page successfully', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/imaginize/i);

    // Check main heading
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/imaginize/i);
  });

  test('should render all critical sections', async ({ page }) => {
    await page.goto('/');

    // File upload section should be visible
    await expect(page.getByText(/upload/i).first()).toBeVisible();

    // API key section should be visible
    await expect(page.getByText(/api key/i).first()).toBeVisible();

    // Footer or attribution should be visible
    await expect(page.getByText(/github/i).or(page.getByText(/source/i))).toBeVisible();
  });

  test('should not have console errors on load', async ({ page }) => {
    const errors: string[] = [];

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have no console errors
    expect(errors).toHaveLength(0);
  });

  test('should apply dark mode based on system preference', async ({ page, browser }) => {
    // Test with dark mode preference
    const darkContext = await browser.newContext({
      colorScheme: 'dark',
    });
    const darkPage = await darkContext.newPage();
    await darkPage.goto('/');

    // Check that dark mode is applied (background should be dark)
    const bodyDark = darkPage.locator('body');
    const darkBgColor = await bodyDark.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    // Dark background should have low RGB values
    expect(darkBgColor).toMatch(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    const darkMatch = darkBgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (darkMatch) {
      const [, r, g, b] = darkMatch.map(Number);
      expect(r).toBeLessThan(50); // Dark backgrounds have low RGB values
    }

    await darkContext.close();

    // Test with light mode preference
    const lightContext = await browser.newContext({
      colorScheme: 'light',
    });
    const lightPage = await lightContext.newPage();
    await lightPage.goto('/');

    // Check that light mode is applied (background should be light)
    const bodyLight = lightPage.locator('body');
    const lightBgColor = await bodyLight.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    // Light background should have high RGB values
    expect(lightBgColor).toMatch(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    const lightMatch = lightBgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (lightMatch) {
      const [, r, g, b] = lightMatch.map(Number);
      expect(r).toBeGreaterThan(200); // Light backgrounds have high RGB values
    }

    await lightContext.close();
  });

  test('should have GitHub link with correct URL', async ({ page }) => {
    await page.goto('/');

    // Find GitHub link
    const githubLink = page.getByRole('link', { name: /github/i });
    await expect(githubLink).toBeVisible();

    // Check it links to the correct repository
    const href = await githubLink.getAttribute('href');
    expect(href).toContain('github.com');
    expect(href).toContain('imaginize');
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport (iPhone SE dimensions)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Page should still render correctly
    await expect(page.locator('h1').first()).toBeVisible();

    // No horizontal scrolling should be present
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // Allow 1px tolerance
  });

  test('should load without network errors', async ({ page }) => {
    const failedRequests: string[] = [];

    // Listen for failed requests
    page.on('requestfailed', (request) => {
      failedRequests.push(request.url());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have no failed requests
    expect(failedRequests).toHaveLength(0);
  });
});
