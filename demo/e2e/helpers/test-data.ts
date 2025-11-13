/**
 * Test data and constants for E2E tests
 */

export const TEST_API_KEY = 'sk-test-mock-api-key-for-e2e-testing-only';

export const TEST_FILES = {
  epub: {
    path: 'e2e/fixtures/sample.epub',
    name: 'sample.epub',
    size: 2023, // bytes
    type: 'application/epub+zip',
  },
  pdf: {
    path: 'e2e/fixtures/sample.pdf',
    name: 'sample.pdf',
    size: 1840, // bytes
    type: 'application/pdf',
  },
};

export const INVALID_FILES = {
  tooLarge: {
    name: 'too-large.epub',
    size: 11 * 1024 * 1024, // 11MB (exceeds 10MB limit)
  },
  wrongType: {
    name: 'document.txt',
    type: 'text/plain',
  },
};

export const STORAGE_KEYS = {
  apiKey: 'imaginize_openai_api_key',
  apiKeySession: 'imaginize_openai_api_key_session',
  storageType: 'imaginize_storage_type',
};

export const PROCESSING_PHASES = {
  parsing: 'Parsing',
  analyzing: 'Analyzing',
  illustrating: 'Illustrating',
  complete: 'Complete',
};

export const SELECTORS = {
  // File upload
  fileInput: 'input[type="file"]',
  fileUploadButton: 'button:has-text("Upload File")',
  fileName: '[data-testid="file-name"]',
  removeFileButton: '[data-testid="remove-file"]',

  // API key
  apiKeyInput: 'input[type="password"]',
  apiKeyToggle: 'button[aria-label="Toggle API key visibility"]',
  apiKeyPersistentOption: 'input[value="persistent"]',
  apiKeySessionOption: 'input[value="session"]',
  forgetKeyButton: 'button:has-text("Forget Key")',

  // Processing
  startButton: 'button:has-text("Start Processing")',
  progressBar: '[role="progressbar"]',
  phaseIndicator: '[data-testid="current-phase"]',
  chapterGrid: '[data-testid="chapter-grid"]',

  // Results
  resultsSection: '[data-testid="results"]',
  downloadChaptersButton: 'button:has-text("Download Chapters.md")',
  downloadElementsButton: 'button:has-text("Download Elements.md")',
  downloadImagesButton: 'button:has-text("Download All Images")',
  startNewButton: 'button:has-text("Start New Processing")',

  // Error messages
  errorMessage: '[role="alert"]',
  errorDismiss: 'button[aria-label="Dismiss error"]',
};

/**
 * Helper to generate a File object for testing
 */
export function createTestFile(
  name: string,
  content: string | Buffer,
  type: string
): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

/**
 * Expected content snippets for validation
 */
export const EXPECTED_CONTENT = {
  epub: {
    title: 'Simple Test Book',
    author: 'Test Author',
    chapters: 2,
    chapterTitles: ['Chapter 1', 'Chapter 2'],
  },
  pdf: {
    title: 'Simple Test Book',
    author: 'Test Author',
    pages: 3,
  },
};

/**
 * Timeout constants (in milliseconds)
 */
export const TIMEOUTS = {
  short: 5000, // 5 seconds
  medium: 10000, // 10 seconds
  long: 30000, // 30 seconds
  processing: 60000, // 1 minute
};
