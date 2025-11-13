# E2E Testing for imaginize Demo

End-to-end testing suite for the imaginize GitHub Pages demo using Playwright.

## Overview

This directory contains comprehensive E2E tests that validate the complete user journey through the demo application, from file upload to results download.

**Status**: Phase 1-3 Complete (Setup, Core Flows & Edge Cases)

## Structure

```
e2e/
├── fixtures/          # Test files (EPUB/PDF)
│   ├── sample.epub    # 2.0 KB valid EPUB 3.0 file
│   ├── sample.pdf     # 1.8 KB valid PDF 1.7 file
│   └── README.md      # Fixture documentation
├── helpers/           # Reusable test utilities
│   ├── mock-api.ts    # Mock OpenAI API responses
│   └── test-data.ts   # Test constants and data
├── tests/             # E2E test suites
│   ├── 01-initial-load.spec.ts       # Page load validation (8 tests)
│   ├── 02-file-upload.spec.ts        # File upload functionality (9 tests)
│   ├── 03-api-key-management.spec.ts # API key security (8 tests)
│   ├── 04-processing-flow.spec.ts    # Processing pipeline (10 tests)
│   ├── 05-results-view.spec.ts       # Results and downloads (8 tests)
│   ├── 06-error-scenarios.spec.ts    # Error handling & recovery (9 tests)
│   ├── 07-mobile-responsive.spec.ts  # Mobile UX validation (8 tests)
│   └── 08-accessibility.spec.ts      # WCAG 2.1 AA compliance (8 tests)
└── README.md          # This file
```

## Running Tests

### Local Development

**Note**: Playwright requires browser binaries which cannot be installed on Android/Termux. These tests are designed to run in CI/CD (GitHub Actions) on Linux runners.

If you're on a standard Linux/macOS/Windows system:

```bash
# Install Playwright browsers (one-time setup)
npx playwright install --with-deps

# Run all E2E tests
npm run test:e2e

# Run tests with UI mode (visual test runner)
npm run test:e2e:ui

# Run tests in debug mode
npm run test:e2e:debug

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# View test report
npm run test:e2e:report
```

### CI/CD

E2E tests run automatically in GitHub Actions:
- On pull requests affecting `demo/**` files
- Before deployments to GitHub Pages
- Test reports uploaded as artifacts

## Test Coverage

### Phase 1: Setup & Infrastructure ✅ COMPLETE

**Files Created**:
- `playwright.config.ts` - Playwright configuration
- `e2e/fixtures/` - Test files (EPUB/PDF)
- `e2e/helpers/mock-api.ts` - API mocking utilities
- `e2e/helpers/test-data.ts` - Test constants
- `e2e/tests/01-initial-load.spec.ts` - Initial load tests

**Tests Implemented** (8 tests):
1. Page loads successfully (200 status, title check)
2. All critical sections render (file upload, API key input, footer)
3. No console errors on load
4. Dark mode applies based on system preference
5. GitHub link present and correct
6. Responsive on mobile viewport (no horizontal scroll)
7. No network errors during load
8. Color scheme adapts to user preference (light/dark)

**Browser Coverage**:
- Chromium (Desktop Chrome)
- Firefox
- WebKit (Safari)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

### Phase 2: Core User Flow Tests ✅ COMPLETE

**Tests Implemented** (35 tests across 4 suites):

**02-file-upload.spec.ts** (9 tests):
1. Accept EPUB file upload via file picker
2. Accept PDF file upload via file picker
3. Display file information after upload
4. Allow removing uploaded file
5. Handle drag and drop for EPUB files
6. Handle drag and drop for PDF files
7. Reject files larger than 10MB
8. Validate file type (reject non-EPUB/PDF)
9. Show upload progress or loading state

**03-api-key-management.spec.ts** (8 tests):
1. Have API key input field visible
2. Mask API key by default (password type)
3. Allow toggling API key visibility
4. Accept valid API key format
5. Offer persistent storage option
6. Offer session-only storage option
7. Save API key to localStorage when persistent
8. Clear API key from localStorage when forget button clicked
9. Validate API key is required before processing

**04-processing-flow.spec.ts** (10 tests):
1. Disable start button without file and API key
2. Enable start button with valid file and API key
3. Start processing when start button clicked
4. Show progress bar during processing
5. Display current phase during processing
6. Update progress percentage during processing
7. Show chapter progress grid
8. Handle phase transitions
9. Complete processing successfully
10. Show results section after completion
11. Handle processing with PDF file

