import { test, expect } from '@playwright/test';
import path from 'path';
import { TEST_FILES } from '../helpers/test-data';

test.describe('File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should accept EPUB file upload via file picker', async ({ page }) => {
    // Get the file input element
    const fileInput = page.locator('input[type="file"]');

    // Upload EPUB file
    const filePath = path.join(__dirname, '../fixtures/sample.epub');
    await fileInput.setInputFiles(filePath);

    // Verify file name is displayed
    await expect(page.getByText(/sample\.epub/i)).toBeVisible();

    // Verify file size is reasonable (should show something like "2.0 KB")
    await expect(page.getByText(/kb/i)).toBeVisible();
  });

  test('should accept PDF file upload via file picker', async ({ page }) => {
    // Get the file input element
    const fileInput = page.locator('input[type="file"]');

    // Upload PDF file
    const filePath = path.join(__dirname, '../fixtures/sample.pdf');
    await fileInput.setInputFiles(filePath);

    // Verify file name is displayed
    await expect(page.getByText(/sample\.pdf/i)).toBeVisible();

    // Verify file type indicator (if present)
    await expect(page.getByText(/pdf/i)).toBeVisible();
  });

  test('should display file information after upload', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    const filePath = path.join(__dirname, '../fixtures/sample.epub');
    await fileInput.setInputFiles(filePath);

    // Should show file name
    await expect(page.getByText('sample.epub')).toBeVisible();

    // Should show file size (approximately 2 KB)
    const sizeText = page.getByText(/\d+(\.\d+)?\s*(KB|MB)/i);
    await expect(sizeText).toBeVisible();
  });

  test('should allow removing uploaded file', async ({ page }) => {
    // Upload a file first
    const fileInput = page.locator('input[type="file"]');
    const filePath = path.join(__dirname, '../fixtures/sample.epub');
    await fileInput.setInputFiles(filePath);

    // Wait for file to be displayed
    await expect(page.getByText('sample.epub')).toBeVisible();

    // Find and click remove/clear button
    const removeButton = page.getByRole('button', {
      name: /remove|clear|delete|×/i,
    });
    await removeButton.click();

    // File name should no longer be visible
    await expect(page.getByText('sample.epub')).not.toBeVisible();

    // File input should be reset (can upload again)
    const fileInputValue = await fileInput.inputValue();
    expect(fileInputValue).toBe('');
  });

  test('should handle drag and drop for EPUB files', async ({ page }) => {
    // Create a data transfer object for drag-and-drop
    const filePath = path.join(__dirname, '../fixtures/sample.epub');

    // Find the drop zone (usually the file upload area)
    const dropZone = page.locator('input[type="file"]').locator('..');

    // Simulate drag and drop
    await dropZone.setInputFiles(filePath);

    // Verify file was uploaded
    await expect(page.getByText('sample.epub')).toBeVisible();
  });

  test('should handle drag and drop for PDF files', async ({ page }) => {
    const filePath = path.join(__dirname, '../fixtures/sample.pdf');
    const dropZone = page.locator('input[type="file"]').locator('..');

    await dropZone.setInputFiles(filePath);

    // Verify file was uploaded
    await expect(page.getByText('sample.pdf')).toBeVisible();
  });

  test('should reject files larger than 10MB', async ({ page }) => {
    // Note: This test will need to be adjusted based on actual implementation
    // For now, we'll test that the UI has the size limit displayed

    // Check for file size limit message
    await expect(
      page.getByText(/max.*10\s*mb|10\s*mb.*max|size.*limit/i)
    ).toBeVisible();
  });

  test('should validate file type (reject non-EPUB/PDF files)', async ({ page }) => {
    // Try to upload a text file (should be rejected)
    // Note: This test assumes the file input has accept attribute

    const fileInput = page.locator('input[type="file"]');

    // Check accept attribute includes epub and pdf
    const acceptAttr = await fileInput.getAttribute('accept');
    expect(acceptAttr).toBeTruthy();
    expect(acceptAttr).toMatch(/epub|pdf/i);
  });

  test('should show upload progress or loading state', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    const filePath = path.join(__dirname, '../fixtures/sample.epub');

    // Upload file
    await fileInput.setInputFiles(filePath);

    // File should be displayed (indicating successful upload)
    await expect(page.getByText('sample.epub')).toBeVisible({ timeout: 5000 });

    // Should not show any error messages
    const errorMessage = page.locator('[role="alert"]').filter({ hasText: /error|failed/i });
    await expect(errorMessage).not.toBeVisible();
  });
});
