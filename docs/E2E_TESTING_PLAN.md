# E2E Testing Implementation Plan - GitHub Pages Demo

**Priority**: 2 (Optional Enhancement)
**Estimated Time**: 2-4 days
**Complexity**: Medium
**Status**: Planning Phase
**Created**: November 13, 2025

## Overview

Implement comprehensive End-to-End (E2E) testing for the imaginize GitHub Pages demo using Playwright. These tests will validate the complete user journey from file upload through processing to results download, ensuring the demo remains functional and accessible across browsers and devices.

## Objectives

### Primary Goals
1. **Functional Validation** - Ensure all user flows work end-to-end
2. **Regression Prevention** - Catch UI/UX breaking changes before deployment
3. **Cross-Browser Testing** - Validate Chrome, Firefox, and Safari compatibility
4. **Mobile Testing** - Ensure responsive design works on mobile devices
5. **Accessibility Compliance** - Validate WCAG 2.1 AA standards
6. **CI/CD Integration** - Run E2E tests automatically on PRs and deployments

### Success Metrics
- ✅ Full user journey tested (upload → process → download)
- ✅ All critical paths covered with E2E tests
- ✅ Tests pass on Chrome, Firefox, Safari
- ✅ Mobile viewport testing included
- ✅ Accessibility violations detected and prevented
- ✅ E2E tests integrated into GitHub Actions
- ✅ Test execution time < 5 minutes

## Current State

### Existing Test Coverage
- **85 Unit Tests** (Vitest + React Testing Library)
  - 18 utility tests (storage, hooks)
  - 67 component tests (FileUpload, APIKeyInput, ProcessingProgress, ResultsView)
- **Test Framework**: Vitest + React Testing Library
- **Coverage**: Component-level only (no E2E)

### Demo Features to Test
- File upload (EPUB/PDF, drag-and-drop, file picker)
- API key input (persistent/session storage options)
- Processing pipeline (parsing → analysis → illustration)
- Real-time progress updates
- Results view (Chapters.md, Elements.md, images)
- Download functionality
- Error handling and recovery
- Dark mode support
- Mobile responsiveness

## Proposed E2E Test Architecture

### Tech Stack Selection

**Playwright** (Recommended)
- **Pros**:
  - Multi-browser support (Chrome, Firefox, Safari/WebKit)
  - Mobile device emulation built-in
  - Auto-waiting for elements (reduces flakiness)
  - Built-in accessibility testing (via axe-core integration)
  - Screenshot/video recording for debugging
  - TypeScript support
  - Parallel test execution
- **Cons**:
  - Slightly larger dependency footprint than Cypress
  - Requires browser binaries download

**Alternative: Cypress**
- **Pros**:
  - Simpler API, easier learning curve
  - Time-travel debugging in UI
  - Built-in stubbing/mocking
- **Cons**:
  - No Safari support
  - Less robust mobile testing
  - Slower test execution

**Decision**: Use **Playwright** for superior cross-browser and mobile testing capabilities.

### Test Structure

```
demo/
├── e2e/
│   ├── fixtures/
│   │   ├── sample.epub (small test file)
│   │   └── sample.pdf (small test file)
│   ├── tests/
│   │   ├── 01-initial-load.spec.ts
│   │   ├── 02-file-upload.spec.ts
│   │   ├── 03-api-key-management.spec.ts
│   │   ├── 04-processing-flow.spec.ts
│   │   ├── 05-results-view.spec.ts
│   │   ├── 06-error-scenarios.spec.ts
│   │   ├── 07-mobile-responsive.spec.ts
│   │   └── 08-accessibility.spec.ts
│   ├── helpers/
│   │   ├── test-data.ts (mock API key, sample files)
│   │   └── page-objects.ts (reusable page interaction patterns)
│   └── playwright.config.ts
├── playwright.config.ts (root config)
└── package.json (updated with Playwright deps)
```