**05-results-view.spec.ts** (8 tests):
1. Display results section after processing
2. Show download Chapters.md button
3. Show download Elements.md button
4. Trigger file download when Chapters button clicked
5. Trigger file download when Elements button clicked
6. Show image thumbnails if images were generated
7. Show download all images button if images exist
8. Show start new processing button
9. Reset state when start new button clicked

**Total Phase 1-2**: 43 E2E tests

### Phase 3: Error Scenarios & Edge Cases ✅ COMPLETE

**Tests Implemented** (25 tests across 3 suites):

**06-error-scenarios.spec.ts** (9 tests):
1. Display error message for invalid API key (401)
2. Display error message for rate limit exceeded (429)
3. Display error message for network error (500)
4. Handle offline mode gracefully
5. Allow retry after error
6. Not crash on corrupted file
7. Display error messages in accessible format (role="alert")
8. Allow dismissing error messages
9. Recover state after error and allow new processing

**07-mobile-responsive.spec.ts** (8 tests):
1. Adapt layout to mobile viewport (iPhone 12)
2. Adapt layout to mobile viewport (Pixel 5/Android)
3. Handle touch interactions on mobile
4. Display text readable without zooming (min 14px font)
5. Stack elements vertically on narrow screens (no horizontal scroll)
6. Handle file upload on mobile device
7. Display processing progress on mobile
8. Allow scrolling through long content on mobile

**08-accessibility.spec.ts** (8 tests):
1. No accessibility violations on initial load (WCAG 2.1 AA)
2. Have proper ARIA labels on form inputs
3. Support keyboard navigation (Tab through interactive elements)
4. Have proper heading hierarchy (h1 present, no level skips)
5. Announce processing status to screen readers (aria-live regions)
6. Have sufficient color contrast (WCAG 2.1 AA)
7. Have accessible error messages
8. Provide alternative text for images

**Total Phase 1-3**: 68 E2E tests

### Phase 4: CI/CD Integration ✅ COMPLETE

**Implemented**:
- ✅ Created `.github/workflows/demo-e2e.yml` - Standalone E2E test workflow
- ✅ Updated `.github/workflows/deploy-demo.yml` - E2E gate before deployment
- ✅ Automatic test execution on PR and push to main
- ✅ Test reports uploaded as GitHub Actions artifacts
- ✅ Deployment blocked if E2E tests fail

**Features**:
- Independent E2E workflow for fast feedback on PRs
- Pre-deployment validation (build → e2e → deploy)
- HTML test reports with 30-day retention
- Test results and traces with 7-day retention
- 10-minute timeout protection

### Phase 5: Documentation & Polish (Planned)

See `docs/E2E_TESTING_PLAN.md` for full implementation plan.

**Remaining Work**:
- Final documentation polish
- Add badges to README
- Update contributor guidelines

**Current Status**: 68 E2E tests implemented and integrated into CI/CD

## Mocking Strategy

### OpenAI API Mocking

E2E tests mock OpenAI API responses to:
- Avoid actual API costs during testing
- Prevent rate limiting issues
- Make tests faster and more reliable
- Allow testing without valid API keys

**Implementation**: See `helpers/mock-api.ts`

```typescript
import { mockOpenAIAPI } from '../helpers/mock-api';

test('process file', async ({ page }) => {
  await mockOpenAIAPI(page); // Mock API responses
  // ... test continues without real API calls
});
```

### Mock Responses

- **Chat Completions**: Returns mock scene/element analysis
- **Image Generation**: Returns minimal 1x1 PNG (base64 encoded)
- **Error Scenarios**: Configurable error responses (401, 429, 500)

## Configuration

### Browser Projects

Tests run on 5 browser configurations:

1. **Desktop Chrome** - Latest Chromium
2. **Desktop Firefox** - Latest Firefox
3. **Desktop Safari** - Latest WebKit
4. **Mobile Chrome** - Pixel 5 viewport
5. **Mobile Safari** - iPhone 12 viewport

### Test Timeouts

- Default: 30 seconds per test
- Long processing tests: 60 seconds
- CI retries: 2 attempts on failure

### Reporters

