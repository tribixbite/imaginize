# E2E Testing for imaginize Demo

End-to-end testing suite for the imaginize GitHub Pages demo using Playwright.

## Overview

This directory contains comprehensive E2E tests that validate the complete user journey through the demo application, from file upload to results download.

**Status**: Phase 1 Complete (Setup & Infrastructure)

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
│   └── 01-initial-load.spec.ts  # Page load validation (8 tests)
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

### Phase 2-5: Planned (Not Yet Implemented)

See `docs/E2E_TESTING_PLAN.md` for full implementation plan.

**Planned Test Suites**:
- `02-file-upload.spec.ts` - File upload functionality (~9 tests)
- `03-api-key-management.spec.ts` - API key security (~8 tests)
- `04-processing-flow.spec.ts` - Processing pipeline (~10 tests)
- `05-results-view.spec.ts` - Results and downloads (~8 tests)
- `06-error-scenarios.spec.ts` - Error handling (~9 tests)
- `07-mobile-responsive.spec.ts` - Mobile UX (~8 tests)
- `08-accessibility.spec.ts` - Accessibility (WCAG 2.1 AA) (~5 tests)

**Total Planned**: 50+ E2E tests

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

### GitHub Actions Workflow

E2E tests are integrated into CI/CD:

```yaml
# .github/workflows/demo-e2e.yml
- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: playwright-report/
```

### Pre-Deployment Check

E2E tests must pass before GitHub Pages deployment:

```yaml
deploy:
  needs: [build, test, demo-e2e]  # E2E tests required
  runs-on: ubuntu-latest
  # ... deployment steps
```

## Resources

- **Playwright Docs**: https://playwright.dev/
- **E2E Testing Plan**: `docs/E2E_TESTING_PLAN.md`
- **Best Practices**: https://playwright.dev/docs/best-practices
- **Accessibility Testing**: https://playwright.dev/docs/accessibility-testing

## Implementation Status

- [x] Phase 1: Setup & Infrastructure (Complete)
- [ ] Phase 2: Core User Flow Tests (Planned)
- [ ] Phase 3: Error Scenarios & Edge Cases (Planned)
- [ ] Phase 4: CI/CD Integration (Planned)
- [ ] Phase 5: Documentation & Polish (Planned)

**Current Version**: Phase 1 (Setup Complete)
**Next Steps**: Implement Phase 2 (Core User Flow Tests)

---

**Last Updated**: November 13, 2025
**Test Count**: 8 tests (1 suite)
**Status**: Phase 1 Complete, ready for Phase 2