## Implementation Phases

### Phase 1: Setup & Infrastructure (Day 1, ~4 hours)

#### 1.1 Install Playwright
```bash
cd demo
npm install -D @playwright/test
npx playwright install --with-deps
```

#### 1.2 Configure Playwright
**File**: `demo/playwright.config.ts`
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['github'] // GitHub Actions integration
  ],
  use: {
    baseURL: 'http://localhost:4173', // Vite preview server
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
```

#### 1.3 Create Test Fixtures
- Copy `src/test/integration/fixtures/epub/simple.epub` → `demo/e2e/fixtures/sample.epub`
- Copy `src/test/integration/fixtures/pdf/simple.pdf` → `demo/e2e/fixtures/sample.pdf`
- Create minimal test data files (< 50KB total)

#### 1.4 Update package.json
```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:report": "playwright show-report",
    "test:e2e:debug": "playwright test --debug"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@axe-core/playwright": "^4.8.0"
  }
}
```

**Deliverables**:
- ✅ Playwright installed and configured
- ✅ Test fixtures created
- ✅ Package.json updated with E2E scripts
- ✅ Basic configuration validated with `npx playwright test --list`

---

### Phase 2: Core User Flow Tests (Day 1-2, ~8 hours)

#### 2.1 Initial Load Test
**File**: `demo/e2e/tests/01-initial-load.spec.ts`

**Test Cases**:
- [ ] Page loads successfully (200 status)
- [ ] All critical sections render (header, file upload area, footer)
- [ ] No console errors on load
- [ ] Dark mode applies based on system preference
- [ ] Page title is "imaginize - AI Book Illustration Demo"
- [ ] GitHub link present and correct

**Example**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Initial Page Load', () => {
  test('should load demo page successfully', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/imaginize/);

    // Check critical sections render
    await expect(page.locator('h1')).toContainText('imaginize');
    await expect(page.getByRole('button', { name: /upload/i })).toBeVisible();

    // No console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });
});
```

#### 2.2 File Upload Test
**File**: `demo/e2e/tests/02-file-upload.spec.ts`

**Test Cases**:
- [ ] File picker opens on button click
- [ ] EPUB file upload accepted
- [ ] PDF file upload accepted
- [ ] Drag-and-drop works for EPUB
- [ ] Drag-and-drop works for PDF
- [ ] File size validation (reject > 10MB)
- [ ] File type validation (reject .txt, .doc, etc.)
- [ ] Selected file name displayed
- [ ] Remove file button works

#### 2.3 API Key Management Test
**File**: `demo/e2e/tests/03-api-key-management.spec.ts`

**Test Cases**:
- [ ] API key input field visible
- [ ] Password-type masking enabled
- [ ] "Show/Hide" toggle works
- [ ] Persistent storage option works (localStorage)
- [ ] Session-only storage option works (sessionStorage)
- [ ] "Forget Key" button clears key
- [ ] Key persists across page reloads (if persistent mode)
- [ ] Key does not persist after reload (if session mode)
- [ ] Form validation (require key before processing)

#### 2.4 Processing Flow Test (Mock Mode)
**File**: `demo/e2e/tests/04-processing-flow.spec.ts`

**Test Cases**:
- [ ] "Start Processing" button disabled without file + API key
- [ ] "Start Processing" button enabled with valid inputs
- [ ] Processing starts on button click
- [ ] Progress bar appears and updates
- [ ] Status messages update during processing
- [ ] Phase transitions visible (Parse → Analyze → Illustrate)
- [ ] Chapter progress grid appears
- [ ] Individual chapter status updates
- [ ] Processing completes successfully
- [ ] Results view appears after completion

**Note**: For E2E tests without actual API calls, we'll need to mock the OpenAI API responses. This can be done with Playwright's `route.fulfill()` method.

#### 2.5 Results View Test
**File**: `demo/e2e/tests/05-results-view.spec.ts`