- **HTML Report**: Interactive test results (opened automatically on failure)
- **JSON Report**: Machine-readable results for CI analysis
- **GitHub Reporter**: Inline PR comments for failures (CI only)

## Development Workflow

### Adding New Tests

1. Create test file in `e2e/tests/` (e.g., `02-file-upload.spec.ts`)
2. Import helpers from `helpers/` directory
3. Use `test.describe()` to group related tests
4. Use `test()` for individual test cases
5. Run locally: `npm run test:e2e`
6. Commit and push (CI will run tests automatically)

### Test Best Practices

1. **Use Page Object Pattern** for complex interactions
2. **Mock External APIs** to avoid costs and rate limits
3. **Use Auto-Wait** - Playwright waits automatically for elements
4. **Screenshot on Failure** - Configured in `playwright.config.ts`
5. **Parallel Execution** - Tests run in parallel by default
6. **Accessibility First** - Use semantic selectors (role, label)

### Debugging Tests

```bash
# Run specific test file
npx playwright test 01-initial-load.spec.ts

# Run specific test by name
npx playwright test -g "should load demo page"

# Run with browser visible
npm run test:e2e:headed

# Run in debug mode with inspector
npm run test:e2e:debug

# View trace for failed test
npx playwright show-trace trace.zip
```

## Known Limitations

1. **Termux/Android**: Cannot run locally (browser binaries not available)
2. **API Mocking**: Cannot test actual OpenAI integration in CI
3. **Safari Testing**: Requires macOS runner (GitHub Actions limitation)
4. **Long Processing**: Cannot test 100-chapter books (timeout limits)

## CI/CD Integration

### GitHub Actions Workflows

E2E tests are integrated into CI/CD with two workflows:

#### 1. Standalone E2E Workflow (`.github/workflows/demo-e2e.yml`)

Runs on every push and PR affecting `demo/**` files:

```yaml
name: Demo E2E Tests

on:
  push:
    branches: [main]
    paths: ['demo/**']
  pull_request:
    branches: [main]
    paths: ['demo/**']

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - Install dependencies
      - Install Playwright browsers
      - Build demo
      - Run E2E tests (68 tests across 5 browsers)
      - Upload test reports and results as artifacts
```

**Features**:
- Runs independently for fast feedback
- Uploads HTML reports as artifacts (30-day retention)
- Uploads test results for debugging (7-day retention)
- 10-minute timeout to prevent hanging tests

#### 2. Pre-Deployment E2E Check (`.github/workflows/deploy-demo.yml`)

E2E tests gate GitHub Pages deployment:

```yaml
jobs:
  build:
    # Builds the demo

  e2e:
    needs: build  # Runs after successful build
    # Runs all E2E tests

  deploy:
    needs: [build, e2e]  # Deployment requires E2E tests to pass
    # Deploys to GitHub Pages
```

**Deployment Safety**:
- E2E tests must pass before deployment
- Prevents broken UI from being published
- Test failures block deployment automatically
- Reports available in GitHub Actions artifacts

### Viewing Test Reports

**In GitHub Actions**:
1. Go to **Actions** tab in GitHub repository
2. Select the workflow run (e.g., "Demo E2E Tests")
3. Download **playwright-report** artifact
4. Extract and open `index.html` in a browser

**Artifact Contents**:
- `playwright-report/` - Interactive HTML report with screenshots
- `test-results/` - Raw test results and failure traces

## Resources

- **Playwright Docs**: https://playwright.dev/
- **E2E Testing Plan**: `docs/E2E_TESTING_PLAN.md`
- **Best Practices**: https://playwright.dev/docs/best-practices
- **Accessibility Testing**: https://playwright.dev/docs/accessibility-testing

## Implementation Status

- [x] Phase 1: Setup & Infrastructure (Complete)
- [x] Phase 2: Core User Flow Tests (Complete)
- [x] Phase 3: Error Scenarios & Edge Cases (Complete)
- [x] Phase 4: CI/CD Integration (Complete)
- [ ] Phase 5: Documentation & Polish (Planned)

**Current Version**: Phase 1-4 (Setup, Core Flows, Edge Cases & CI/CD Complete)
**Next Steps**: Implement Phase 5 (Documentation & Polish)

---

**Last Updated**: November 13, 2025
**Test Count**: 68 tests (8 suites)
**Status**: Phase 1-4 Complete, 90% done
**CI/CD**: ✅ Integrated into GitHub Actions
