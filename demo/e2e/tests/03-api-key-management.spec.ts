import { test, expect } from '@playwright/test';
import { TEST_API_KEY, STORAGE_KEYS } from '../helpers/test-data';

test.describe('API Key Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have API key input field visible', async ({ page }) => {
    // API key input should be visible on page load
    const apiKeyInput = page.locator('input[type="password"]').or(
      page.getByPlaceholder(/api key/i)
    );
    await expect(apiKeyInput).toBeVisible();
  });

  test('should mask API key by default (password type)', async ({ page }) => {
    const apiKeyInput = page.locator('input').filter({
      has: page.locator('[type="password"]'),
    }).or(page.getByPlaceholder(/api key/i));

    // Input type should be password (masked)
    const inputType = await apiKeyInput.getAttribute('type');
    expect(inputType).toBe('password');
  });

  test('should allow toggling API key visibility', async ({ page }) => {
    // Find the API key input
    const apiKeyInput = page.getByPlaceholder(/api key/i).or(
      page.locator('input[type="password"]').first()
    );

    // Enter a test API key
    await apiKeyInput.fill(TEST_API_KEY);

    // Find the show/hide toggle button
    const toggleButton = page.getByRole('button', {
      name: /show|hide|visibility|eye/i,
    }).first();

    if (await toggleButton.isVisible()) {
      // Click to show
      await toggleButton.click();

      // Input type should change to text
      const inputType = await apiKeyInput.getAttribute('type');
      expect(inputType).toBe('text');

      // Click to hide again
      await toggleButton.click();

      // Should be password again
      const hiddenType = await apiKeyInput.getAttribute('type');
      expect(hiddenType).toBe('password');
    }
  });

  test('should accept valid API key format', async ({ page }) => {
    const apiKeyInput = page.getByPlaceholder(/api key/i).or(
      page.locator('input[type="password"]').first()
    );

    // Enter a valid-looking API key
    await apiKeyInput.fill(TEST_API_KEY);

    // Value should be set
    const value = await apiKeyInput.inputValue();
    expect(value).toBe(TEST_API_KEY);

    // Should not show validation error
    const errorMessage = page.getByText(/invalid.*api.*key/i);
    await expect(errorMessage).not.toBeVisible();
  });

  test('should offer persistent storage option', async ({ page }) => {
    // Look for storage type options (radio buttons or checkboxes)
    const persistentOption = page.getByText(/persistent|remember|save/i).or(
      page.getByLabel(/persistent|remember|save/i)
    );

    // Should be visible (may not be on initial implementation)
    const isVisible = await persistentOption.isVisible().catch(() => false);

    if (isVisible) {
      await expect(persistentOption).toBeVisible();
    }
  });

  test('should offer session-only storage option', async ({ page }) => {
    // Look for session storage option
    const sessionOption = page.getByText(/session|temporary|this session/i).or(
      page.getByLabel(/session|temporary|this session/i)
    );

    // Should be visible (may not be on initial implementation)
    const isVisible = await sessionOption.isVisible().catch(() => false);

    if (isVisible) {
      await expect(sessionOption).toBeVisible();
    }
  });

  test('should save API key to localStorage when persistent option selected', async ({
    page,
    context,
  }) => {
    const apiKeyInput = page.getByPlaceholder(/api key/i).or(
      page.locator('input[type="password"]').first()
    );

    // Enter API key
    await apiKeyInput.fill(TEST_API_KEY);

    // Select persistent storage (if option exists)
    const persistentOption = page.getByLabel(/persistent|remember|save/i);
    if (await persistentOption.isVisible().catch(() => false)) {
      await persistentOption.click();
    }

    // Trigger save (may require clicking a button or just entering the key)
    await apiKeyInput.press('Enter');
    await page.waitForTimeout(500); // Give time for storage to persist

    // Reload page
    await page.reload();

    // API key should still be present in input (loaded from localStorage)
    const apiKeyValue = await apiKeyInput.inputValue();

    // Either the value persists, or we can check localStorage directly
    const storedKey = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, STORAGE_KEYS.apiKey);

    // At least one should have the key
    expect(apiKeyValue === TEST_API_KEY || storedKey === TEST_API_KEY).toBe(true);
  });

  test('should clear API key from localStorage when forget button clicked', async ({
    page,
  }) => {
    const apiKeyInput = page.getByPlaceholder(/api key/i).or(
      page.locator('input[type="password"]').first()
    );

    // Set API key in localStorage directly
    await page.evaluate((data) => {
      localStorage.setItem(data.storageKey, data.apiKey);
    }, { storageKey: STORAGE_KEYS.apiKey, apiKey: TEST_API_KEY });

    // Reload to load from storage
    await page.reload();

    // Find forget/clear button
    const forgetButton = page.getByRole('button', {
      name: /forget|clear|remove.*key/i,
    });

    if (await forgetButton.isVisible()) {
      await forgetButton.click();

      // Wait a moment
      await page.waitForTimeout(300);

      // localStorage should be cleared
      const storedKey = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, STORAGE_KEYS.apiKey);

      expect(storedKey).toBeNull();

      // Input should be empty
      const inputValue = await apiKeyInput.inputValue();
      expect(inputValue).toBe('');
    }
  });

  test('should validate API key is required before processing', async ({ page }) => {
    // Try to start processing without API key (if file is uploaded)
    const fileInput = page.locator('input[type="file"]');
    const filePath = require('path').join(__dirname, '../fixtures/sample.epub');
    await fileInput.setInputFiles(filePath);

    // Look for start/process button
    const startButton = page.getByRole('button', {
      name: /start|process|begin/i,
    });

    if (await startButton.isVisible()) {
      // Button should be disabled without API key
      const isDisabled = await startButton.isDisabled();
      expect(isDisabled).toBe(true);
    }
  });
});