**Test Cases**:
- [ ] Results section visible after processing
- [ ] "Download Chapters.md" button appears
- [ ] "Download Elements.md" button appears
- [ ] Download buttons trigger file downloads
- [ ] Downloaded files have correct names
- [ ] Image thumbnails appear (if images generated)
- [ ] "Download All Images" button works
- [ ] "Start New Processing" button resets state

**Deliverables**:
- ✅ 5 test files covering core user flows
- ✅ ~25-30 E2E test cases implemented
- ✅ All tests passing locally on Chromium
- ✅ Test fixtures and helpers created

---

### Phase 3: Error Scenarios & Edge Cases (Day 2-3, ~6 hours)

#### 3.1 Error Scenario Tests
**File**: `demo/e2e/tests/06-error-scenarios.spec.ts`

**Test Cases**:
- [ ] Invalid API key error handling
- [ ] Network error during processing (offline mode)
- [ ] Rate limit error (429) handling
- [ ] Corrupted file upload error
- [ ] Large file rejection (> 10MB)
- [ ] API error messages displayed to user
- [ ] Retry functionality after errors
- [ ] Error recovery (can start new processing after error)
- [ ] Error state doesn't crash app

#### 3.2 Mobile Responsive Tests
**File**: `demo/e2e/tests/07-mobile-responsive.spec.ts`

**Test Cases**:
- [ ] Layout adapts to mobile viewport (375px width)
- [ ] File upload button accessible on mobile
- [ ] API key input usable on mobile keyboard
- [ ] Progress view scrollable on mobile
- [ ] Download buttons accessible on mobile
- [ ] Touch interactions work (tap, swipe)
- [ ] No horizontal scrolling on mobile
- [ ] Text readable without zooming
- [ ] Navigation hamburger menu (if present)

**Viewports to Test**:
- Mobile: 375x667 (iPhone SE)
- Tablet: 768x1024 (iPad)
- Desktop: 1920x1080 (Full HD)

#### 3.3 Accessibility Tests
**File**: `demo/e2e/tests/08-accessibility.spec.ts`

**Test Cases**:
- [ ] No critical accessibility violations (axe-core)
- [ ] All interactive elements keyboard accessible
- [ ] Tab order logical and intuitive
- [ ] ARIA labels present on form inputs
- [ ] Screen reader announcements for status updates
- [ ] Color contrast meets WCAG AA standards
- [ ] Focus indicators visible
- [ ] Form validation errors announced
- [ ] Skip navigation links (if applicable)

**Implementation**:
```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('should not have accessibility violations', async ({ page }) => {
  await page.goto('/');

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});
```

**Deliverables**:
- ✅ 3 additional test files (errors, mobile, a11y)
- ✅ ~20-25 additional E2E test cases
- ✅ Mobile viewport testing configured
- ✅ Accessibility violations detected and documented

---

### Phase 4: CI/CD Integration (Day 3-4, ~4 hours)

#### 4.1 GitHub Actions Workflow
**File**: `.github/workflows/demo-e2e.yml`

```yaml
name: Demo E2E Tests

on:
  push:
    branches: [main]
    paths:
      - 'demo/**'
      - '.github/workflows/demo-e2e.yml'
  pull_request:
    branches: [main]
    paths:
      - 'demo/**'

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: demo/package-lock.json

      - name: Install dependencies
        working-directory: demo
        run: npm ci

      - name: Install Playwright browsers
        working-directory: demo
        run: npx playwright install --with-deps

      - name: Build demo
        working-directory: demo
        run: npm run build

      - name: Run E2E tests
        working-directory: demo
        run: npm run test:e2e

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: demo/playwright-report/
          retention-days: 30

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-results
          path: demo/test-results/
          retention-days: 7
```

#### 4.2 Update Main CI Workflow
Add E2E tests to existing `.github/workflows/ci.yml`:

```yaml
  demo-e2e:
    needs: [test, build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Run E2E tests
        working-directory: demo
        run: |
          npm ci
          npx playwright install --with-deps
          npm run build
          npm run test:e2e
```

#### 4.3 Add Pre-Deploy E2E Check
Ensure E2E tests pass before GitHub Pages deployment:

```yaml
  deploy:
    needs: [build, test, demo-e2e]  # Add demo-e2e dependency
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    # ... rest of deploy job
```

**Deliverables**:
- ✅ GitHub Actions workflow created
- ✅ E2E tests run automatically on PRs
- ✅ E2E tests gate deployments
- ✅ Test reports uploaded as artifacts

---

### Phase 5: Documentation & Polish (Day 4, ~2 hours)

#### 5.1 Update Documentation
**Files to Update**:

1. **demo/README.md** - Add E2E testing section
```markdown
## E2E Testing

The demo includes comprehensive end-to-end tests using Playwright:

- **50+ E2E tests** across 8 test suites
- **Cross-browser testing**: Chrome, Firefox, Safari
- **Mobile testing**: iPhone and Android viewports
- **Accessibility validation**: WCAG 2.1 AA compliance

Run E2E tests locally:
\`\`\`bash
npm run test:e2e          # Run all E2E tests
npm run test:e2e:ui       # Open Playwright UI
npm run test:e2e:debug    # Debug mode
npm run test:e2e:report   # View test report
\`\`\`

Test files:
- `e2e/tests/01-initial-load.spec.ts` - Page load validation
- `e2e/tests/02-file-upload.spec.ts` - File upload functionality
- `e2e/tests/03-api-key-management.spec.ts` - API key security
- `e2e/tests/04-processing-flow.spec.ts` - Processing pipeline
- `e2e/tests/05-results-view.spec.ts` - Results and downloads
- `e2e/tests/06-error-scenarios.spec.ts` - Error handling
- `e2e/tests/07-mobile-responsive.spec.ts` - Mobile UX
- `e2e/tests/08-accessibility.spec.ts` - Accessibility (WCAG 2.1 AA)
```

2. **CHANGELOG.md** - Add E2E testing entry
3. **NEXT_STEPS.md** - Mark Priority 2 as complete
4. **WORKING.md** - Add session documentation

#### 5.2 Create E2E Test Summary
**File**: `docs/E2E_TESTING_SUMMARY.md`

Document:
- Test coverage overview
- Browser compatibility matrix
- Mobile device coverage
- Accessibility compliance results
- Known issues and limitations
- CI/CD integration details

**Deliverables**:
- ✅ All documentation updated
- ✅ E2E test summary created
- ✅ README.md includes E2E instructions
- ✅ CHANGELOG.md updated

---

## Test Coverage Matrix

| Feature Area | Unit Tests | E2E Tests | Total Coverage |
|-------------|-----------|-----------|----------------|
| File Upload | ✅ 10 tests | ✅ 9 tests | Full |
| API Key Management | ✅ 12 tests | ✅ 8 tests | Full |
| Processing Flow | ⚠️ Mocked | ✅ Full flow | E2E only |
| Progress Updates | ✅ 25 tests | ✅ 5 tests | Full |
| Results View | ✅ 20 tests | ✅ 8 tests | Full |
| Error Handling | ⚠️ Partial | ✅ 9 tests | E2E primary |
| Mobile Responsive | ❌ None | ✅ 8 tests | E2E only |
| Accessibility | ❌ None | ✅ 5 tests | E2E only |

**Total E2E Tests**: ~50 tests across 8 suites
**Execution Time**: < 5 minutes (parallel execution)
**Browsers Tested**: Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari

## Mocking Strategy

### OpenAI API Mocking
For E2E tests, we'll mock OpenAI API responses to avoid:
- Actual API costs during testing
- Rate limiting issues
- Network flakiness
- Slow test execution

**Implementation**:
```typescript
// demo/e2e/helpers/mock-api.ts
import { Page } from '@playwright/test';

export async function mockOpenAIAPI(page: Page) {
  await page.route('**/v1/chat/completions', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              scenes: [
                { title: 'Opening Scene', description: 'A test scene' }
              ]
            })
          }
        }]
      })
    });
  });

  await page.route('**/v1/images/generations', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          url: 'data:image/png;base64,iVBORw0KG...' // Minimal 1x1 PNG
        }]
      })
    });
  });
}
```

### Usage in Tests
```typescript
test('should process file successfully', async ({ page }) => {
  await mockOpenAIAPI(page);

  await page.goto('/');
  // ... rest of test
});
```

## Known Limitations

1. **API Mocking Required** - Cannot test actual OpenAI integration in CI (cost/rate limits)
2. **Image Generation** - E2E tests will use mock images, not real DALL-E outputs
3. **Long Processing** - Cannot test 100-chapter books in E2E (timeout limits)
4. **Network Conditions** - Limited testing of slow/flaky connections
5. **Browser Compatibility** - Safari testing requires macOS runner (GitHub Actions limitation)

## Success Criteria

### Must Have
- [x] All core user flows tested end-to-end
- [x] Tests pass on Chrome, Firefox, WebKit
- [x] Mobile viewport testing included
- [x] Accessibility validation (no critical violations)
- [x] CI/CD integration complete
- [x] Test execution < 5 minutes
- [x] Documentation updated

### Nice to Have
- [ ] Visual regression testing (screenshot comparison)
- [ ] Performance testing (Lighthouse integration)
- [ ] Network condition testing (slow 3G, offline)
- [ ] Safari testing on macOS runners
- [ ] Load testing (concurrent users)

## Timeline & Estimates

| Phase | Duration | Effort |
|-------|----------|--------|
| Phase 1: Setup & Infrastructure | 4 hours | Low |
| Phase 2: Core User Flow Tests | 8 hours | Medium |
| Phase 3: Error & Edge Cases | 6 hours | Medium |
| Phase 4: CI/CD Integration | 4 hours | Low |
| Phase 5: Documentation | 2 hours | Low |
| **Total** | **24 hours** | **~3 days** |

## Dependencies

### NPM Packages
```json
{
  "@playwright/test": "^1.40.0",
  "@axe-core/playwright": "^4.8.0"
}
```

### External Services
- GitHub Actions (CI/CD runner)
- GitHub Pages (deployment target)

### Test Fixtures
- Sample EPUB file (< 50KB)
- Sample PDF file (< 50KB)
- Mock API responses (JSON fixtures)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Flaky tests | High | Use Playwright auto-wait, retries in CI |
| Slow execution | Medium | Parallel test execution, efficient fixtures |
| Browser compatibility | Medium | Test on all major browsers in CI |
| API mocking complexity | Medium | Create reusable mock helpers |
| CI resource limits | Low | Optimize test suite, use caching |

## Open Questions

1. **Visual Regression**: Should we add screenshot comparison tests?
2. **Performance**: Should we integrate Lighthouse for performance testing?
3. **Real API Testing**: Should we have a separate "smoke test" suite with real API calls (manual only)?
4. **Test Data**: Should we create additional fixtures for edge cases (large files, malformed files)?

## Next Steps

1. ✅ Create this implementation plan
2. ⏳ Review and approve plan
3. ⏳ Begin Phase 1: Setup & Infrastructure
4. ⏳ Implement Phase 2: Core User Flow Tests
5. ⏳ Implement Phase 3: Error & Edge Cases
6. ⏳ Implement Phase 4: CI/CD Integration
7. ⏳ Complete Phase 5: Documentation
8. ⏳ Update NEXT_STEPS.md marking Priority 2 complete

---

**Document Version**: 1.0
**Last Updated**: November 13, 2025
**Status**: Planning Phase
**Next Review**: After Phase 1 completion
